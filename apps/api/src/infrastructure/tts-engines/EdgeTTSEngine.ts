import { MsEdgeTTS } from 'edge-tts-node';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ITTSEngine, TTSResult, Voice } from '@vidtoolkits/shared';
import { DEFAULT_VOICE } from '@vidtoolkits/shared';
import { TTSError } from '../../domain/errors/index.js';
import { logger } from '../../infrastructure/logger.js';
import { ensureDir } from '../../infrastructure/fsUtils.js';

export class EdgeTTSEngine implements ITTSEngine {
  readonly name = 'edge-tts';
  readonly priority = 2;

  private tts: MsEdgeTTS;

  constructor() {
    this.tts = new MsEdgeTTS({ enableLogger: false });
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate(text: string, outputPath: string, voice?: string): Promise<TTSResult> {
    await ensureDir(path.dirname(outputPath));

    const voiceName = voice ?? DEFAULT_VOICE;

    try {
      await this.tts.toFile(outputPath, text, { pitch: '+0Hz', rate: '+0%', volume: '+0%' });

      const durationSeconds = await this.measureDuration(outputPath);

      logger.info({ textLength: text.length, voice: voiceName, outputPath }, 'Edge-TTS generated');
      return { path: outputPath, durationSeconds, voice: voiceName, engine: this.name };
    } catch (err) {
      throw new TTSError(`Edge-TTS failed: ${(err as Error).message}`, this.name);
    }
  }

  async getAvailableVoices(): Promise<Voice[]> {
    try {
      const voices = await this.tts.getVoices();
      return (voices ?? []).map((v) => ({
        id: v.ShortName,
        name: v.Name,
        language: v.Locale,
        gender: v.Gender,
        engine: this.name,
      }));
    } catch {
      return [];
    }
  }

  private async measureDuration(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return Math.max(1, stats.size / 16000);
  }
}