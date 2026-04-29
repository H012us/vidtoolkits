import type { RenderJob, PipelineStepName } from '@vidtoolkits/shared';
import { v4 as uuidv4 } from 'uuid';

export class RenderJobEntity implements RenderJob {
  id: string;
  projectId: string;
  status: RenderJob['status'];
  progress: number;
  currentStep: PipelineStepName | null;
  startedAt: string;
  completedAt: string | null;
  outputPath: string | null;
  fileSize: number | null;
  error: string | null;

  constructor(projectId: string) {
    this.id = uuidv4();
    this.projectId = projectId;
    this.status = 'queued';
    this.progress = 0;
    this.currentStep = null;
    this.startedAt = new Date().toISOString();
    this.completedAt = null;
    this.outputPath = null;
    this.fileSize = null;
    this.error = null;
  }

  start(): void {
    this.status = 'running';
    this.startedAt = new Date().toISOString();
  }

  setStep(step: PipelineStepName, progress: number): void {
    this.currentStep = step;
    this.progress = progress;
  }

  complete(outputPath: string, fileSize: number): void {
    this.status = 'completed';
    this.progress = 100;
    this.outputPath = outputPath;
    this.fileSize = fileSize;
    this.completedAt = new Date().toISOString();
  }

  fail(error: string): void {
    this.status = 'failed';
    this.error = error;
    this.completedAt = new Date().toISOString();
  }

  toJSON(): RenderJob {
    return {
      id: this.id,
      projectId: this.projectId,
      status: this.status,
      progress: this.progress,
      currentStep: this.currentStep,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      outputPath: this.outputPath,
      fileSize: this.fileSize,
      error: this.error,
    };
  }

  static fromJSON(data: RenderJob): RenderJobEntity {
    const entity = Object.create(RenderJobEntity.prototype);
    Object.assign(entity, data);
    return entity;
  }
}