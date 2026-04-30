import fs from 'node:fs/promises';
import path from 'node:path';
import { SettingsSchema } from '@vidtoolkits/shared';
import { logger } from '../../infrastructure/logger.js';
import type { Settings } from '@vidtoolkits/shared';

export class SettingsService {
  private readonly settingsPath: string;

  constructor(dataDir: string) {
    this.settingsPath = path.join(dataDir, 'settings.json');
  }

  async get(): Promise<Settings> {
    try {
      const raw = await fs.readFile(this.settingsPath, 'utf-8');
      const data = JSON.parse(raw);
      return SettingsSchema.parse(data);
    } catch {
      return { pixabayKey: '', pexelsKey: '', unsplashKey: '', voicePreviewVoice: 'en-US-AriaNeural' };
    }
  }

  async update(updates: Partial<Settings>): Promise<Settings> {
    const current = await this.get();
    const updated = { ...current, ...updates };
    await fs.writeFile(this.settingsPath, JSON.stringify(updated, null, 2), 'utf-8');
    logger.info({ updates: Object.keys(updates) }, 'Settings updated');
    return updated;
  }
}