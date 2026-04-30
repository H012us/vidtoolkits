import axios from 'axios';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import { container } from '../../infrastructure/container.js';
import { CONFIG } from '../../infrastructure/config/index.js';

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
    const providers = container.getMediaProviders();
    const provider = providers.find(p => p.name === providerName);
    if (!provider) {
      return { name: providerName, configured: false, available: false, error: 'Provider not found' };
    }

    const start = Date.now();
    try {
      const available = await provider.isAvailable();
      return {
        name: providerName,
        configured: true,
        available,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        name: providerName,
        configured: true,
        available: false,
        latencyMs: Date.now() - start,
        error: (err as Error).message,
      };
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
    const providers = container.getMediaProviders();
    const results: ProviderHealth[] = [];

    for (const provider of providers) {
      const start = Date.now();
      try {
        const available = await provider.isAvailable();
        results.push({
          name: provider.name,
          configured: true,
          available,
          latencyMs: Date.now() - start,
        });
      } catch (err) {
        results.push({
          name: provider.name,
          configured: true,
          available: false,
          latencyMs: Date.now() - start,
          error: (err as Error).message,
        });
      }
    }

    // Add providers that are registered but not configured
    const configuredNames = new Set(results.map(r => r.name));
    const envKeys: Array<[string, string | undefined]> = [
      ['pixabay', CONFIG.imageProviders.pixabayKey],
      ['pexels', CONFIG.imageProviders.pexelsKey],
      ['unsplash', CONFIG.imageProviders.unsplashKey],
    ];
    for (const [name, key] of envKeys) {
      if (!configuredNames.has(name)) {
        if (key) {
          results.push({ name, configured: true, available: false });
        } else {
          results.push({ name, configured: false, available: false, error: 'Not configured' });
        }
      }
    }

    return results;
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
      const { stdout } = await execAsync(`${name} ${args.join(' ')}`, { timeout: 5000 });
      const versionMatch = stdout.match(/(?:version\s+)?(\d+\.\d+(?:\.\d+)?)/i);
      return {
        available: true,
        version: versionMatch ? versionMatch[1] : undefined,
      };
    } catch (err) {
      return {
        available: false,
        error: (err as Error).message,
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
      return { available: false, error: 'Remotion directory not found' };
    }
  }
}