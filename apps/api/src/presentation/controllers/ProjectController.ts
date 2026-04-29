import type { Request, Response, NextFunction } from 'express';
import { container } from '../../infrastructure/container.js';
import { NotFoundError } from '../../domain/errors/index.js';
import type { ProjectService } from '../../application/services/ProjectService.js';

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
}