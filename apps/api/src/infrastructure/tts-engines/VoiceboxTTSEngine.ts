import axios from 'axios';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ITTSEngine, TTSResult, Voice } from '@vidtoolkits/shared';
import { VOICEBOX_BASE_URL } from '@vidtoolkits/shared';
import { TTSError } from '../../domain/errors/index.js';
import { logger } from '../../infrastructure/logger.js';
import { ensureDir } from '../../infrastructure/fsUtils.js';

export class VoiceboxTTSEngine implements ITTSEngine {
  readonly name = 'voicebox';
  readonly priority = 1;

  constructor(private readonly baseUrl: string = VOICEBOX_BASE_URL) {}

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/profiles`, {
        timeout: 3000,
        headers: { 'X-Voicebox-Client-Id': 'vidtoolkits-api' },
      });
      return true;
    } catch {
      return false;
    }
  }

  async generate(text: string, outputPath: string, voice?: string): Promise<TTSResult> {
    await ensureDir(path.dirname(outputPath));

    const profileId = voice ?? 'default';

    try {
      const response = await axios.post(
        `${this.baseUrl}/generate`,
        {
          text,
          profile_id: profileId,
          language: 'en',
        },
        {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json',
            'X-Voicebox-Client-Id': 'vidtoolkits-api',
          },
        }
      );

      await fs.writeFile(outputPath, Buffer.from(response.data));

      const durationSeconds = await this.measureDuration(outputPath);

      logger.info({ textLength: text.length, voice: profileId, outputPath }, 'Voicebox TTS generated');
      return { path: outputPath, durationSeconds, voice: profileId, engine: this.name };
    } catch (err) {
      throw new TTSError(`Voicebox failed: ${(err as Error).message}`, this.name);
    }
  }

  async getAvailableVoices(): Promise<Voice[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/profiles`, {
        timeout: 5000,
        headers: { 'X-Voicebox-Client-Id': 'vidtoolkits-api' },
      });
      const profiles = response.data?.profiles ?? [];
      return profiles.map((p: { id: string; name: string; language?: string }) => ({
        id: p.id,
        name: p.name,
        language: p.language ?? 'en',
        engine: this.name,
      }));
    } catch {
      return [];
    }
  }

  private async measureDuration(filePath: string): Promise<number> {
    // Will use ffprobe later; for now estimate 150 chars/min
    const stats = await fs.stat(filePath);
    return Math.max(1, stats.size / 16000);
  }
}