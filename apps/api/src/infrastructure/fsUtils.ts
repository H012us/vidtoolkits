import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG } from './config/index.js';
import { logger } from './logger.js';

export async function ensureDirectories(): Promise<void> {
  const dirs = [
    CONFIG.paths.dataDir,
    CONFIG.paths.outputDir,
    CONFIG.paths.tempDir,
    CONFIG.paths.cacheDir,
    CONFIG.paths.projectsDir,
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Cleanup old temp files on startup
  cleanupTempDir().catch(err => logger.warn({ err }, 'Temp cleanup failed on startup'));
}

async function cleanupTempDir(): Promise<void> {
  const tempDir = CONFIG.paths.tempDir;
  let entries;
  try {
    entries = await fs.readdir(tempDir);
  } catch {
    return;
  }

  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  let cleaned = 0;

  for (const entry of entries) {
    const fullPath = path.join(tempDir, entry);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory() && stat.mtimeMs < oneHourAgo) {
        await fs.rm(fullPath, { recursive: true, force: true });
        cleaned++;
      }
    } catch {
      // ignore
    }
  }

  if (cleaned > 0) {
    logger.info({ cleaned }, 'Cleaned up old temp directories');
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function safeDelete(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
}

export async function safeRmDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
}