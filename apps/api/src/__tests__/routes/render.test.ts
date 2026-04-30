import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../app.js';
import { container } from '../../infrastructure/container.js';
import { FileSystemProjectStore } from '../../infrastructure/persistence/FileSystemProjectStore.js';
import { RenderJobStore } from '../../infrastructure/persistence/RenderJobStore.js';
import { ProjectService } from '../../application/services/ProjectService.js';
import { SSEManager } from '../../presentation/SSE/SSEManager.js';
import { createTempDir } from '../helpers/tempDir.js';

vi.mock('../../application/services/RenderService.js', () => ({
  RenderService: vi.fn(),
}));

describe('UAT: Render endpoint', () => {

  let tempDir: string;
  let app: ReturnType<typeof createTestApp>;
  let projectId: string;

  beforeAll(async () => {
    tempDir = await createTempDir();
    const projectsDir = `${tempDir}/projects`;
    const jobsDir = `${tempDir}/jobs`;

    const projectStore = new FileSystemProjectStore(projectsDir);
    const jobStore = new RenderJobStore(jobsDir);

    const mockProjectService = Object.assign(new ProjectService(), {
      store: projectStore,
      getProject: async (id: string) => projectStore.get(id),
    } as any);

    const mockRenderService: any = {
      async startRender(pid: string) {
        const { NotFoundError, ConflictError } = await import('../../domain/errors/index.js');
        const project = await projectStore.get(pid);
        if (!project) throw new NotFoundError('Project', pid);
        if (project.status === 'processing') throw new ConflictError(`Project ${pid} is already being processed`);

        const existingJob = await jobStore.getByProjectId(pid);
        if (existingJob?.status === 'running') throw new ConflictError(`Project ${pid} already has an active render job`);

        const { RenderJobEntity } = await import('../../domain/entities/RenderJobEntity.js');
        const job = new RenderJobEntity(pid);
        job.start();
        await jobStore.save(job.toJSON());
        return job.toJSON();
      },
      async getJobStatus(id: string) {
        // The SSE and download routes use project ID as :id
        // Try project ID lookup first, then job ID lookup
        return (await jobStore.getByProjectId(id)) ?? (await jobStore.get(id));
      },
    };

    container.register('ProjectService', mockProjectService as any);
    container.register('RenderService', mockRenderService as any);
    container.register('SSEManager', new SSEManager() as any);

    const { VideoProjectEntity } = await import('../../domain/entities/index.js');
    const entity = new VideoProjectEntity({
      title: 'Render Test Project',
      style: 'cinematic',
      voiceName: 'en-US-AriaNeural',
    });
    entity.parts = [{
      partIndex: 0,
      title: 'Intro',
      script: 'Hello world',
      keywords: [],
      images: [],
      ttsPath: null,
      durationSeconds: null,
      status: 'pending',
    }];
    await projectStore.save(entity.toJSON());
    projectId = entity.id;

    app = createTestApp();
  });

  afterAll(async () => {
    const fs = await import('node:fs/promises');
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('POST /api/render/:id/start returns 202 with job for valid project', async () => {
    const res = await request(app).post(`/api/render/${projectId}/start`);
    expect(res.status).toBe(202);
    expect(res.body.job).toBeDefined();
    expect(res.body.job.projectId).toBe(projectId);
    expect(res.body.job.status).toBe('running');
  });

  it('POST /api/render/:id/start returns 404 for nonexistent project', async () => {
    const nonexistentId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).post(`/api/render/${nonexistentId}/start`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('POST /api/render/:id/start returns 409 for already-running job', async () => {
    await request(app).post(`/api/render/${projectId}/start`);
    const res = await request(app).post(`/api/render/${projectId}/start`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
  });

  it('POST /api/render/:id/start with invalid UUID returns 400', async () => {
    const res = await request(app).post('/api/render/not-a-uuid/start');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('GET /api/render/:id/status opens SSE stream with correct headers', (done) => {
    const req = request(app).get(`/api/render/${projectId}/status`);

    req.on('error', done);
    req.on('response', (res: any) => {
      try {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('text/event-stream');
        expect(res.headers['cache-control']).toBe('no-cache');
        expect(res.headers['connection']).toBe('keep-alive');
      } catch (e) {
        done(e);
        return;
      }
      req.abort();
      done();
    });

    // Safety timeout in case the 'response' event never fires
    setTimeout(() => {
      req.abort();
      done(new Error('SSE response event did not fire within timeout'));
    }, 3000);
  });

  it('GET /api/render/:id/download returns 404 for nonexistent job', async () => {
    const nonexistentId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/render/${nonexistentId}/download`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('GET /api/render/:id/download returns 404 when video not ready', async () => {
    const res = await request(app).get(`/api/render/${projectId}/download`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_READY');
  });

  it('GET /api/render/:id/download with invalid UUID returns 400', async () => {
    const res = await request(app).get('/api/render/not-a-uuid/download');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});
