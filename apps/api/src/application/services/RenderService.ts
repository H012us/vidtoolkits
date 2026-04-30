import type { PipelineResult, RenderJob, PipelineStepName } from '@vidtoolkits/shared';
import { PipelineOrchestrator } from './PipelineOrchestrator.js';
import { RenderJobStore } from '../../infrastructure/persistence/RenderJobStore.js';
import { sseManager } from '../../presentation/SSE/SSEManager.js';
import { container } from '../../infrastructure/container.js';
import { CONFIG } from '../../infrastructure/config/index.js';
import { logger } from '../../infrastructure/logger.js';
import { NotFoundError, ConflictError } from '../../domain/errors/index.js';
import { ProjectService } from './ProjectService.js';
import { RenderJobEntity } from '../../domain/entities/RenderJobEntity.js';
import type { HealthCheckService } from './HealthCheckService.js';

export class RenderService {
  private jobStore: RenderJobStore;
  private projectService: ProjectService;
  private activeJobs = new Map<string, AbortController>();

  constructor() {
    this.jobStore = new RenderJobStore(CONFIG.paths.projectsDir);
    this.projectService = new ProjectService();
  }

  private get orchestrator(): PipelineOrchestrator {
    return container.get<PipelineOrchestrator>('PipelineOrchestrator');
  }

  private get healthCheck(): HealthCheckService {
    return container.get<HealthCheckService>('HealthCheckService');
  }

  async startRender(projectId: string): Promise<RenderJob> {
    const project = await this.projectService.getProject(projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.status === 'processing') {
      throw new ConflictError(`Project ${projectId} is already being processed`);
    }

    const existingJob = await this.jobStore.getByProjectId(projectId);
    if (existingJob && existingJob.status === 'running') {
      throw new ConflictError(`Project ${projectId} already has an active render job`);
    }

    // Pre-render validation: check required services
    const healthReport = await this.healthCheck.check();
    const failures: string[] = [];

    if (healthReport.voicebox.status === 'unavailable') {
      failures.push(`Voicebox unavailable: ${healthReport.voicebox.message ?? 'cannot reach server'}`);
    }

    const configuredProviders = healthReport.imageProviders.filter(p => p.configured);
    if (configuredProviders.length === 0) {
      failures.push('No image providers configured (Pixabay, Pexels, Unsplash all unavailable)');
    }

    if (!healthReport.binaries.ffmpeg.available) {
      failures.push(`FFmpeg not found: ${healthReport.binaries.ffmpeg.error ?? 'binary not on PATH'}`);
    }

    if (!healthReport.binaries.ffprobe.available) {
      failures.push(`FFprobe not found: ${healthReport.binaries.ffprobe.error ?? 'binary not on PATH'}`);
    }

    if (!healthReport.remotion.available) {
      failures.push(`Remotion not available: ${healthReport.remotion.error ?? 'package not found'}`);
    }

    if (failures.length > 0) {
      const err = new Error(`Cannot start render: ${failures.join('; ')}`);
      (err as any).code = 'SERVICE_UNAVAILABLE';
      (err as any).failures = failures;
      throw err;
    }

    const job = new RenderJobEntity(projectId);
    job.start();
    await this.jobStore.save(job.toJSON());

    // Track abort controller for this job
    const abortController = new AbortController();
    this.activeJobs.set(job.id, abortController);

    // Run pipeline asynchronously
    this.runPipeline(projectId, job.id, abortController.signal).catch(err => {
      logger.error({ err, projectId, jobId: job.id }, 'Pipeline run failed');
    }).finally(() => {
      this.activeJobs.delete(job.id);
    });

    logger.info({ projectId, jobId: job.id }, 'Render started');
    return job.toJSON();
  }

  private async runPipeline(projectId: string, jobId: string, signal?: AbortSignal): Promise<PipelineResult> {
    const job = await this.jobStore.get(jobId);
    if (!job) return { projectId, outputPath: null, success: false, stepsCompleted: [], errors: [], totalDurationMs: 0 };

    // Register signal listener for cancellation
    if (signal) {
      signal.addEventListener('abort', async () => {
        const jobData = await this.jobStore.get(jobId);
        if (jobData) {
          const entity = RenderJobEntity.fromJSON(jobData);
          entity.fail('Cancelled by user');
          await this.jobStore.save(entity.toJSON());
        }
        sseManager.broadcast(projectId, {
          type: 'stopped',
          message: 'Render cancelled by user',
          timestamp: new Date().toISOString(),
        });
      }, { once: true });
    }

    const sendProgress = (step: PipelineStepName, progress: number, message?: string, partIndex?: number, partTitle?: string) => {
      sseManager.broadcast(projectId, {
        type: step === 'DELIVER_RESULT' ? 'complete' : 'step',
        step,
        progress,
        message,
        partIndex,
        partTitle,
        timestamp: new Date().toISOString(),
      });
    };

    try {
      const result = await this.orchestrator.run(projectId, {
        outputDir: CONFIG.paths.outputDir,
        tempDir: CONFIG.paths.tempDir,
        maxConcurrentImages: CONFIG.performance.maxConcurrentImages,
        maxConcurrentTTS: CONFIG.performance.maxConcurrentTTS,
        remotionConcurrency: CONFIG.performance.remotionConcurrency,
        nodeMaxOldSpaceMB: CONFIG.performance.nodeMaxOldSpaceMB,
        cacheDiskMaxMB: CONFIG.performance.cacheDiskMaxMB,
      }, sendProgress);

      const jobData = await this.jobStore.get(jobId);
      if (jobData) {
        const jobEntity = RenderJobEntity.fromJSON(jobData);
        if (result.success && result.outputPath) {
          jobEntity.complete(result.outputPath, 0);
        } else {
          jobEntity.fail(result.errors[0]?.message ?? 'Unknown error');
        }
        await this.jobStore.save(jobEntity.toJSON());
      }

      sseManager.broadcast(projectId, {
        type: 'complete',
        data: result,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (err) {
      const jobData = await this.jobStore.get(jobId);
      if (jobData) {
        const jobEntity = RenderJobEntity.fromJSON(jobData);
        jobEntity.fail((err as Error).message);
        await this.jobStore.save(jobEntity.toJSON());
      }

      sseManager.broadcast(projectId, {
        type: 'error',
        message: (err as Error).message,
        timestamp: new Date().toISOString(),
      });

      throw err;
    }
  }

  async getJobStatus(projectId: string): Promise<RenderJob | null> {
    return this.jobStore.getByProjectId(projectId);
  }

  async cancelRender(projectId: string): Promise<void> {
    const job = await this.jobStore.getByProjectId(projectId);
    if (!job || job.status !== 'running') return;

    const controller = this.activeJobs.get(job.id);
    if (controller) {
      controller.abort();
    }
  }
}