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

export class RenderService {
  private jobStore: RenderJobStore;
  private projectService: ProjectService;

  constructor() {
    this.jobStore = new RenderJobStore(CONFIG.paths.projectsDir);
    this.projectService = new ProjectService();
  }

  private get orchestrator(): PipelineOrchestrator {
    return container.get<PipelineOrchestrator>('PipelineOrchestrator');
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

    const job = new RenderJobEntity(projectId);
    job.start();
    await this.jobStore.save(job.toJSON());

    // Run pipeline asynchronously
    this.runPipeline(projectId, job.id).catch(err => {
      logger.error({ err, projectId, jobId: job.id }, 'Pipeline run failed');
    });

    logger.info({ projectId, jobId: job.id }, 'Render started');
    return job.toJSON();
  }

  private async runPipeline(projectId: string, jobId: string): Promise<PipelineResult> {
    const job = await this.jobStore.get(jobId);
    if (!job) return { projectId, outputPath: null, success: false, stepsCompleted: [], errors: [], totalDurationMs: 0 };

    const sendProgress = (step: PipelineStepName, progress: number, message?: string) => {
      sseManager.broadcast(projectId, {
        type: step === 'DELIVER_RESULT' ? 'complete' : 'step',
        step,
        progress,
        message,
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
}