import type { Request, Response, NextFunction } from 'express';
import { container } from '../../infrastructure/container.js';
import type { SettingsService } from '../../application/services/SettingsService.js';
import { SettingsSchema } from '@vidtoolkits/shared';

export class SettingsController {
  private get service(): SettingsService {
    return container.get<SettingsService>('SettingsService');
  }

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await this.service.get();
      res.json({ settings });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parse = SettingsSchema.partial().safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: 'INVALID_SETTINGS', message: parse.error.message });
        return;
      }
      const updated = await this.service.update(parse.data);
      res.json({ settings: updated });
    } catch (err) {
      next(err);
    }
  }
}