import { LRUCache } from 'lru-cache';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { logger } from '../logger.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CacheManager {
  private memoryCache: LRUCache<string, CacheEntry<unknown>>;
  private readonly diskCacheDir: string;
  private readonly maxDiskBytes: number;
  private readonly memoryTTLMs: number;

  constructor(cacheDir: string, maxDiskMB: number) {
    this.diskCacheDir = cacheDir;
    this.maxDiskBytes = maxDiskMB * 1024 * 1024;
    this.memoryTTLMs = 60 * 60 * 1000; // 1 hour

    this.memoryCache = new LRUCache({
      max: 500,
      ttl: this.memoryTTLMs,
      updateAgeOnGet: false,
    });

    this.initDiskCache();
  }

  private async initDiskCache(): Promise<void> {
    await fs.mkdir(this.diskCacheDir, { recursive: true });
    await this.cleanupDiskCache();
  }

  async get<T>(key: string): Promise<T | null> {
    const memEntry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memEntry) {
      if (memEntry.expiresAt > Date.now()) return memEntry.data;
      this.memoryCache.delete(key);
    }

    const diskKey = this.hashKey(key);
    const diskPath = path.join(this.diskCacheDir, `${diskKey}.json`);
    try {
      const content = await fs.readFile(diskPath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);
      if (entry.expiresAt > Date.now()) {
        this.memoryCache.set(key, entry);
        return entry.data;
      }
      await fs.unlink(diskPath);
    } catch {
      // cache miss
    }

    return null;
  }

  async set<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    const expiresAt = Date.now() + (ttlMs ?? this.memoryTTLMs);
    const entry: CacheEntry<T> = { data, expiresAt };

    this.memoryCache.set(key, entry);

    const diskKey = this.hashKey(key);
    const diskPath = path.join(this.diskCacheDir, `${diskKey}.json`);
    try {
      await fs.writeFile(diskPath, JSON.stringify(entry), 'utf-8');
    } catch (err) {
      logger.warn({ err, key }, 'Failed to write disk cache');
    }
  }

  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) this.memoryCache.delete(key);
    }

    let entries;
    try {
      entries = await fs.readdir(this.diskCacheDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (regex.test(entry)) {
        await fs.unlink(path.join(this.diskCacheDir, entry)).catch(() => {});
      }
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    let entries;
    try {
      entries = await fs.readdir(this.diskCacheDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      await fs.unlink(path.join(this.diskCacheDir, entry)).catch(() => {});
    }
    logger.info({}, 'Cache cleared');
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
  }

  private async cleanupDiskCache(): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(this.diskCacheDir);
    } catch {
      return;
    }

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let totalSize = 0;
    const files: { path: string; mtime: number; size: number }[] = [];

    for (const entry of entries) {
      const fullPath = path.join(this.diskCacheDir, entry);
      try {
        const stat = await fs.stat(fullPath);
        files.push({ path: fullPath, mtime: stat.mtimeMs, size: stat.size });
        totalSize += stat.size;
      } catch {
        // skip
      }
    }

    for (const file of files) {
      if (now - file.mtime > sevenDaysMs || totalSize > this.maxDiskBytes) {
        await fs.unlink(file.path).catch(() => {});
        totalSize -= file.size;
      }
    }
  }
}