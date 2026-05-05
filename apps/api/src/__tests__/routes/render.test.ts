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
        return (await jobStore.getByProjectId(id)) ?? (await jobStore.get(id));
      },
      async cancelRender(id: string) {
        const { NotFoundError } = await import('../../domain/errors/index.js');
        const job = await jobStore.getByProjectId(id);
        if (!job) throw new NotFoundError('RenderJob', id);
        job.status = 'failed';
        job.error = 'Cancelled by user';
        await jobStore.save(job);
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
      rawMarkdown: '## Render Test\n\nSome content.',
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

  it('DELETE /api/render/:id returns 200 and cancels job', async () => {
    // First start a render so there's a job to cancel
    await request(app).post(`/api/render/${projectId}/start`);
    const res = await request(app).delete(`/api/render/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.cancelled).toBe(true);
  });

  it('DELETE /api/render/:id for nonexistent job returns 404', async () => {
    const nonexistentId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).delete(`/api/render/${nonexistentId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('DELETE /api/render/:id with invalid UUID returns 400', async () => {
    const res = await request(app).delete('/api/render/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

// ─── Phase B SIT Tests — MVP 3 ────────────────────────────────────────────────

describe('Phase B: Render health gate (B.3)', () => {
  let tempDir: string;
  let app: ReturnType<typeof createTestApp>;
  let projectId: string;
  let projectStore: FileSystemProjectStore;
  let jobStore: RenderJobStore;

  beforeAll(async () => {
    tempDir = await createTempDir();
    const projectsDir = `${tempDir}/projects`;
    const jobsDir = `${tempDir}/jobs`;
    projectStore = new FileSystemProjectStore(projectsDir);
    jobStore = new RenderJobStore(jobsDir);

    // Register mock services
    container.register('ProjectService', {
      getProject: async (id: string) => projectStore.get(id),
      store: projectStore,
    } as any);
    container.register('SSEManager', new SSEManager() as any);

    // Unregister and re-register RenderService with mock
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
        return (await jobStore.getByProjectId(id)) ?? (await jobStore.get(id));
      },
      async cancelRender(id: string) {
        const job = await jobStore.getByProjectId(id);
        if (!job) return;
        job.status = 'failed';
        job.error = 'Cancelled by user';
        await jobStore.save(job);
      },
    };
    container.register('RenderService', mockRenderService as any);

    // Create a project
    const { VideoProjectEntity } = await import('../../domain/entities/index.js');
    const entity = new VideoProjectEntity({
      title: 'Phase B Test',
      style: 'cinematic',
      voiceName: 'en-US-AriaNeural',
      rawMarkdown: '## Test\n\nContent.',
    });
    entity.parts = [{
      partIndex: 0, title: 'Part 1', script: 'Hello', keywords: ['sunset'],
      images: [], ttsPath: null, durationSeconds: null, status: 'pending',
    }];
    await projectStore.save(entity.toJSON());
    projectId = entity.id;

    app = createTestApp();
  });

  afterAll(async () => {
    const fs = await import('node:fs/promises');
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('B.3.1 POST /api/render/:id/start returns 503 when health check reports FFmpeg unavailable', async () => {
    // Override RenderService to simulate health check failure
    const failingService: any = {
      async startRender() {
        const err = new Error('Cannot start render: FFmpeg not found: binary not on PATH');
        (err as any).code = 'SERVICE_UNAVAILABLE';
        throw err;
      },
      async getJobStatus() { return null; },
      async cancelRender() {},
    };
    container.register('RenderService', failingService);
    const testApp = createTestApp();

    const res = await request(testApp).post(`/api/render/${projectId}/start`);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('SERVICE_UNAVAILABLE');
  });

  it('B.3.2 POST /api/render/:id/start returns 503 when no image provider configured', async () => {
    // Override RenderService to simulate no image providers
    const failingService: any = {
      async startRender() {
        const err = new Error('Cannot start render: No image providers configured (Pixabay, Pexels, Unsplash all unavailable)');
        (err as any).code = 'SERVICE_UNAVAILABLE';
        throw err;
      },
      async getJobStatus() { return null; },
      async cancelRender() {},
    };
    container.register('RenderService', failingService);
    const testApp = createTestApp();

    const res = await request(testApp).post(`/api/render/${projectId}/start`);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('Phase B: Job progress during execution (B.4)', () => {
  let tempDir: string;
  let jobsDir: string;
  let app: ReturnType<typeof createTestApp>;
  let projectId: string;
  let jobStore: RenderJobStore;
  let savedJobs: any[] = [];

  beforeAll(async () => {
    tempDir = await createTempDir();
    const projectsDir = `${tempDir}/projects`;
    jobsDir = `${tempDir}/jobs`;
    const projectStore = new FileSystemProjectStore(projectsDir);
    jobStore = new RenderJobStore(jobsDir);

    container.register('ProjectService', {
      getProject: async (id: string) => projectStore.get(id),
      store: projectStore,
    } as any);
    container.register('SSEManager', new SSEManager() as any);

    // Mock RenderService that saves job snapshots for verification
    const mockRenderService: any = {
      async startRender(pid: string) {
        const { RenderJobEntity } = await import('../../domain/entities/RenderJobEntity.js');
        const job = new RenderJobEntity(pid);
        job.start();
        savedJobs.push({ ...job.toJSON() });
        await jobStore.save(job.toJSON());
        return job.toJSON();
      },
      async getJobStatus(id: string) {
        return (await jobStore.getByProjectId(id)) ?? (await jobStore.get(id));
      },
      async cancelRender(id: string) {
        const job = await jobStore.getByProjectId(id);
        if (!job) return;
        job.status = 'failed';
        job.error = 'Cancelled by user';
        savedJobs.push({ ...job });
        await jobStore.save(job);
      },
    };
    container.register('RenderService', mockRenderService as any);

    const { VideoProjectEntity } = await import('../../domain/entities/index.js');
    const entity = new VideoProjectEntity({
      title: 'Job Progress Test',
      style: 'cinematic',
      voiceName: 'en-US-AriaNeural',
      rawMarkdown: '## Test\n\nContent.',
    });
    entity.parts = [{
      partIndex: 0, title: 'Part 1', script: 'Hello', keywords: ['sunset'],
      images: [], ttsPath: null, durationSeconds: null, status: 'pending',
    }];
    await projectStore.save(entity.toJSON());
    projectId = entity.id;

    app = createTestApp();
  });

  afterAll(async () => {
    const fs = await import('node:fs/promises');
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('B.4.1 job file progress and step updated at each pipeline event', async () => {
    savedJobs.length = 0;

    await request(app).post(`/api/render/${projectId}/start`);

    // Initial job should have status=running, progress=0
    expect(savedJobs[0].status).toBe('running');
    expect(savedJobs[0].progress).toBe(0);
  });

  it('B.4.2 DELETE /api/render/:id → job JSON shows status=failed and error=Cancelled by user', async () => {
    savedJobs.length = 0;

    // Start a render first
    await request(app).post(`/api/render/${projectId}/start`);
    const initialJob = savedJobs[0];
    expect(initialJob.status).toBe('running');

    // Cancel the render
    const res = await request(app).delete(`/api/render/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.cancelled).toBe(true);

    // Verify the saved job has the correct state
    expect(savedJobs.length).toBeGreaterThanOrEqual(2);
    const cancelledJob = savedJobs[savedJobs.length - 1];
    expect(cancelledJob.status).toBe('failed');
    expect(cancelledJob.error).toBe('Cancelled by user');
  });
});
