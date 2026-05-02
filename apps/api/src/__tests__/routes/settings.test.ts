import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../app.js';
import { container } from '../../infrastructure/container.js';
import { SettingsService } from '../../application/services/SettingsService.js';
import { createTempDir } from '../helpers/tempDir.js';

describe('UAT: Settings routes', () => {
  let tempDir: string;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    tempDir = await createTempDir();
    const service = new SettingsService(tempDir);
    container.register('SettingsService', service as any);
    app = createTestApp();
  });

  afterAll(async () => {
    const fs = await import('node:fs/promises');
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('GET /api/settings returns 200 with settings object', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.settings).toBeDefined();
    expect(typeof res.body.settings).toBe('object');
    expect(res.body.settings).toHaveProperty('pixabayKey');
    expect(res.body.settings).toHaveProperty('pexelsKey');
    expect(res.body.settings).toHaveProperty('unsplashKey');
    expect(res.body.settings).toHaveProperty('voicePreviewVoice');
  });

  it('PATCH /api/settings with valid body returns 200', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ pixabayKey: 'test-key-123' });
    expect(res.status).toBe(200);
    expect(res.body.settings).toBeDefined();
    expect(res.body.settings.pixabayKey).toBe('test-key-123');
  });

  it('PATCH /api/settings with empty body returns 200', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.settings).toBeDefined();
  });

  it('PATCH /api/settings with unknown key returns 200 (Zod strips unknown)', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ unknownField: 'should be ignored' });
    expect(res.status).toBe(200);
  });

  it('GET /api/settings wrong method returns 404', async () => {
    const res = await request(app).post('/api/settings');
    expect(res.status).toBe(404);
  });
});
