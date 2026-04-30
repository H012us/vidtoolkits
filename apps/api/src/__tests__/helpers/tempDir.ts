import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtoolkits-test-'));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function withProjectsDir(fn: (dir: string) => Promise<void>): Promise<void> {
  return withTempDir(async (dir) => {
    const projectsDir = path.join(dir, 'projects');
    await fs.mkdir(projectsDir, { recursive: true });
    await fn(projectsDir);
  });
}

export async function withCacheDir(fn: (dir: string) => Promise<void>): Promise<void> {
  return withTempDir(async (dir) => {
    const cacheDir = path.join(dir, 'cache');
    await fs.mkdir(cacheDir, { recursive: true });
    await fn(cacheDir);
  });
}

export async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'vidtoolkits-test-'));
}
