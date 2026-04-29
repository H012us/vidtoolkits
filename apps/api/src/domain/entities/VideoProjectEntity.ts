import type { VideoProject } from '@vidtoolkits/shared';
import { v4 as uuidv4 } from 'uuid';

export interface CreateVideoProjectInput {
  title: string;
  style?: string;
  voiceName?: string;
  durationPerPart?: number;
  rawMarkdown: string;
}

export class VideoProjectEntity implements VideoProject {
  id: string;
  title: string;
  style: 'cinematic' | 'minimal' | 'bold';
  voiceName: string;
  durationPerPart: number;
  parts: VideoProject['parts'];
  status: VideoProject['status'];
  createdAt: string;
  updatedAt: string;
  outputPath: string | null;
  error: string | null;

  constructor(data: CreateVideoProjectInput) {
    this.id = uuidv4();
    this.title = data.title || 'Untitled Video';
    this.style = (data.style as 'cinematic' | 'minimal' | 'bold') || 'cinematic';
    this.voiceName = data.voiceName || 'en-US-AriaNeural';
    this.durationPerPart = data.durationPerPart || 8;
    this.parts = [];
    this.status = 'created';
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.outputPath = null;
    this.error = null;
  }

  updateStatus(status: VideoProject['status']): void {
    this.status = status;
    this.updatedAt = new Date().toISOString();
  }

  setOutput(path: string): void {
    this.outputPath = path;
    this.updatedAt = new Date().toISOString();
  }

  setError(error: string): void {
    this.error = error;
    this.status = 'failed';
    this.updatedAt = new Date().toISOString();
  }

  toJSON(): VideoProject {
    return {
      id: this.id,
      title: this.title,
      style: this.style,
      voiceName: this.voiceName,
      durationPerPart: this.durationPerPart,
      parts: this.parts,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      outputPath: this.outputPath,
      error: this.error,
    };
  }

  static fromJSON(data: VideoProject): VideoProjectEntity {
    const entity = Object.create(VideoProjectEntity.prototype);
    Object.assign(entity, data);
    return entity;
  }
}