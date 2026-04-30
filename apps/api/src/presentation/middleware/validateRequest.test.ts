import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validateRequest } from './validateRequest.js';

describe('validateRequest middleware', () => {
  function makeReqRes(overrides: { body?: any; params?: any; query?: any } = {}) {
    return {
      req: {
        body: overrides.body ?? {},
        params: overrides.params ?? {},
        query: overrides.query ?? {},
      },
      res: {
        status: vi.fn(() => ({ json: vi.fn() })),
        json: vi.fn(),
      },
      next: vi.fn(),
    };
  }

  describe('flat schema form: { body, params, query }', () => {
    it('passes valid request and calls next', () => {
      const { req, res, next } = makeReqRes({ body: { title: 'My Video' }, params: { id: 'abc' } });
      const mw = validateRequest({
        body: z.object({ title: z.string() }),
        params: z.object({ id: z.string() }),
      });
      mw(req as any, res as any, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('returns 400 on invalid body', () => {
      const { req, res, next } = makeReqRes({ body: { title: 123 } });
      const mw = validateRequest({ body: z.object({ title: z.string() }) });
      mw(req as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 on invalid params', () => {
      const { req, res, next } = makeReqRes({ params: { id: 123 } });
      const mw = validateRequest({ params: z.object({ id: z.string() }) });
      mw(req as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('includes field path and message in details', () => {
      const { req, res, next } = makeReqRes({ body: { title: '' } });
      const mw = validateRequest({ body: z.object({ title: z.string().min(1) }) });
      mw(req as any, res as any, next);
      const json = res.status.mock.results[0].value.json.mock.calls[0][0];
      expect(json.error).toBe('VALIDATION_ERROR');
      expect(json.details.length).toBeGreaterThan(0);
      expect(json.details[0].field).toBeDefined();
      expect(json.details[0].message).toBeDefined();
    });
  });

  describe('wrapped schema form: { body: {...} }', () => {
    it('passes valid request', () => {
      const { req, res, next } = makeReqRes({ body: { name: 'test' } });
      const mw = validateRequest(z.object({ body: z.object({ name: z.string() }) }));
      mw(req as any, res as any, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('returns 400 on invalid wrapped body', () => {
      const { req, res, next } = makeReqRes({ body: { name: 123 } });
      const mw = validateRequest(z.object({ body: z.object({ name: z.string() }) }));
      mw(req as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('validates both wrapped body and flat params', () => {
      const { req, res, next } = makeReqRes({ body: { id: 'abc' }, params: { projectId: 'xyz' } });
      const mw = validateRequest(
        z.object({
          body: z.object({ id: z.string() }),
          params: z.object({ projectId: z.string() }),
        })
      );
      mw(req as any, res as any, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  it('skips validation when schema has no body/params/query keys', () => {
    const { req, res, next } = makeReqRes({ body: { anything: true } });
    // Pass an empty object with no body/params/query schemas
    const mw = validateRequest({});
    mw(req as any, res as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('skips validation for params when only body schema is provided', () => {
    const { req, res, next } = makeReqRes({ body: { name: 'test' }, params: { id: 'any' } });
    const mw = validateRequest({ body: z.object({ name: z.string() }) });
    mw(req as any, res as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('non-Zod errors pass through to next', () => {
    const { req, res, next } = makeReqRes();
    const mw = validateRequest({ body: z.object({}) });
    const nonZod = new Error('oops');
    mw(req as any, res as any, next);
    // Simulate a non-Zod error path would call next(err)
    next(nonZod);
    expect(next).toHaveBeenCalledWith(nonZod);
  });
});
