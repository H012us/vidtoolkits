import fs from 'node:fs/promises';
import path from 'node:path';
import type { VideoProject } from '@vidtoolkits/shared';
import { safeDelete } from '../fsUtils.js';

export class FileSystemProjectStore {
  constructor(private readonly projectsDir: string) {}

  async save(project: VideoProject): Promise<void> {
    await fs.mkdir(this.projectsDir, { recursive: true });
    const filePath = this.getPath(project.id);
    await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8');
  }

  async get(id: string): Promise<VideoProject | null> {
    try {
      const filePath = this.getPath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as VideoProject;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async list(): Promise<VideoProject[]> {
    await fs.mkdir(this.projectsDir, { recursive: true });
    let entries;
    try {
      entries = await fs.readdir(this.projectsDir);
    } catch {
      return [];
    }

    const projects: VideoProject[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      try {
        const content = await fs.readFile(path.join(this.projectsDir, entry), 'utf-8');
        projects.push(JSON.parse(content) as VideoProject);
      } catch {
        // skip invalid files
      }
    }

    return projects.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async delete(id: string): Promise<void> {
    await safeDelete(this.getPath(id));
  }

  private getPath(id: string): string {
    return path.join(this.projectsDir, `${id}.json`);
  }
}