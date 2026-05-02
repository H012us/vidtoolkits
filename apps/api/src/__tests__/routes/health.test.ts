import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../app.js';
import { container } from '../../infrastructure/container.js';
import { FileSystemProjectStore } from '../../infrastructure/persistence/FileSystemProjectStore.js';
import { ProjectService } from '../../application/services/ProjectService.js';
import { UploadService } from '../../application/services/UploadService.js';
import { SSEManager } from '../../presentation/SSE/SSEManager.js';
import { createTempDir } from '../helpers/tempDir.js';
import { HealthCheckService } from '../../application/services/HealthCheckService.js';

describe('UAT: Health endpoint', () => {
  const app = createTestApp();

  it('GET /api/health returns 200 with ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.pid).toBeGreaterThan(0);
  });
});

describe('UAT: Upload endpoint', () => {
  let tempDir: string;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    tempDir = await createTempDir();
    const projectsDir = `${tempDir}/projects`;

    const projectStore = new FileSystemProjectStore(projectsDir);
    const mockProjectService = Object.assign(new ProjectService(), {
      store: projectStore,
      createProject: async (data: any) => {
        const { VideoProjectEntity } = await import('../../domain/entities/index.js');
        const entity = new VideoProjectEntity(data);
        await projectStore.save(entity.toJSON());
        return entity;
      },
    } as any);

    container.register('ProjectService', mockProjectService as any);
    container.register('SSEManager', new SSEManager() as any);

    const mockUploadService = Object.assign(new UploadService(), {
      uploadMarkdown: async (file: any) => {
        const parser = await import('../../application/services/MarkdownParserService.js').then(m => new m.MarkdownParserService());
        const { VideoProjectEntity } = await import('../../domain/entities/index.js');
        const parsed = parser.parse(file.buffer.toString('utf-8'));
        const entity = new VideoProjectEntity({
          title: parsed.title,
          rawMarkdown: '',
          style: parsed.style,
          voiceName: parsed.voiceName,
          durationPerPart: parsed.durationPerPart,
        });
        entity.parts = parsed.parts.map((p: any, i: number) => ({
          partIndex: i,
          title: p.title,
          script: p.script,
          keywords: p.keywords,
          images: [],
          ttsPath: null,
          durationSeconds: null,
          status: 'pending' as const,
        }));
        await projectStore.save(entity.toJSON());
        return { project: entity.toJSON() };
      },
    } as any);
    container.register('UploadService', mockUploadService as any);

    app = createTestApp();
  });

  afterAll(async () => {
    const fs = await import('node:fs/promises');
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('POST /api/upload with valid markdown returns 201', async () => {
    const md = `---
title: "UAT Test Video"
style: cinematic
voice: en-US-AriaNeural
---

## Part 1: Introduction
keywords: sunset, ocean

Welcome to this video.
`;

    const res = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from(md), 'test.md');

    expect(res.status).toBe(201);
    expect(res.body.project).toBeDefined();
    expect(res.body.project.title).toBe('UAT Test Video');
    expect(res.body.project.status).toBe('created');
    expect(res.body.project.parts.length).toBeGreaterThan(0);
  });

  it('POST /api/upload without file returns 400', async () => {
    const res = await request(app).post('/api/upload').send({});
    expect(res.status).toBe(400);
  });
});

describe('UAT: Project CRUD', () => {
  let tempDir: string;
  let app: ReturnType<typeof createTestApp>;
  let projectStore: FileSystemProjectStore;

  beforeAll(async () => {
    tempDir = await createTempDir();
    const projectsDir = `${tempDir}/projects`;
    projectStore = new FileSystemProjectStore(projectsDir);

    const mockProjectService = Object.assign(new ProjectService(), {
      store: projectStore,
      listProjects: async () => projectStore.list(),
      getProject: async (id: string) => projectStore.get(id),
      updateProject: async (id: string, data: any) => {
        const p = await projectStore.get(id);
        if (!p) return null;
        const { VideoProjectEntity } = await import('../../domain/entities/index.js');
        const entity = VideoProjectEntity.fromJSON(p);
        if (data.title !== undefined) entity.title = data.title;
        if (data.voiceName !== undefined) entity.voiceName = data.voiceName;
        if (data.durationPerPart !== undefined) entity.durationPerPart = data.durationPerPart;
        await projectStore.save(entity.toJSON());
        return entity.toJSON();
      },
      deleteProject: async (id: string) => projectStore.delete(id),
      createProject: async (data: any) => {
        const { VideoProjectEntity } = await import('../../domain/entities/index.js');
        const entity = new VideoProjectEntity(data);
        await projectStore.save(entity.toJSON());
        return entity;
      },
    } as any);

    container.register('ProjectService', mockProjectService as any);
    app = createTestApp();
  });

  afterAll(async () => {
    const fs = await import('node:fs/promises');
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('GET /api/projects returns empty list initially', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toEqual([]);
  });

  it('GET /api/projects/:id returns 404 for nonexistent', async () => {
    const res = await request(app).get('/api/projects/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('PATCH /api/projects/:id returns 404 for nonexistent', async () => {
    const res = await request(app)
      .patch('/api/projects/00000000-0000-0000-0000-000000000000')
      .send({ title: 'New Title' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/projects/:id returns 204 even for nonexistent', async () => {
    const res = await request(app).delete('/api/projects/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(204);
  });

  it('PATCH /api/projects/:id with invalid UUID returns 400', async () => {
    const res = await request(app)
      .patch('/api/projects/not-a-uuid')
      .send({ title: 'New Title' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('UAT: Security headers', () => {
  it('returns helmet security headers', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});

describe('UAT: Health detailed endpoint', () => {
  it('GET /api/health/detailed returns 200 with all service statuses', async () => {
    const mockHealth = {
      voicebox: { status: 'available' as const, latencyMs: 12 },
      edgeTts: { status: 'available' as const },
      imageProviders: [{ name: 'pixabay', configured: true, available: true }],
      binaries: { ffmpeg: { available: true, version: '6.0' }, ffprobe: { available: true } },
      remotion: { available: true },
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const mockService = Object.assign(new HealthCheckService(), {
      check: vi.fn().mockResolvedValue(mockHealth),
    } as any);
    container.register('HealthCheckService', mockService as any);

    const app = createTestApp();
    const res = await request(app).get('/api/health/detailed');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('voicebox');
    expect(res.body).toHaveProperty('edgeTts');
    expect(res.body).toHaveProperty('imageProviders');
    expect(res.body).toHaveProperty('binaries');
    expect(res.body).toHaveProperty('remotion');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/health/detailed has correct imageProviders shape', async () => {
    const mockHealth = {
      voicebox: { status: 'available' as const },
      edgeTts: { status: 'available' as const },
      imageProviders: [{ name: 'pixabay', configured: true, available: true }],
      binaries: { ffmpeg: { available: true }, ffprobe: { available: true } },
      remotion: { available: true },
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const mockService = Object.assign(new HealthCheckService(), {
      check: vi.fn().mockResolvedValue(mockHealth),
    } as any);
    container.register('HealthCheckService', mockService as any);

    const app = createTestApp();
    const res = await request(app).get('/api/health/detailed');
    expect(Array.isArray(res.body.imageProviders)).toBe(true);
    expect(res.body.imageProviders[0]).toHaveProperty('name');
    expect(res.body.imageProviders[0]).toHaveProperty('configured');
    expect(res.body.imageProviders[0]).toHaveProperty('available');
  });

  it('GET /api/health/detailed has binaries.ffmpeg and binaries.ffprobe', async () => {
    const mockHealth = {
      voicebox: { status: 'available' as const },
      edgeTts: { status: 'available' as const },
      imageProviders: [],
      binaries: { ffmpeg: { available: true }, ffprobe: { available: false } },
      remotion: { available: true },
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const mockService = Object.assign(new HealthCheckService(), {
      check: vi.fn().mockResolvedValue(mockHealth),
    } as any);
    container.register('HealthCheckService', mockService as any);

    const app = createTestApp();
    const res = await request(app).get('/api/health/detailed');
    expect(res.body.binaries).toHaveProperty('ffmpeg');
    expect(res.body.binaries).toHaveProperty('ffprobe');
  });
});

describe('UAT: Health test provider endpoint', () => {
  it('POST /api/health/test/pixabay returns 200 with provider health', async () => {
    const mockService = Object.assign(new HealthCheckService(), {
      testProvider: vi.fn().mockResolvedValue({ name: 'pixabay', configured: true, available: true, latencyMs: 15 }),
    } as any);
    container.register('HealthCheckService', mockService as any);

    const app = createTestApp();
    const res = await request(app).post('/api/health/test/pixabay');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('pixabay');
    expect(res.body.configured).toBe(true);
    expect(res.body.available).toBe(true);
  });

  it('POST /api/health/test/unknown returns configured: false, available: false', async () => {
    const mockService = Object.assign(new HealthCheckService(), {
      testProvider: vi.fn().mockResolvedValue({ name: 'unknown', configured: false, available: false, error: 'Provider not found' }),
    } as any);
    container.register('HealthCheckService', mockService as any);

    const app = createTestApp();
    const res = await request(app).post('/api/health/test/unknown');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('unknown');
    expect(res.body.configured).toBe(false);
    expect(res.body.available).toBe(false);
    expect(res.body.error).toBe('Provider not found');
  });
});
