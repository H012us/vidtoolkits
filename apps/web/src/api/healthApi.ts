import { api } from './client';

export interface DetailedHealth {
  voicebox: { status: 'available' | 'unavailable' | 'not_configured'; latencyMs?: number; message?: string };
  edgeTts: { status: 'available' | 'unavailable' | 'not_configured'; latencyMs?: number; message?: string };
  imageProviders: Array<{
    name: string;
    configured: boolean;
    available: boolean;
    latencyMs?: number;
    error?: string;
  }>;
  binaries: {
    ffmpeg: { available: boolean; version?: string; error?: string };
    ffprobe: { available: boolean; version?: string; error?: string };
  };
  remotion: { available: boolean; error?: string };
  timestamp: string;
}

export const healthApi = {
  async getDetailed(): Promise<DetailedHealth> {
    const res = await api.get('/health/detailed');
    return res.data;
  },

  async testProvider(providerName: string) {
    const res = await api.post(`/health/test/${providerName}`);
    return res.data;
  },
};