import fs from 'node:fs/promises';
import path from 'node:path';
import type { RenderJob } from '@vidtoolkits/shared';

export class RenderJobStore {
  constructor(private readonly jobsDir: string) {}

  async save(job: RenderJob): Promise<void> {
    await fs.mkdir(this.jobsDir, { recursive: true });
    const filePath = this.getPath(job.id);
    await fs.writeFile(filePath, JSON.stringify(job, null, 2), 'utf-8');
  }

  async get(id: string): Promise<RenderJob | null> {
    try {
      const filePath = this.getPath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as RenderJob;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async getByProjectId(projectId: string): Promise<RenderJob | null> {
    await fs.mkdir(this.jobsDir, { recursive: true });
    let entries;
    try {
      entries = await fs.readdir(this.jobsDir);
    } catch {
      return null;
    }

    let latest: RenderJob | null = null;
    let latestTime = 0;

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      try {
        const content = await fs.readFile(path.join(this.jobsDir, entry), 'utf-8');
        const job = JSON.parse(content) as RenderJob;
        if (job.projectId === projectId && new Date(job.startedAt).getTime() > latestTime) {
          latest = job;
          latestTime = new Date(job.startedAt).getTime();
        }
      } catch {
        // skip
      }
    }

    return latest;
  }

  private getPath(id: string): string {
    return path.join(this.jobsDir, `${id}.json`);
  }
}