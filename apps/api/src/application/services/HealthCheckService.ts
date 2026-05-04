import axios from 'axios';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import { container } from '../../infrastructure/container.js';
import { CONFIG } from '../../infrastructure/config/index.js';
import type { SettingsService } from './SettingsService.js';
import { PixabayProvider } from '../../infrastructure/media-providers/PixabayProvider.js';
import { PexelsProvider } from '../../infrastructure/media-providers/PexelsProvider.js';
import { UnsplashProvider } from '../../infrastructure/media-providers/UnsplashProvider.js';
import type { IMediaProvider } from '@vidtoolkits/shared';

const execAsync = promisify(exec);

export interface HealthStatus {
  status: 'available' | 'unavailable' | 'not_configured';
  latencyMs?: number;
  message?: string;
}

export interface ProviderHealth {
  name: string;
  configured: boolean;
  available: boolean;
  latencyMs?: number;
  error?: string;
}

export interface BinaryHealth {
  available: boolean;
  version?: string;
  error?: string;
}

export interface RemotionHealth {
  available: boolean;
  error?: string;
}

export interface DetailedHealth {
  voicebox: HealthStatus;
  edgeTts: HealthStatus;
  imageProviders: ProviderHealth[];
  binaries: {
    ffmpeg: BinaryHealth;
    ffprobe: BinaryHealth;
  };
  remotion: RemotionHealth;
  timestamp: string;
}

export class HealthCheckService {
  async check(): Promise<DetailedHealth> {
    const [voicebox, edgeTts, imageProviders, binaries, remotion] = await Promise.all([
      this.checkVoicebox(),
      this.checkEdgeTts(),
      this.checkImageProviders(),
      this.checkBinaries(),
      this.checkRemotion(),
    ]);

    return {
      voicebox,
      edgeTts,
      imageProviders,
      binaries,
      remotion,
      timestamp: new Date().toISOString(),
    };
  }

  async testProvider(providerName: string): Promise<ProviderHealth> {
    const settings = await this.getSettings();
    const keys: Record<string, string | undefined> = {
      pixabay: settings.pixabayKey,
      pexels: settings.pexelsKey,
      unsplash: settings.unsplashKey,
    };
    const key = this.cleanKey(keys[providerName]);
    if (!key) {
      return { name: providerName, configured: false, available: false, error: 'API key not configured' };
    }

    const provider = this.makeProvider(providerName, key);
    const start = Date.now();
    try {
      const available = await provider.isAvailable();
      return { name: providerName, configured: true, available, latencyMs: Date.now() - start };
    } catch (err) {
      return { name: providerName, configured: true, available: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  private async checkVoicebox(): Promise<HealthStatus> {
    const url = CONFIG.voiceboxUrl;
    const start = Date.now();
    try {
      await axios.get(`${url}/profiles`, {
        timeout: 3000,
        headers: { 'X-Voicebox-Client-Id': 'vidtoolkits-api' },
      });
      return { status: 'available', latencyMs: Date.now() - start };
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
        return { status: 'unavailable', message: `Cannot reach Voicebox at ${url}` };
      }
      return { status: 'unavailable', message: msg };
    }
  }

  private async checkEdgeTts(): Promise<HealthStatus> {
    // Edge-TTS is always available (uses Microsoft servers)
    return { status: 'available' };
  }

  private async checkImageProviders(): Promise<ProviderHealth[]> {
    const settings = await this.getSettings();
    const keys: Record<string, string | undefined> = {
      pixabay: settings.pixabayKey,
      pexels: settings.pexelsKey,
      unsplash: settings.unsplashKey,
    };
    const results: ProviderHealth[] = [];

    for (const [name, key] of Object.entries(keys)) {
      const cleanKey = this.cleanKey(key);
      if (!cleanKey) {
        results.push({ name, configured: false, available: false, error: 'API key not configured' });
        continue;
      }

      const provider = this.makeProvider(name, cleanKey);
      const start = Date.now();
      try {
        const available = await provider.isAvailable();
        results.push({ name, configured: true, available, latencyMs: Date.now() - start });
      } catch (err) {
        results.push({ name, configured: true, available: false, latencyMs: Date.now() - start, error: (err as Error).message });
      }
    }

    return results;
  }

  private async getSettings() {
    const settingsService = container.get<SettingsService>('SettingsService');
    return settingsService.get();
  }

  private makeProvider(name: string, key: string): IMediaProvider {
    switch (name) {
      case 'pixabay': return new PixabayProvider(key);
      case 'pexels': return new PexelsProvider(key);
      case 'unsplash': return new UnsplashProvider(key);
      default: throw new Error(`Unknown provider: ${name}`);
    }
  }

  private cleanKey(key: string | undefined): string | undefined {
    return key?.trim() ? key.trim() : undefined;
  }

  private async checkBinaries(): Promise<{ ffmpeg: BinaryHealth; ffprobe: BinaryHealth }> {
    const [ffmpeg, ffprobe] = await Promise.all([
      this.checkBinary('ffmpeg', ['-version']),
      this.checkBinary('ffprobe', ['-version']),
    ]);
    return { ffmpeg, ffprobe };
  }

  private async checkBinary(name: string, args: string[]): Promise<BinaryHealth> {
    try {
      // Resolve the full path via `where` first, so we don't depend on the
      // parent process's PATH (Node may inherit a different PATH than the
      // user's system PATH on Windows).
      const wherePath = await execAsync(`where.exe ${name}`, { timeout: 5000 })
        .then(r => r.stdout.trim().split('\n')[0].trim())
        .catch(() => null);
      const binary = wherePath ?? name;

      const { stdout } = await execAsync(`"${binary}" ${args.join(' ')}`, { timeout: 5000 });
      const versionMatch = stdout.match(/(?:version\s+)?(\d+\.\d+(?:\.\d+)?)/i);
      return {
        available: true,
        version: versionMatch ? versionMatch[1] : undefined,
      };
    } catch (err) {
      const execError = err as NodeJS.ErrnoException;
      const rawMsg = execError.message ?? '';
      let hint = rawMsg;

      // Strip the "Command failed: ..." prefix that exec attaches
      const cmdPrefix = `Command failed: "${name}" ${args.join(' ')}\n`;
      if (rawMsg.startsWith(cmdPrefix)) {
        hint = rawMsg.slice(cmdPrefix.length);
      } else {
        const altPrefix = `Command failed: ${name} ${args.join(' ')}\n`;
        if (rawMsg.startsWith(altPrefix)) {
          hint = rawMsg.slice(altPrefix.length);
        }
      }

      // Clean Windows CLI noise from the error message
      hint = hint
        .replace(/'[^']*' is not recognized as an internal or external command,?\r?\n?/gi, '')
        .replace(/operable program or batch file\.?\r?\n?/gi, '')
        .replace(/\r?\n+/g, ' ')
        .trim();

      if (!hint || hint.length < 3) {
        hint = `${name} not found in PATH. Install it and ensure the directory is in your system PATH.`;
      }

      return {
        available: false,
        error: hint,
      };
    }
  }

  private async checkRemotion(): Promise<RemotionHealth> {
    try {
      const remotionDir = CONFIG.paths.remotionDir;
      const pkgPath = path.join(remotionDir, 'package.json');
      await fs.access(pkgPath);
      return { available: true };
    } catch {
      return { available: false, error: `Remotion directory not found at "${CONFIG.paths.remotionDir}". Ensure the remotion/ folder exists in the project root.` };
    }
  }
}