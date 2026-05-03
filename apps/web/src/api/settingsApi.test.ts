import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settingsApi } from './settingsApi';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));
import { api } from './client';

describe('settingsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get() resolves and returns settings', async () => {
    const mockSettings = { pixabayKey: 'abc', pexelsKey: '', unsplashKey: '', voicePreviewVoice: 'en-US-AriaNeural' };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { settings: mockSettings } });

    const result = await settingsApi.get();
    expect(result).toEqual(mockSettings);
    expect(api.get).toHaveBeenCalledWith('/settings');
  });

  it('update() resolves and returns updated settings', async () => {
    const updated = { pixabayKey: 'xyz', pexelsKey: '', unsplashKey: '', voicePreviewVoice: 'en-US-AriaNeural' };
    (api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { settings: updated } });

    const result = await settingsApi.update({ pixabayKey: 'xyz' });
    expect(result).toEqual(updated);
    expect(api.patch).toHaveBeenCalledWith('/settings', { pixabayKey: 'xyz' });
  });

  it('get() rejects and propagates error', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    await expect(settingsApi.get()).rejects.toThrow('Network error');
  });

  it('update() rejects and propagates error', async () => {
    (api.patch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));
    await expect(settingsApi.update({})).rejects.toThrow('Server error');
  });
});
