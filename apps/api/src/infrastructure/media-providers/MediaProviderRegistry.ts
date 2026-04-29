import type { IMediaProvider, MediaAsset } from '@vidtoolkits/shared';
import { CacheManager } from '../cache/CacheManager.js';
import { MediaFetchError } from '../../domain/errors/index.js';
import { logger } from '../logger.js';

export class MediaProviderRegistry {
  constructor(
    private readonly providers: IMediaProvider[],
    private readonly cache: CacheManager
  ) {
    providers.sort((a, b) => a.priority - b.priority);
  }

  async search(keywords: string[], count = 5): Promise<MediaAsset[]> {
    const cacheKey = `images:${keywords.slice().sort().join(',')}:${count}`;

    const cached = await this.cache.get<MediaAsset[]>(cacheKey);
    if (cached) return cached;

    const errors: string[] = [];

    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        if (!available) {
          logger.debug({ provider: provider.name }, 'Provider not available, skipping');
          continue;
        }

        const results = await provider.search(keywords, count);
        if (results.length > 0) {
          logger.info({ provider: provider.name, count: results.length, keywords }, 'Images fetched');
          await this.cache.set(cacheKey, results);
          return results;
        }
      } catch (err) {
        const msg = `${provider.name}: ${(err as Error).message}`;
        errors.push(msg);
        logger.warn({ err, provider: provider.name }, 'Provider search failed, trying next');
      }
    }

    throw new MediaFetchError(
      `All image providers failed: ${errors.join('; ')}`,
      'media-providers'
    );
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    for (const provider of this.providers) {
      try {
        result[provider.name] = await provider.isAvailable();
      } catch {
        result[provider.name] = false;
      }
    }
    return result;
  }

  getProviders(): IMediaProvider[] {
    return [...this.providers];
  }
}