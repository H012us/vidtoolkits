import type { VideoProject } from '@vidtoolkits/shared';
import { VideoProjectEntity } from '../../domain/entities/index.js';
import { FileSystemProjectStore } from '../../infrastructure/persistence/FileSystemProjectStore.js';
import { CONFIG } from '../../infrastructure/config/index.js';
import { logger } from '../../infrastructure/logger.js';

export class ProjectService {
  private store: FileSystemProjectStore;

  constructor() {
    this.store = new FileSystemProjectStore(CONFIG.paths.projectsDir);
  }

  async listProjects(): Promise<VideoProject[]> {
    return this.store.list();
  }

  async getProject(id: string): Promise<VideoProject | null> {
    return this.store.get(id);
  }

  async updateProject(id: string, data: Partial<VideoProject>): Promise<VideoProject | null> {
    const project = await this.store.get(id);
    if (!project) return null;

    const entity = VideoProjectEntity.fromJSON(project);
    if (data.title !== undefined) entity.title = data.title;
    if (data.voiceName !== undefined) entity.voiceName = data.voiceName;
    if (data.durationPerPart !== undefined) entity.durationPerPart = data.durationPerPart;

    await this.store.save(entity.toJSON());
    return entity.toJSON();
  }

  async deleteProject(id: string): Promise<void> {
    await this.store.delete(id);
    logger.info({ projectId: id }, 'Project deleted');
  }

  async createProject(data: { title: string; rawMarkdown: string; style?: string; voiceName?: string; durationPerPart?: number }): Promise<VideoProjectEntity> {
    const entity = new VideoProjectEntity({
      title: data.title,
      rawMarkdown: data.rawMarkdown,
      style: data.style,
      voiceName: data.voiceName,
      durationPerPart: data.durationPerPart,
    });
    await this.store.save(entity.toJSON());
    logger.info({ projectId: entity.id }, 'Project created');
    return entity;
  }
}