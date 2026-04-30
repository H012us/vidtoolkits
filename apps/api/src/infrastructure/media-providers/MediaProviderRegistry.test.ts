import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaProviderRegistry } from './MediaProviderRegistry.js';
import type { IMediaProvider, MediaAsset } from '@vidtoolkits/shared';
import { CacheManager } from '../cache/CacheManager.js';
import { withCacheDir } from '../../__tests__/helpers/tempDir.js';

function makeProvider(overrides: Partial<IMediaProvider> = {}): IMediaProvider {
  return {
    name: 'test-provider',
    priority: 1,
    search: vi.fn(),
    isAvailable: vi.fn(),
    ...overrides,
  } as unknown as IMediaProvider;
}

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'asset-1',
    url: 'https://example.com/img.jpg',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    source: 'pixabay',
    sourceId: '123',
    alt: 'Test image',
    width: 1920,
    height: 1080,
    attribution: 'Test',
    ...overrides,
  };
}

describe('MediaProviderRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sorts providers by priority (lower first)', async () => {
    await withCacheDir(async (dir) => {
      const cache = new CacheManager(dir, 10);
      const p3 = makeProvider({ name: 'third', priority: 3, search: vi.fn(), isAvailable: vi.fn() });
      const p1 = makeProvider({ name: 'first', priority: 1, search: vi.fn(), isAvailable: vi.fn() });
      const p2 = makeProvider({ name: 'second', priority: 2, search: vi.fn(), isAvailable: vi.fn() });

      const registry = new MediaProviderRegistry([p3, p1, p2], cache);
      const providers = registry.getProviders();

      expect(providers.map((p) => p.name)).toEqual(['first', 'second', 'third']);
    });
  });

  it('returns cached result on cache hit', async () => {
    await withCacheDir(async (dir) => {
      const cache = new CacheManager(dir, 10);
      const provider = makeProvider({
        search: vi.fn().mockResolvedValue([makeAsset()]),
        isAvailable: vi.fn().mockResolvedValue(true),
      });

      const registry = new MediaProviderRegistry([provider], cache);
      await registry.search(['sunset'], 5);
      await registry.search(['sunset'], 5);

      expect(provider.search).toHaveBeenCalledTimes(1);
    });
  });

  it('skips unavailable providers', async () => {
    await withCacheDir(async (dir) => {
      const cache = new CacheManager(dir, 10);
      const unavailable = makeProvider({
        name: 'down',
        priority: 1,
        isAvailable: vi.fn().mockResolvedValue(false),
        search: vi.fn(),
      });
      const available = makeProvider({
        name: 'up',
        priority: 2,
        isAvailable: vi.fn().mockResolvedValue(true),
        search: vi.fn().mockResolvedValue([makeAsset()]),
      });

      const registry = new MediaProviderRegistry([unavailable, available], cache);
      const results = await registry.search(['test'], 5);

      expect(available.search).toHaveBeenCalledWith(['test'], 5);
      expect(results).toHaveLength(1);
    });
  });

  it('returns results from first available provider with results', async () => {
    await withCacheDir(async (dir) => {
      const cache = new CacheManager(dir, 10);
      const p1 = makeProvider({
        name: 'p1',
        priority: 1,
        isAvailable: vi.fn().mockResolvedValue(true),
        search: vi.fn().mockResolvedValue([]), // empty
      });
      const p2 = makeProvider({
        name: 'p2',
        priority: 2,
        isAvailable: vi.fn().mockResolvedValue(true),
        search: vi.fn().mockResolvedValue([makeAsset(), makeAsset()]),
      });
      const p3 = makeProvider({
        name: 'p3',
        priority: 3,
        isAvailable: vi.fn().mockResolvedValue(true),
        search: vi.fn().mockResolvedValue([makeAsset()]),
      });

      const registry = new MediaProviderRegistry([p1, p2, p3], cache);
      const results = await registry.search(['beach'], 5);

      expect(results).toHaveLength(2);
      expect(p1.search).toHaveBeenCalled();
      expect(p2.search).toHaveBeenCalled();
      expect(p3.search).not.toHaveBeenCalled();
    });
  });

  it('throws MediaFetchError when all providers fail', async () => {
    await withCacheDir(async (dir) => {
      const cache = new CacheManager(dir, 10);
      const p1 = makeProvider({
        name: 'pixabay',
        isAvailable: vi.fn().mockResolvedValue(true),
        search: vi.fn().mockRejectedValue(new Error('pixabay timeout')),
      });
      const p2 = makeProvider({
        name: 'pexels',
        isAvailable: vi.fn().mockResolvedValue(true),
        search: vi.fn().mockRejectedValue(new Error('pexels rate limit')),
      });

      const registry = new MediaProviderRegistry([p1, p2], cache);
      await expect(registry.search(['mountain'], 5)).rejects.toThrow();
    });
  });

  it('caches results after successful search', async () => {
    await withCacheDir(async (dir) => {
      const cache = new CacheManager(dir, 10);
      const provider = makeProvider({
        isAvailable: vi.fn().mockResolvedValue(true),
        search: vi.fn().mockResolvedValue([makeAsset()]),
      });

      const registry = new MediaProviderRegistry([provider], cache);
      await registry.search(['ocean'], 5);
      await registry.search(['ocean'], 5);

      expect(provider.search).toHaveBeenCalledTimes(1);
    });
  });

  describe('healthCheck', () => {
    it('returns availability status for all providers', async () => {
      await withCacheDir(async (dir) => {
        const cache = new CacheManager(dir, 10);
        const p1 = makeProvider({ name: 'pixabay', isAvailable: vi.fn().mockResolvedValue(true) });
        const p2 = makeProvider({ name: 'pexels', isAvailable: vi.fn().mockResolvedValue(false) });

        const registry = new MediaProviderRegistry([p1, p2], cache);
        const health = await registry.healthCheck();

        expect(health).toEqual({ pixabay: true, pexels: false });
      });
    });

    it('returns false for provider that throws', async () => {
      await withCacheDir(async (dir) => {
        const cache = new CacheManager(dir, 10);
        const p1 = makeProvider({
          name: 'crash',
          isAvailable: vi.fn().mockRejectedValue(new Error('net error')),
        });

        const registry = new MediaProviderRegistry([p1], cache);
        const health = await registry.healthCheck();

        expect(health).toEqual({ crash: false });
      });
    });
  });

  describe('getProviders', () => {
    it('returns a copy of the providers array', async () => {
      await withCacheDir(async (dir) => {
        const cache = new CacheManager(dir, 10);
        const p1 = makeProvider({ name: 'p1' });
        const registry = new MediaProviderRegistry([p1], cache);

        const providers = registry.getProviders();
        providers.push(p1 as any);

        expect(registry.getProviders()).toHaveLength(1);
      });
    });
  });
});
