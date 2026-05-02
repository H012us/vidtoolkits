import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../app.js';

describe('UAT: Template routes', () => {
  const app = createTestApp();

  it('GET /api/templates/markdown returns 200 with template string', async () => {
    const res = await request(app).get('/api/templates/markdown');
    expect(res.status).toBe(200);
    expect(res.body.template).toBeDefined();
    expect(typeof res.body.template).toBe('string');
    expect(res.body.template.length).toBeGreaterThan(0);
  });

  it('GET /api/templates/markdown response starts with YAML frontmatter', async () => {
    const res = await request(app).get('/api/templates/markdown');
    expect(res.status).toBe(200);
    expect(res.body.template.startsWith('---')).toBe(true);
  });
});
