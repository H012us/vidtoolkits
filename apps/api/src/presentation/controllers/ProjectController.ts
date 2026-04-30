import type { Request, Response, NextFunction } from 'express';
import { container } from '../../infrastructure/container.js';
import { NotFoundError } from '../../domain/errors/index.js';
import type { ProjectService } from '../../application/services/ProjectService.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';

export class ProjectController {
  private get service(): ProjectService {
    return container.get<ProjectService>('ProjectService');
  }

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projects = await this.service.listProjects();
      res.json({ projects });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const project = await this.service.getProject(id);
      if (!project) throw new NotFoundError('Project', id);
      res.json({ project });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const project = await this.service.updateProject(id, req.body);
      if (!project) throw new NotFoundError('Project', id);
      res.json({ project });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      await this.service.deleteProject(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async fromTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parse = z.object({ markdown: z.string().min(1) }).safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: 'INVALID_REQUEST', message: 'markdown field is required' });
        return;
      }
      const entity = await this.service.createFromMarkdown(parse.data.markdown);
      res.status(201).json({ project: entity.toJSON() });
    } catch (err) {
      next(err);
    }
  }
}