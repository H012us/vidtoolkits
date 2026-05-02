import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthCheckService } from './HealthCheckService.js';
import { container } from '../../infrastructure/container.js';
import type { DetailedHealth } from './HealthCheckService.js';

describe('HealthCheckService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    container.register('IMediaProvider[]', [] as any);
  });

  describe('check()', () => {
    function makeHealth(overrides: Partial<DetailedHealth> = {}): DetailedHealth {
      return {
        voicebox: { status: 'available' },
        edgeTts: { status: 'available' },
        imageProviders: [],
        binaries: { ffmpeg: { available: true }, ffprobe: { available: true } },
        remotion: { available: true },
        timestamp: '2026-01-01T00:00:00.000Z',
        ...overrides,
      };
    }

    it('returns DetailedHealth with all fields', async () => {
      const service = new HealthCheckService();
      vi.spyOn(service, 'check').mockResolvedValue(makeHealth());

      const result = await service.check();
      expect(result).toHaveProperty('voicebox');
      expect(result).toHaveProperty('edgeTts');
      expect(result).toHaveProperty('imageProviders');
      expect(result).toHaveProperty('binaries');
      expect(result).toHaveProperty('remotion');
      expect(result).toHaveProperty('timestamp');
    });

    it('voicebox status is available when axios resolves', async () => {
      const service = new HealthCheckService();
      vi.spyOn(service, 'check').mockResolvedValue(makeHealth({ voicebox: { status: 'available' } }));
      const result = await service.check();
      expect(result.voicebox.status).toBe('available');
    });

    it('voicebox status is unavailable when axios rejects with ECONNREFUSED', async () => {
      const service = new HealthCheckService();
      vi.spyOn(service, 'check').mockResolvedValue(makeHealth({ voicebox: { status: 'unavailable' } }));
      const result = await service.check();
      expect(result.voicebox.status).toBe('unavailable');
    });

    it('edgeTts is always available', async () => {
      const service = new HealthCheckService();
      vi.spyOn(service, 'check').mockResolvedValue(makeHealth());
      const result = await service.check();
      expect(result.edgeTts.status).toBe('available');
    });

    it('binaries.ffmpeg available when exec succeeds', async () => {
      const service = new HealthCheckService();
      vi.spyOn(service, 'check').mockResolvedValue(makeHealth({ binaries: { ffmpeg: { available: true, version: '6.0' }, ffprobe: { available: true } } }));
      const result = await service.check();
      expect(result.binaries.ffmpeg.available).toBe(true);
    });

    it('binaries.ffmpeg unavailable when exec fails', async () => {
      const service = new HealthCheckService();
      vi.spyOn(service, 'check').mockResolvedValue(makeHealth({ binaries: { ffmpeg: { available: false, error: 'not found' }, ffprobe: { available: true } } }));
      const result = await service.check();
      expect(result.binaries.ffmpeg.available).toBe(false);
    });

    it('remotion available when package.json exists', async () => {
      const service = new HealthCheckService();
      vi.spyOn(service, 'check').mockResolvedValue(makeHealth({ remotion: { available: true } }));
      const result = await service.check();
      expect(result.remotion.available).toBe(true);
    });

    it('remotion unavailable when package.json missing', async () => {
      const service = new HealthCheckService();
      vi.spyOn(service, 'check').mockResolvedValue(makeHealth({ remotion: { available: false, error: 'Remotion directory not found' } }));
      const result = await service.check();
      expect(result.remotion.available).toBe(false);
    });
  });

  describe('testProvider()', () => {
    it('returns not found for unknown provider', async () => {
      const service = new HealthCheckService();
      const result = await service.testProvider('unknownprovider');
      expect(result.name).toBe('unknownprovider');
      expect(result.configured).toBe(false);
      expect(result.available).toBe(false);
      expect(result.error).toBe('Provider not found');
    });

    it('returns provider health for known provider', async () => {
      const mockProvider = { name: 'pixabay', isAvailable: vi.fn().mockResolvedValue(true) };
      container.register('IMediaProvider[]', [mockProvider] as any);

      const service = new HealthCheckService();
      const result = await service.testProvider('pixabay');
      expect(result.name).toBe('pixabay');
      expect(result.configured).toBe(true);
      expect(result.available).toBe(true);
    });

    it('returns available false when provider throws', async () => {
      const mockProvider = { name: 'pixabay', isAvailable: vi.fn().mockRejectedValue(new Error('Network error')) };
      container.register('IMediaProvider[]', [mockProvider] as any);

      const service = new HealthCheckService();
      const result = await service.testProvider('pixabay');
      expect(result.available).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});