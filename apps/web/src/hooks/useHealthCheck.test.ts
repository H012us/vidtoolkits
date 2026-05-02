import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHealthCheck } from './useHealthCheck';

vi.mock('../api/healthApi', () => ({
  healthApi: {
    getDetailed: vi.fn(),
  },
}));

const mockDetailedHealth = {
  voicebox: { status: 'available' as const, latencyMs: 12 },
  edgeTts: { status: 'available' as const },
  imageProviders: [{ name: 'pixabay', configured: true, available: true }],
  binaries: { ffmpeg: { available: true, version: '6.0' }, ffprobe: { available: true } },
  remotion: { available: true },
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('useHealthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets health data on successful mount', async () => {
    const { healthApi } = await import('../api/healthApi');
    (healthApi.getDetailed as any).mockResolvedValue(mockDetailedHealth);

    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.health).toEqual(mockDetailedHealth);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('sets error on failed mount', async () => {
    const { healthApi } = await import('../api/healthApi');
    (healthApi.getDetailed as any).mockRejectedValue(new Error('Connection refused'));

    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.health).toBeNull();
    expect(result.current.error).toBe('Connection refused');
    expect(result.current.loading).toBe(false);
  });

  it('refresh() resolves and updates health', async () => {
    const { healthApi } = await import('../api/healthApi');
    (healthApi.getDetailed as any).mockResolvedValue(mockDetailedHealth);

    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    const updatedHealth = { ...mockDetailedHealth, timestamp: '2026-01-02T00:00:00.000Z' };
    (healthApi.getDetailed as any).mockResolvedValue(updatedHealth);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.health).toEqual(updatedHealth);
    expect(result.current.error).toBeNull();
  });

  it('refresh() rejects and leaves health unchanged', async () => {
    const { healthApi } = await import('../api/healthApi');
    (healthApi.getDetailed as any).mockResolvedValue(mockDetailedHealth);

    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    (healthApi.getDetailed as any).mockRejectedValue(new Error('Network error'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.health).toEqual(mockDetailedHealth);
    expect(result.current.error).toBe('Network error');
  });

  it('loading is true after calling refresh and before it resolves', async () => {
    let resolveHealth: (v: any) => void;
    const { healthApi } = await import('../api/healthApi');
    (healthApi.getDetailed as any).mockImplementation(() => new Promise(r => { resolveHealth = r; }));

    const { result } = renderHook(() => useHealthCheck());

    act(() => {
      result.current.refresh();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveHealth(mockDetailedHealth);
    });

    expect(result.current.loading).toBe(false);
  });
});
