interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination: string;
  filename: string;
  path: string;
}
import { MarkdownParserService } from './MarkdownParserService.js';
import { ProjectService } from './ProjectService.js';
import { ParseError, ValidationError } from '../../domain/errors/index.js';
import { logger } from '../../infrastructure/logger.js';
import { CONFIG } from '../../infrastructure/config/index.js';
import type { VideoProject } from '@vidtoolkits/shared';

export class UploadService {
  private parser: MarkdownParserService;
  private projectService: ProjectService;

  constructor() {
    this.parser = new MarkdownParserService();
    this.projectService = new ProjectService();
  }

  async uploadMarkdown(file: UploadedFile): Promise<{ project: VideoProject }> {
    const maxSize = CONFIG.limits.maxMdSizeKB * 1024;
    if (file.size > maxSize) {
      throw new ValidationError(
        `File size exceeds maximum of ${CONFIG.limits.maxMdSizeKB}KB`,
        'file'
      );
    }

    const content = file.buffer.toString('utf-8');

    if (content.length === 0) {
      throw new ParseError('File is empty', 'content');
    }

    let parsed;
    try {
      parsed = this.parser.parse(content);
    } catch (err) {
      if (err instanceof ParseError) throw err;
      throw new ParseError(`Failed to parse markdown: ${(err as Error).message}`);
    }

    const entity = await this.projectService.createProject({
      title: parsed.title,
      rawMarkdown: content,
      style: parsed.style,
      voiceName: parsed.voiceName,
      durationPerPart: parsed.durationPerPart,
    });

    // Patch parts onto the project
    const project = entity.toJSON();
    project.parts = parsed.parts.map((part, i) => ({
      partIndex: i,
      title: part.title,
      script: part.script,
      keywords: part.keywords,
      images: [],
      ttsPath: null,
      durationSeconds: null,
      status: 'pending',
    }));

    logger.info({ projectId: entity.id, parts: project.parts.length }, 'Markdown parsed and project created');
    return { project };
  }
}