import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsController } from './SettingsController.js';
import type { SettingsService } from '../../application/services/SettingsService.js';
import { container } from '../../infrastructure/container.js';
import type { Settings } from '@vidtoolkits/shared';

function makeMockResponse() {
  const res: any = {
    json: vi.fn(),
    status: vi.fn(() => res),
  };
  return res;
}

describe('SettingsController', () => {
  let controller: SettingsController;
  let mockService: SettingsService;

  const defaultSettings: Settings = {
    pixabayKey: '',
    pexelsKey: '',
    unsplashKey: '',
    voicePreviewVoice: 'en-US-AriaNeural',
  };

  beforeEach(() => {
    mockService = {
      get: vi.fn(),
      update: vi.fn(),
    } as unknown as SettingsService;
    container.register('SettingsService', mockService as any);
    controller = new SettingsController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('returns 200 with settings', async () => {
      (mockService.get as any).mockResolvedValue(defaultSettings);
      const res = makeMockResponse();
      await controller.get({} as any, res, vi.fn());
      expect(res.json).toHaveBeenCalledWith({ settings: defaultSettings });
    });
  });

  describe('update', () => {
    it('returns 200 with updated settings for valid body', async () => {
      const updated: Settings = { ...defaultSettings, pixabayKey: 'abc' };
      (mockService.update as any).mockResolvedValue(updated);
      const res = makeMockResponse();
      await controller.update({ body: { pixabayKey: 'abc' } } as any, res, vi.fn());
      expect(res.json).toHaveBeenCalledWith({ settings: updated });
    });

    it('returns 400 with INVALID_SETTINGS when Zod validation fails', async () => {
      const res = makeMockResponse();
      const next = vi.fn();
      await controller.update({ body: { pixabayKey: 12345 as any } } as any, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toBe('INVALID_SETTINGS');
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next with error when service throws', async () => {
      const err = new Error('boom');
      (mockService.update as any).mockRejectedValue(err);
      const res = makeMockResponse();
      const next = vi.fn();
      await controller.update({ body: {} } as any, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
