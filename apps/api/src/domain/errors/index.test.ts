import { describe, it, expect } from 'vitest';
import {
  DomainError,
  ParseError,
  MediaFetchError,
  TTSError,
  RenderError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from './index.js';

describe('Domain errors', () => {
  describe('DomainError', () => {
    it('has correct name, code, statusCode', () => {
      const err = new DomainError('something went wrong', 'TEST_ERROR', 418);
      expect(err.name).toBe('DomainError');
      expect(err.code).toBe('TEST_ERROR');
      expect(err.statusCode).toBe(418);
      expect(err.message).toBe('something went wrong');
      expect(err instanceof Error).toBe(true);
    });

    it('defaults statusCode to 500', () => {
      const err = new DomainError('oops', 'Oops');
      expect(err.statusCode).toBe(500);
    });
  });

  describe('ParseError', () => {
    it('has correct code and status', () => {
      const err = new ParseError('bad markdown');
      expect(err.code).toBe('PARSE_ERROR');
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe('ParseError');
    });

    it('includes field when provided', () => {
      const err = new ParseError('missing content', 'content');
      expect(err.field).toBe('content');
      expect(err.message).toBe('missing content');
    });

    it('field is undefined when not provided', () => {
      const err = new ParseError('oops');
      expect(err.field).toBeUndefined();
    });
  });

  describe('MediaFetchError', () => {
    it('has correct code and status', () => {
      const err = new MediaFetchError('all providers failed');
      expect(err.code).toBe('MEDIA_FETCH_ERROR');
      expect(err.statusCode).toBe(502);
      expect(err.name).toBe('MediaFetchError');
    });

    it('includes provider name', () => {
      const err = new MediaFetchError('pixabay is down', 'pixabay');
      expect(err.provider).toBe('pixabay');
    });

    it('recoverable defaults to true', () => {
      const err = new MediaFetchError('timeout');
      expect(err.recoverable).toBe(true);
    });

    it('recoverable can be set to false', () => {
      const err = new MediaFetchError('fatal', 'all', false);
      expect(err.recoverable).toBe(false);
    });
  });

  describe('TTSError', () => {
    it('has correct code and status', () => {
      const err = new TTSError('voicebox failed');
      expect(err.code).toBe('TTS_ERROR');
      expect(err.statusCode).toBe(502);
      expect(err.name).toBe('TTSError');
    });

    it('includes engine name', () => {
      const err = new TTSError('edge-tts timeout', 'edge-tts');
      expect(err.engine).toBe('edge-tts');
    });

    it('recoverable defaults to true', () => {
      const err = new TTSError('engine error');
      expect(err.recoverable).toBe(true);
    });
  });

  describe('RenderError', () => {
    it('has correct code and status', () => {
      const err = new RenderError('remotion crashed');
      expect(err.code).toBe('RENDER_ERROR');
      expect(err.statusCode).toBe(500);
      expect(err.name).toBe('RenderError');
    });

    it('recoverable defaults to false', () => {
      const err = new RenderError('fatal render failure');
      expect(err.recoverable).toBe(false);
    });

    it('recoverable can be set to true', () => {
      const err = new RenderError('soft failure', true);
      expect(err.recoverable).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('has correct code and status', () => {
      const err = new ValidationError('invalid input');
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe('ValidationError');
    });

    it('includes field when provided', () => {
      const err = new ValidationError('title too long', 'title');
      expect(err.field).toBe('title');
    });
  });

  describe('NotFoundError', () => {
    it('has correct code and status', () => {
      const err = new NotFoundError('Project', 'abc-123');
      expect(err.code).toBe('NOT_FOUND');
      expect(err.statusCode).toBe(404);
      expect(err.name).toBe('NotFoundError');
      expect(err.message).toBe('Project not found: abc-123');
    });
  });

  describe('ConflictError', () => {
    it('has correct code and status', () => {
      const err = new ConflictError('already exists');
      expect(err.code).toBe('CONFLICT');
      expect(err.statusCode).toBe(409);
      expect(err.name).toBe('ConflictError');
      expect(err.message).toBe('already exists');
    });
  });

  it('all errors are instanceof Error', () => {
    expect(new ParseError('p') instanceof Error).toBe(true);
    expect(new MediaFetchError('m') instanceof Error).toBe(true);
    expect(new TTSError('t') instanceof Error).toBe(true);
    expect(new RenderError('r') instanceof Error).toBe(true);
    expect(new ValidationError('v') instanceof Error).toBe(true);
    expect(new NotFoundError('p', 'i') instanceof Error).toBe(true);
    expect(new ConflictError('c') instanceof Error).toBe(true);
  });

  it('all errors preserve stack traces', () => {
    const err = new ParseError('with stack');
    expect(err.stack).toBeDefined();
    expect(err.stack!.length).toBeGreaterThan(0);
  });
});
