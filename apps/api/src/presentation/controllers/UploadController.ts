import type { Request, Response, NextFunction } from 'express';
import { container } from '../../infrastructure/container.js';
import type { UploadService } from '../../application/services/UploadService.js';

export class UploadController {
  private get service(): UploadService {
    return container.get<UploadService>('UploadService');
  }

  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No file uploaded' });
        return;
      }

      const result = await this.service.uploadMarkdown(file);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
}