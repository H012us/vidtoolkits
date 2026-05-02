import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { healthApi } from './healthApi';

vi.mock('axios');
const mockedAxios = axios as unknown as { [k: string]: ReturnType<typeof vi.fn> };

const mockDetailedHealth = {
  voicebox: { status: 'available' as const, latencyMs: 12 },
  edgeTts: { status: 'available' as const },
  imageProviders: [{ name: 'pixabay', configured: true, available: true }],
  binaries: { ffmpeg: { available: true, version: '6.0' }, ffprobe: { available: true } },
  remotion: { available: true },
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('healthApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getDetailed() resolves and returns health data', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: mockDetailedHealth });
    const result = await healthApi.getDetailed();
    expect(result).toEqual(mockDetailedHealth);
    expect(mockedAxios.get).toHaveBeenCalledWith('/health/detailed');
  });

  it('getDetailed() rejects and propagates error', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(new Error('Connection refused'));
    await expect(healthApi.getDetailed()).rejects.toThrow('Connection refused');
  });

  it('testProvider() resolves and returns provider health', async () => {
    const providerHealth = { name: 'pixabay', configured: true, available: true, latencyMs: 15 };
    mockedAxios.post = vi.fn().mockResolvedValue({ data: providerHealth });
    const result = await healthApi.testProvider('pixabay');
    expect(result).toEqual(providerHealth);
    expect(mockedAxios.post).toHaveBeenCalledWith('/health/test/pixabay');
  });

  it('testProvider() rejects and propagates error', async () => {
    mockedAxios.post = vi.fn().mockRejectedValue(new Error('Request failed'));
    await expect(healthApi.testProvider('pixabay')).rejects.toThrow('Request failed');
  });
});
