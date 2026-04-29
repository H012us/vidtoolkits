import pLimit from 'p-limit';
import path from 'node:path';
import fs from 'node:fs/promises';
import type {
  PipelineContext,
  PipelineConfig,
  PipelineResult,
  PipelineStepName,
  PartState,
  TTSResult,
} from '@vidtoolkits/shared';
import { MediaProviderRegistry } from '../../infrastructure/media-providers/MediaProviderRegistry.js';
import type { ITTSEngine } from '@vidtoolkits/shared';
import type { AppConfig } from '../../infrastructure/config/AppConfig.js';
import { FileSystemProjectStore } from '../../infrastructure/persistence/FileSystemProjectStore.js';
import { VideoProjectEntity } from '../../domain/entities/index.js';
import { RenderError, TTSError } from '../../domain/errors/index.js';
import { logger } from '../../infrastructure/logger.js';
import { ensureDir } from '../../infrastructure/fsUtils.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

type ProgressCallback = (step: PipelineStepName, progress: number, message?: string) => void;

export class PipelineOrchestrator {
  private projectStore: FileSystemProjectStore;

  constructor(
    private readonly mediaRegistry: MediaProviderRegistry,
    private readonly ttsEngines: ITTSEngine[],
    private readonly config: AppConfig
  ) {
    this.projectStore = new FileSystemProjectStore(config.paths.projectsDir);
  }

  async run(
    projectId: string,
    pipelineConfig: PipelineConfig,
    onProgress?: ProgressCallback
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const stepsCompleted: PipelineStepName[] = [];
    const errors: { step: PipelineStepName; message: string; recoverable: boolean; timestamp: Date }[] = [];

    let project = await this.projectStore.get(projectId);
    if (!project) throw new RenderError(`Project not found: ${projectId}`);

    let entity = VideoProjectEntity.fromJSON(project);
    entity.updateStatus('processing');
    await this.projectStore.save(entity.toJSON());

    const workDir = path.join(pipelineConfig.tempDir, projectId);
    await ensureDir(workDir);
    const ttsDir = path.join(workDir, 'tts');
    await ensureDir(ttsDir);

    const ctx: PipelineContext = {
      projectId,
      rawMarkdown: entity.toJSON().createdAt,
      parsedProject: null,
      partStates: entity.parts.map(p => ({
        partIndex: p.partIndex,
        title: p.title,
        script: p.script,
        keywords: p.keywords,
        images: p.images,
        ttsPath: p.ttsPath,
        durationSeconds: p.durationSeconds,
        status: 'pending' as const,
      })),
      currentStep: null,
      stepStatuses: new Map(),
      progress: 0,
      errors: [],
      outputPath: null,
      startedAt: new Date(),
      config: { ...pipelineConfig, nodeMaxOldSpaceMB: this.config.performance.nodeMaxOldSpaceMB, cacheDiskMaxMB: this.config.performance.cacheDiskMaxMB },
    };

    const report = (step: PipelineStepName, progress: number, message?: string) => {
      ctx.currentStep = step;
      ctx.progress = progress;
      onProgress?.(step, progress, message);
    };

    const emitError = (step: PipelineStepName, message: string, recoverable: boolean) => {
      errors.push({ step, message, recoverable, timestamp: new Date() });
      ctx.errors.push({ step, message, recoverable, timestamp: new Date() });
      report(step, ctx.progress, message);
    };

    // Step 1: FETCH_IMAGES
    report('FETCH_IMAGES', 10, 'Fetching images for each part...');
    const imageLimit = pLimit(pipelineConfig.maxConcurrentImages);
    await Promise.allSettled(
      ctx.partStates.map((part, i) =>
        imageLimit(async () => {
          try {
            const results = await this.mediaRegistry.search(part.keywords, 5);
            ctx.partStates[i].images = results;
            ctx.partStates[i].status = 'completed';
            report('FETCH_IMAGES', 10 + Math.round(((i + 1) / ctx.partStates.length) * 20), `Images for part ${i + 1}: ${results.length} found`);
          } catch (err) {
            ctx.partStates[i].status = 'failed';
            emitError('FETCH_IMAGES', `Part ${i + 1}: ${(err as Error).message}`, true);
          }
        })
      )
    );
    stepsCompleted.push('FETCH_IMAGES');

    // Step 2: GENERATE_TTS
    report('GENERATE_TTS', 35, 'Generating voice-over...');
    const ttsLimit = pLimit(pipelineConfig.maxConcurrentTTS);
    await Promise.allSettled(
      ctx.partStates.map((part, i) =>
        ttsLimit(async () => {
          try {
            const ttsPath = path.join(ttsDir, `part-${i}.mp3`);
            const result = await this.generateTTS(part.script, ttsPath, entity.voiceName);
            ctx.partStates[i].ttsPath = result.path;
            ctx.partStates[i].durationSeconds = result.durationSeconds;
            ctx.partStates[i].status = 'completed';
            report('GENERATE_TTS', 35 + Math.round(((i + 1) / ctx.partStates.length) * 25), `TTS for part ${i + 1}: ${result.durationSeconds.toFixed(1)}s`);
          } catch (err) {
            ctx.partStates[i].status = 'failed';
            emitError('GENERATE_TTS', `Part ${i + 1}: ${(err as Error).message}`, true);
          }
        })
      )
    );
    stepsCompleted.push('GENERATE_TTS');

    // Step 3: MEASURE DURATIONS
    report('MEASURE_DURATIONS', 65, 'Measuring audio durations...');
    await this.measureDurations(ctx.partStates, ttsDir);
    stepsCompleted.push('MEASURE_DURATIONS');
    report('MEASURE_DURATIONS', 70, 'Durations measured');

    // Step 4: ASSEMBLE_COMPOSITION
    report('ASSEMBLE_COMPOSITION', 72, 'Assembling video composition...');
    const compositionsData = this.buildCompositionsData(ctx.partStates, entity.title, workDir);
    await fs.writeFile(
      path.join(workDir, 'compositions.json'),
      JSON.stringify(compositionsData, null, 2),
      'utf-8'
    );
    stepsCompleted.push('ASSEMBLE_COMPOSITION');
    report('ASSEMBLE_COMPOSITION', 75, 'Composition assembled');

    // Step 5: RENDER_VIDEO
    report('RENDER_VIDEO', 78, 'Rendering video with Remotion...');
    let outputPath: string;
    try {
      outputPath = await this.renderWithRemotion(compositionsData, workDir, pipelineConfig.outputDir, pipelineConfig.remotionConcurrency, (p) => {
        report('RENDER_VIDEO', 78 + Math.round(p * 15), `Rendering: ${p}%`);
      });
    } catch (err) {
      emitError('RENDER_VIDEO', (err as Error).message, false);
      await this.failProject(projectId, errors[errors.length - 1]?.message ?? 'Render failed');
      return { projectId, outputPath: null, success: false, stepsCompleted, errors, totalDurationMs: Date.now() - startTime };
    }
    stepsCompleted.push('RENDER_VIDEO');

    // Step 6: POST_PROCESS (FFmpeg H.265/QSV)
    report('POST_PROCESS', 95, 'Post-processing video...');
    const finalPath = await this.postProcessVideo(outputPath, pipelineConfig.outputDir);
    stepsCompleted.push('POST_PROCESS');

    // Step 7: DELIVER_RESULT
    report('DELIVER_RESULT', 98, 'Delivering result...');
    await this.completeProject(projectId, finalPath);
    stepsCompleted.push('DELIVER_RESULT');

    const finalResult: PipelineResult = {
      projectId,
      outputPath: finalPath,
      success: true,
      stepsCompleted,
      errors,
      totalDurationMs: Date.now() - startTime,
    };

    logger.info({ projectId, duration: finalResult.totalDurationMs }, 'Pipeline completed successfully');
    return finalResult;
  }

  private async generateTTS(text: string, outputPath: string, voice: string): Promise<TTSResult> {
    for (const engine of this.ttsEngines) {
      const available = await engine.isAvailable();
      if (!available) continue;

      try {
        return await engine.generate(text, outputPath, voice);
      } catch (err) {
        logger.warn({ engine: engine.name, err }, 'TTS engine failed, trying next');
      }
    }

    throw new TTSError('All TTS engines failed', 'all');
  }

  private async measureDurations(partStates: PartState[], _ttsDir: string): Promise<void> {
    for (const part of partStates) {
      if (!part.ttsPath) continue;
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${part.ttsPath}"`,
          { timeout: 10000 }
        );
        const duration = parseFloat(stdout.trim());
        if (!isNaN(duration)) part.durationSeconds = duration;
      } catch {
        // fallback to file-size estimate
        try {
          const stats = await fs.stat(part.ttsPath);
          part.durationSeconds = Math.max(1, stats.size / 16000);
        } catch {
          part.durationSeconds = 5; // default fallback
        }
      }
    }
  }

  private buildCompositionsData(partStates: PartState[], title: string, workDir: string) {
    return {
      title,
      fps: 30,
      width: 1920,
      height: 1080,
      parts: partStates.map((p, i) => ({
        index: i,
        title: p.title,
        script: p.script,
        images: p.images.map(img => img.thumbnailUrl ?? img.url),
        ttsPath: p.ttsPath,
        durationSeconds: p.durationSeconds ?? 8,
        keywords: p.keywords,
      })),
      workDir,
    };
  }

  private async renderWithRemotion(
    compositionsData: ReturnType<typeof this.buildCompositionsData>,
    workDir: string,
    outputDir: string,
    concurrency: number,
    onProgress: (p: number) => void
  ): Promise<string> {
    const dataPath = path.join(workDir, 'compositions.json');
    await fs.writeFile(dataPath, JSON.stringify(compositionsData), 'utf-8');

    const outputFile = path.join(outputDir, `${compositionsData.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.mp4`);
    await ensureDir(outputDir);

    // Write a simple Remotion entry point that reads compositions.json
    const remotionEntry = path.join(workDir, 'remotion-entry.tsx');
    await fs.writeFile(remotionEntry, this.buildRemotionEntry(compositionsData), 'utf-8');

    try {
      const { renderMedia } = await import('@remotion/renderer');

      const composition = {
        id: 'VideoComposition',
        fps: compositionsData.fps,
        width: compositionsData.width,
        height: compositionsData.height,
        durationInFrames: Math.ceil(
          compositionsData.parts.reduce((sum, p) => sum + (p.durationSeconds ?? 0), 0) * compositionsData.fps
        ),
        defaultProps: { data: compositionsData },
      } as any;

      await renderMedia({
        composition: composition as any,
        serveUrl: 'inline',
        entryPoint: remotionEntry,
        outputLocation: outputFile,
        concurrency,
        logLevel: 'error',
        onProgress: (progress: number) => {
          onProgress(Math.round(progress * 100));
        },
      } as any);

      return outputFile;
    } catch (err) {
      throw new RenderError(`Remotion render failed: ${(err as Error).message}`);
    }
  }

  private buildRemotionEntry(data: ReturnType<typeof this.buildCompositionsData>): string {
    const partsJson = JSON.stringify(data.parts).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    return `
import { Composition } from 'remotion';
import { VideoPart } from './VideoPart';

const data = ${JSON.stringify(data).replace(/\\\\/g, '\\\\')};

export const VideoComposition = () => {
  return (
    <div style={{ width: '${data.width}px', height: '${data.height}px', backgroundColor: '#000', display: 'flex', flexDirection: 'column' }}>
      {${partsJson}.map((part: any, i: number) => (
        <VideoPart key={i} part={part} index={i} />
      ))}
    </div>
  );
};
`;
  }

  private async postProcessVideo(inputPath: string, outputDir: string): Promise<string> {
    const outputFile = inputPath.replace('.mp4', '_final.mp4');
    await ensureDir(outputDir);

    const hasQSV = await this.checkQSVSupport();
    const codec = hasQSV ? 'hevc_qsv' : 'libx265';
    const preset = hasQSV ? 'medium' : 'medium';

    const args = [
      '-y',
      '-i', `"${inputPath}"`,
      '-c:v', codec,
      ...(hasQSV ? ['-load_plugin', 'hevc_hw'] : []),
      '-preset', preset,
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      `"${outputFile}"`,
    ].join(' ');

    try {
      await execAsync(`ffmpeg ${args}`, { timeout: 300000 });
    } catch (err) {
      logger.warn({ err }, 'FFmpeg post-processing failed, using original');
      return inputPath;
    }

    return outputFile;
  }

  private async checkQSVSupport(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('ffmpeg -encoders 2>/dev/null | grep hevc_qsv || echo not-found', { timeout: 5000 });
      return !stdout.includes('not-found');
    } catch {
      return false;
    }
  }

  private async completeProject(projectId: string, outputPath: string): Promise<void> {
    const project = await this.projectStore.get(projectId);
    if (!project) return;
    const entity = VideoProjectEntity.fromJSON(project);
    entity.updateStatus('completed');
    entity.setOutput(outputPath);
    entity.parts = entity.parts.map((p) => ({ ...p, status: 'completed' as const }));
    await this.projectStore.save(entity.toJSON());
  }

  private async failProject(projectId: string, errorMsg: string): Promise<void> {
    const project = await this.projectStore.get(projectId);
    if (!project) return;
    const entity = VideoProjectEntity.fromJSON(project);
    entity.setError(errorMsg);
    await this.projectStore.save(entity.toJSON());
  }

}