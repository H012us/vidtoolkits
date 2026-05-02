import type { Request, Response, NextFunction } from 'express';
import { container } from '../../infrastructure/container.js';
import type { RenderService } from '../../application/services/RenderService.js';
import type { SSEManager } from '../../presentation/SSE/SSEManager.js';
import { NotFoundError } from '../../domain/errors/index.js';
import path from 'node:path';

export class RenderController {
  private get service(): RenderService {
    return container.get<RenderService>('RenderService');
  }

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const job = await this.service.startRender(id);
      res.status(202).json({ job });
    } catch (err) {
      next(err);
    }
  }

  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const job = await this.service.getJobStatus(id);
      if (!job) throw new NotFoundError('RenderJob', id);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const sseManager = container.get<SSEManager>('SSEManager');
      sseManager.subscribe(id, res);

      req.on('close', () => {
        sseManager.unsubscribe(id, res);
      });
    } catch (err) {
      next(err);
    }
  }

  async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const job = await this.service.getJobStatus(id);
      if (!job) throw new NotFoundError('RenderJob', id);
      if (!job.outputPath) {
        res.status(404).json({ error: 'NOT_READY', message: 'Video not ready for download' });
        return;
      }

      const filename = path.basename(job.outputPath);
      res.download(job.outputPath, filename);
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      await this.service.cancelRender(id);
      res.json({ cancelled: true });
    } catch (err) {
      next(err);
    }
  }
}