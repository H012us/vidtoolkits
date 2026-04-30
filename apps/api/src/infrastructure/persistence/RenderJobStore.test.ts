import { describe, it, expect } from 'vitest';
import { RenderJobStore } from './RenderJobStore.js';
import type { RenderJob } from '@vidtoolkits/shared';
import { withTempDir } from '../../__tests__/helpers/tempDir.js';
import { makeRenderJob } from '../../__tests__/helpers/factories.js';

describe('RenderJobStore', () => {
  describe('save / get', () => {
    it('saves and retrieves a job', async () => {
      await withTempDir(async (dir) => {
        const store = new RenderJobStore(dir);
        const job = makeRenderJob({ id: 'job-save-1', projectId: 'proj-1' });
        await store.save(job);

        const retrieved = await store.get('job-save-1');
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe('job-save-1');
        expect(retrieved!.projectId).toBe('proj-1');
        expect(retrieved!.status).toBe('queued');
      });
    });

    it('returns null on ENOENT', async () => {
      await withTempDir(async (dir) => {
        const store = new RenderJobStore(dir);
        const result = await store.get('ghost');
        expect(result).toBeNull();
      });
    });

    it('overwrites job with same ID', async () => {
      await withTempDir(async (dir) => {
        const store = new RenderJobStore(dir);
        const j1 = makeRenderJob({ id: 'job-ow', projectId: 'p1' });
        const j2 = makeRenderJob({ id: 'job-ow', projectId: 'p1', status: 'running' });
        await store.save(j1);
        await store.save(j2);

        const retrieved = await store.get('job-ow');
        expect(retrieved!.status).toBe('running');
      });
    });
  });

  describe('getByProjectId', () => {
    it('returns null when no jobs exist', async () => {
      await withTempDir(async (dir) => {
        const store = new RenderJobStore(dir);
        const result = await store.getByProjectId('proj-none');
        expect(result).toBeNull();
      });
    });

    it('returns the job with latest startedAt', async () => {
      await withTempDir(async (dir) => {
        const store = new RenderJobStore(dir);
        const early = makeRenderJob({ id: 'early-job', projectId: 'proj-timeline', startedAt: '2024-01-01T00:00:00.000Z' });
        const late = makeRenderJob({ id: 'late-job', projectId: 'proj-timeline', startedAt: '2024-02-01T00:00:00.000Z' });
        const mid = makeRenderJob({ id: 'mid-job', projectId: 'proj-timeline', startedAt: '2024-01-15T00:00:00.000Z' });

        await store.save(early);
        await store.save(late);
        await store.save(mid);

        const result = await store.getByProjectId('proj-timeline');
        expect(result!.id).toBe('late-job');
      });
    });

    it('ignores jobs for other projects', async () => {
      await withTempDir(async (dir) => {
        const store = new RenderJobStore(dir);
        await store.save(makeRenderJob({ id: 'job-a', projectId: 'proj-A', startedAt: '2024-02-01T00:00:00.000Z' }));
        await store.save(makeRenderJob({ id: 'job-b', projectId: 'proj-B', startedAt: '2024-01-01T00:00:00.000Z' }));

        const result = await store.getByProjectId('proj-B');
        expect(result!.id).toBe('job-b');
      });
    });

    it('skips non-.json files', async () => {
      await withTempDir(async (dir) => {
        const store = new RenderJobStore(dir);
        const fs = await import('node:fs/promises');
        await fs.writeFile(`${dir}/readme.txt`, 'hello', 'utf-8');
        await fs.writeFile(`${dir}/job-good.json`, JSON.stringify(makeRenderJob({ id: 'good-job', projectId: 'proj-g' })), 'utf-8');

        const result = await store.getByProjectId('proj-g');
        expect(result!.id).toBe('good-job');
      });
    });
  });
});
