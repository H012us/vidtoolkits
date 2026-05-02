import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { settingsApi } from './settingsApi';

vi.mock('axios');
const mockedAxios = axios as unknown as { [k: string]: ReturnType<typeof vi.fn> };

describe('settingsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get() resolves and returns settings', async () => {
    const mockSettings = { pixabayKey: 'abc', pexelsKey: '', unsplashKey: '', voicePreviewVoice: 'en-US-AriaNeural' };
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { settings: mockSettings } });

    const result = await settingsApi.get();
    expect(result).toEqual(mockSettings);
    expect(mockedAxios.get).toHaveBeenCalledWith('/settings');
  });

  it('update() resolves and returns updated settings', async () => {
    const updated = { pixabayKey: 'xyz', pexelsKey: '', unsplashKey: '', voicePreviewVoice: 'en-US-AriaNeural' };
    mockedAxios.patch = vi.fn().mockResolvedValue({ data: { settings: updated } });

    const result = await settingsApi.update({ pixabayKey: 'xyz' });
    expect(result).toEqual(updated);
    expect(mockedAxios.patch).toHaveBeenCalledWith('/settings', { pixabayKey: 'xyz' });
  });

  it('get() rejects and propagates error', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(settingsApi.get()).rejects.toThrow('Network error');
  });

  it('update() rejects and propagates error', async () => {
    mockedAxios.patch = vi.fn().mockRejectedValue(new Error('Server error'));
    await expect(settingsApi.update({})).rejects.toThrow('Server error');
  });
});
