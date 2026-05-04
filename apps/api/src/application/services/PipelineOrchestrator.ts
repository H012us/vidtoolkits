import pLimit from 'p-limit';
import path from 'node:path';
import fs from 'node:fs/promises';
import axios from 'axios';
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
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ChildProcess } from 'node:child_process';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

type ProgressCallback = (step: PipelineStepName, progress: number, message?: string, partIndex?: number, partTitle?: string) => void;

export class PipelineOrchestrator {
  private projectStore: FileSystemProjectStore;
  private activeProcesses: ChildProcess[] = [];

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
    onProgress?: ProgressCallback,
    abortSignal?: AbortSignal
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const stepsCompleted: PipelineStepName[] = [];

    let project = await this.projectStore.get(projectId);
    if (!project) throw new RenderError(`Project not found: ${projectId}`);

    let entity = VideoProjectEntity.fromJSON(project);
    entity.updateStatus('processing');
    await this.projectStore.save(entity.toJSON());

    const workDir = path.join(pipelineConfig.tempDir, projectId);
    await ensureDir(workDir);
    const ttsDir = path.join(workDir, 'tts');
    await ensureDir(ttsDir);
    const imagesDir = path.join(workDir, 'images');
    await ensureDir(imagesDir);

    const ctx: PipelineContext = {
      projectId,
      rawMarkdown: entity.rawMarkdown,
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

    const report = (step: PipelineStepName, progress: number, message?: string, partIndex?: number, partTitle?: string) => {
      ctx.currentStep = step;
      ctx.progress = progress;
      onProgress?.(step, progress, message, partIndex, partTitle);
    };

    const killAllProcesses = () => {
      for (const proc of this.activeProcesses) {
        try { proc.kill(); } catch { /* ignore */ }
      }
      this.activeProcesses = [];
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        killAllProcesses();
      }, { once: true });
    }

    let result: PipelineResult;
    try {
      // Step 1: FETCH_IMAGES
      report('FETCH_IMAGES', 10, 'Fetching images for each part...');
      const imageLimit = pLimit(pipelineConfig.maxConcurrentImages);
      try {
        await Promise.all(
          ctx.partStates.map((part, i) =>
            imageLimit(async () => {
              const results = await this.mediaRegistry.search(part.keywords, 5);
              ctx.partStates[i].images = results;
              ctx.partStates[i].status = 'completed';
              report('FETCH_IMAGES', 10 + Math.round(((i + 1) / ctx.partStates.length) * 20), `Part ${i + 1} (${part.title}): ${results.length} images found`, i, part.title);
            })
          )
        );
      } catch (err) {
        ctx.partStates.forEach((p) => { if (p.status === 'pending') p.status = 'failed'; });
        const errMsg = (err as Error).message;
        ctx.errors.push({ step: 'FETCH_IMAGES', message: errMsg, recoverable: false, timestamp: new Date() });
        throw new RenderError(`FETCH_IMAGES failed: ${errMsg}`);
      }
      stepsCompleted.push('FETCH_IMAGES');

      // Download images locally for Remotion (headless Chromium needs local files)
      report('FETCH_IMAGES', 25, 'Downloading images locally...');
      await this.downloadImages(ctx.partStates, imagesDir);
      stepsCompleted.push('FETCH_IMAGES');

      // Step 2: GENERATE_TTS
      report('GENERATE_TTS', 35, 'Generating voice-over...');
      const ttsLimit = pLimit(pipelineConfig.maxConcurrentTTS);
      try {
        await Promise.all(
          ctx.partStates.map((part, i) =>
            ttsLimit(async () => {
              const ttsPath = path.join(ttsDir, `part-${i}.mp3`);
              const result = await this.generateTTS(part.script, ttsPath, entity.voiceName);
              ctx.partStates[i].ttsPath = result.path;
              ctx.partStates[i].durationSeconds = result.durationSeconds;
              ctx.partStates[i].status = 'completed';
              report('GENERATE_TTS', 35 + Math.round(((i + 1) / ctx.partStates.length) * 25), `Part ${i + 1} (${part.title}): ${result.durationSeconds.toFixed(1)}s voice-over`, i, part.title);
            })
          )
        );
      } catch (err) {
        ctx.partStates.forEach((p) => { if (p.status === 'pending') p.status = 'failed'; });
        const errMsg = (err as Error).message;
        ctx.errors.push({ step: 'GENERATE_TTS', message: errMsg, recoverable: false, timestamp: new Date() });
        throw new RenderError(`GENERATE_TTS failed: ${errMsg}`);
      }
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
        const errMsg = (err as Error).message;
        ctx.errors.push({ step: 'RENDER_VIDEO', message: errMsg, recoverable: false, timestamp: new Date() });
        await this.failProject(projectId, errMsg);
        throw new RenderError(`RENDER_VIDEO failed: ${errMsg}`);
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

      result = {
        projectId,
        outputPath: finalPath,
        success: true,
        stepsCompleted,
        errors: ctx.errors,
        totalDurationMs: Date.now() - startTime,
      };
    } finally {
      killAllProcesses();
      await this.cleanupWorkDir(workDir);
    }

    logger.info({ projectId, duration: result.totalDurationMs }, 'Pipeline completed successfully');
    return result;
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
        const { stdout } = await execFileAsync('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          part.ttsPath!,
        ], { timeout: 10000 });
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
        images: p.images.map(img => img.localPath ?? img.url),
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

    // Write a Remotion entry point that imports the real components from the remotion package dir
    const remotionEntry = path.join(workDir, 'remotion-entry.tsx');
    await fs.writeFile(remotionEntry, this.buildRemotionEntry(compositionsData), 'utf-8');

    // Spawn a temporary Remotion preview server that bundles the entry point
    const remotionDir = path.resolve(this.config.paths.remotionDir);
    const server = this.spawnRemotionServer(remotionEntry, remotionDir);
    this.activeProcesses.push(server);

    try {
      // Wait for server to be ready
      const serveUrl = await this.waitForRemotionServer(server);

      const { renderMedia } = await import('@remotion/renderer');

      const totalFrames = Math.ceil(
        compositionsData.parts.reduce((sum, p) => sum + (p.durationSeconds ?? 0), 0) * compositionsData.fps
      );

      await renderMedia({
        serveUrl,
        inputProps: { data: compositionsData },
        composition: {
          id: 'VideoComposition',
          fps: compositionsData.fps,
          width: compositionsData.width,
          height: compositionsData.height,
          durationInFrames: totalFrames,
          defaultProps: { data: compositionsData },
        } as any,
        codec: 'h264',
        outputLocation: outputFile,
        concurrency,
        logLevel: 'error',
        onProgress: (progress) => {
          // progress.progress is 0-1 fraction
          onProgress(Math.round(progress.progress * 100));
        },
      });

      return outputFile;
    } finally {
      this.activeProcesses = this.activeProcesses.filter(p => p !== server);
      server.kill();
    }
  }

  private spawnRemotionServer(entryPoint: string, remotionDir: string): ReturnType<typeof exec> {
    return exec(
      `node "${remotionDir}/node_modules/.bin/remotion" preview --entry-point "${entryPoint}" --port 0`,
      { cwd: remotionDir }
    );
  }

  private async waitForRemotionServer(
    server: ReturnType<typeof exec>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new RenderError('Remotion server failed to start within 30s'));
      }, 30000);

      server.stdout?.on('data', (chunk: Buffer) => {
        const line = chunk.toString();
        const match = line.match(/localhost:(\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(`http://localhost:${match[1]}`);
        }
      });

      server.stderr?.on('data', (chunk: Buffer) => {
        const line = chunk.toString();
        if (line.includes('error') || line.includes('Error') || line.includes('failed')) {
          logger.warn({ line }, 'Remotion server stderr');
        }
      });

      server.on('error', (err) => {
        clearTimeout(timeout);
        reject(new RenderError(`Remotion server error: ${err.message}`));
      });

      server.on('close', (code) => {
        if (code !== null && code !== 0) {
          clearTimeout(timeout);
          reject(new RenderError(`Remotion server exited with code ${code}`));
        }
      });
    });
  }

  private buildRemotionEntry(_data: ReturnType<typeof this.buildCompositionsData>): string {
    const remotionSrcDir = path.resolve(this.config.paths.remotionDir, 'src');
    return `
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoPart } from '${remotionSrcDir.replace(/\\/g, '\\\\')}\\\\VideoPart';

export const VideoComposition = ({ data }: { data: any }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', width: data.width, height: data.height }}>
      {data.parts.map((part: any, i: number) => {
        const durationFrames = Math.ceil((part.durationSeconds ?? 8) * fps);
        return (
          <Sequence key={i} from={i * durationFrames} durationInFrames={durationFrames}>
            <VideoPart part={part} index={i} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
`;
  }

  private async postProcessVideo(inputPath: string, outputDir: string): Promise<string> {
    const outputFile = inputPath.replace('.mp4', '_final.mp4');
    await ensureDir(outputDir);

    const hasQSV = await this.checkQSVSupport();
    const codec = hasQSV ? 'hevc_qsv' : 'libx265';

    const args: string[] = [
      '-y',
      '-i', inputPath,
      '-c:v', codec,
      ...(hasQSV ? ['-load_plugin', 'hevc_hw'] : []),
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputFile,
    ];

    try {
      await execFileAsync('ffmpeg', args, { timeout: 300000 });
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

  private async downloadImages(partStates: PartState[], imagesDir: string): Promise<void> {
    const imageLimit = pLimit(6);
    const downloadTasks: Promise<void>[] = [];

    for (const [partIdx, part] of partStates.entries()) {
      for (const [imgIdx, img] of part.images.entries()) {
        downloadTasks.push(
          imageLimit(async () => {
            const ext = this.guessExtension(img.url) ?? 'jpg';
            const localPath = path.join(imagesDir, `part-${partIdx}-${imgIdx}.${ext}`);
            try {
              const response = await axios.get(img.url, { responseType: 'arraybuffer', timeout: 15000 });
              await fs.writeFile(localPath, Buffer.from(response.data));
              img.localPath = localPath;
            } catch (err) {
              logger.warn({ imageUrl: img.url, err }, 'Failed to download image, using remote URL');
              img.localPath = undefined;
            }
          })
        );
      }
    }

    await Promise.all(downloadTasks);
  }

  private guessExtension(url: string): string | null {
    try {
      const u = new URL(url);
      const ext = u.pathname.split('/').pop()?.split('.').pop();
      if (ext && /^[a-z0-9]+$/i.test(ext)) return ext;
    } catch { /* ignore */ }
    return null;
  }

  private async cleanupWorkDir(workDir: string): Promise<void> {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (err) {
      logger.warn({ workDir, err }, 'Failed to clean up work directory');
    }
  }

}