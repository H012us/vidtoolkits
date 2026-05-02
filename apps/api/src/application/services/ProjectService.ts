import type { VideoProject } from '@vidtoolkits/shared';
import { VideoProjectEntity } from '../../domain/entities/index.js';
import { FileSystemProjectStore } from '../../infrastructure/persistence/FileSystemProjectStore.js';
import { MarkdownParserService } from './MarkdownParserService.js';
import { CONFIG } from '../../infrastructure/config/index.js';
import { logger } from '../../infrastructure/logger.js';
import { ParseError } from '../../domain/errors/index.js';

export class ProjectService {
  private store: FileSystemProjectStore;
  private parser: MarkdownParserService;

  constructor() {
    this.store = new FileSystemProjectStore(CONFIG.paths.projectsDir);
    this.parser = new MarkdownParserService();
  }

  async listProjects(): Promise<VideoProject[]> {
    const items = await this.store.list();
    return items.filter(p => Array.isArray(p.parts));
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

  async createFromMarkdown(rawMarkdown: string): Promise<VideoProjectEntity> {
    if (!rawMarkdown.trim()) {
      throw new ParseError('Markdown content is empty', 'content');
    }

    let parsed;
    try {
      parsed = this.parser.parse(rawMarkdown);
    } catch (err) {
      if (err instanceof ParseError) throw err;
      throw new ParseError(`Failed to parse markdown: ${(err as Error).message}`);
    }

    const entity = new VideoProjectEntity({
      title: parsed.title,
      rawMarkdown,
      style: parsed.style,
      voiceName: parsed.voiceName,
      durationPerPart: parsed.durationPerPart,
    });

    const project = entity.toJSON();
    project.parts = parsed.parts.map((part, i) => ({
      partIndex: i,
      title: part.title,
      script: part.script,
      keywords: part.keywords,
      images: [],
      ttsPath: null,
      durationSeconds: null,
      status: 'pending' as const,
    }));

    await this.store.save(project);
    logger.info({ projectId: entity.id, parts: project.parts.length }, 'Project created from markdown');
    return entity;
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