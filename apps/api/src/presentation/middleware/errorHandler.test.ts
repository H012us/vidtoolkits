import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from './errorHandler.js';
import {
  ParseError,
  MediaFetchError,
  TTSError,
  RenderError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../../domain/errors/index.js';

describe('errorHandler middleware', () => {
  function makeRes() {
    const res: any = {
      statusCode: null,
      body: null,
      status: vi.fn(function (code: number) { this.statusCode = code; return this; }),
      json: vi.fn(function (body: any) { this.body = body; return this; }),
    };
    return res;
  }

  function call(err: unknown) {
    const res = makeRes();
    const next = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorHandler(err, {} as any, res, next);
    return { res, next };
  }

  it('ParseError → 400 VALIDATION_ERROR', () => {
    const err = new ParseError('bad content', 'content');
    const { res } = call(err);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'PARSE_ERROR', message: 'bad content', field: 'content' });
  });

  it('NotFoundError → 404 NOT_FOUND', () => {
    const err = new NotFoundError('Project', 'abc-123');
    const { res } = call(err);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND', message: 'Project not found: abc-123' });
  });

  it('ConflictError → 409 CONFLICT', () => {
    const err = new ConflictError('already processing');
    const { res } = call(err);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'CONFLICT', message: 'already processing' });
  });

  it('ValidationError → 400 VALIDATION_ERROR', () => {
    const err = new ValidationError('title too long', 'title');
    const { res } = call(err);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'VALIDATION_ERROR', message: 'title too long', field: 'title' });
  });

  it('MediaFetchError → 502 MEDIA_FETCH_ERROR', () => {
    const err = new MediaFetchError('providers down', 'pixabay');
    const { res } = call(err);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'MEDIA_FETCH_ERROR', message: 'providers down', provider: 'pixabay' });
  });

  it('TTSError → 502 TTS_ERROR', () => {
    const err = new TTSError('voicebox timeout', 'voicebox');
    const { res } = call(err);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'TTS_ERROR', message: 'voicebox timeout', engine: 'voicebox' });
  });

  it('RenderError → 500 RENDER_ERROR', () => {
    const err = new RenderError('remotion crashed');
    const { res } = call(err);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'RENDER_ERROR', message: 'remotion crashed' });
  });

  it('non-domain Error → 500 INTERNAL_ERROR', () => {
    const err = new Error('unexpected failure');
    const { res, next } = call(err);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
    expect(next).not.toHaveBeenCalled();
  });

  it('non-Error value → 500 INTERNAL_ERROR', () => {
    const { res } = call('string error');
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
  });

  it('always returns valid JSON', () => {
    for (const err of [
      new ParseError('p'),
      new NotFoundError('r', 'i'),
      new Error('raw'),
      42,
      null,
      undefined,
      { foo: 'bar' },
    ]) {
      const res = makeRes();
      errorHandler(err as any, {} as any, res, vi.fn());
      expect(() => JSON.stringify(res.body)).not.toThrow();
    }
  });
});
