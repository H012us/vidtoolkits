import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEnv, resetEnvCache } from './EnvConfig.js';

describe('EnvConfig', () => {
  beforeEach(() => {
    resetEnvCache();
    // Clear all env vars the config reads to test defaults
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.FRONTEND_URL;
    delete process.env.PIXABAY_API_KEY;
    delete process.env.PEXELS_API_KEY;
    delete process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.VOICEBOX_URL;
    delete process.env.NODE_MAX_OLD_SPACE_SIZE;
    delete process.env.REMOTION_CONCURRENCY;
    delete process.env.CACHE_DISK_MAX_MB;
    delete process.env.MAX_MD_SIZE_KB;
  });

  afterEach(() => {
    resetEnvCache();
  });

  it('returns defaults when no env vars are set', () => {
    const env = getEnv();
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
    expect(env.FRONTEND_URL).toBe('http://localhost:5173');
    expect(env.VOICEBOX_URL).toBe('http://127.0.0.1:17493');
    expect(env.NODE_MAX_OLD_SPACE_SIZE).toBe(4096);
    expect(env.CACHE_DISK_MAX_MB).toBe(2048);
    expect(env.MAX_MD_SIZE_KB).toBe(500);
  });

  it('caches the result', () => {
    const env1 = getEnv();
    const env2 = getEnv();
    expect(env1).toBe(env2);
  });

  it('clears cache when resetEnvCache is called', () => {
    const env1 = getEnv();
    resetEnvCache();
    process.env.NODE_ENV = 'production';
    const env2 = getEnv();
    expect(env1).not.toBe(env2);
    expect(env2.NODE_ENV).toBe('production');
  });

  it('coerces PORT from string', () => {
    process.env.PORT = '8080';
    resetEnvCache();
    expect(getEnv().PORT).toBe(8080);
  });

  it('validates PORT range', () => {
    process.env.PORT = '70000';
    resetEnvCache();
    expect(() => getEnv()).toThrow();
  });

  it('validates NODE_ENV enum', () => {
    process.env.NODE_ENV = 'invalid';
    resetEnvCache();
    expect(() => getEnv()).toThrow();
  });

  it('accepts all valid NODE_ENV values', () => {
    for (const val of ['development', 'production', 'test'] as const) {
      process.env.NODE_ENV = val;
      resetEnvCache();
      expect(getEnv().NODE_ENV).toBe(val);
    }
  });

  it('validates FRONTEND_URL as URL', () => {
    process.env.FRONTEND_URL = 'not-a-url';
    resetEnvCache();
    expect(() => getEnv()).toThrow();
  });

  it('accepts valid FRONTEND_URL', () => {
    process.env.FRONTEND_URL = 'https://myapp.com';
    resetEnvCache();
    expect(getEnv().FRONTEND_URL).toBe('https://myapp.com');
  });

  it('handles optional API keys', () => {
    process.env.PIXABAY_API_KEY = 'test-key';
    resetEnvCache();
    expect(getEnv().PIXABAY_API_KEY).toBe('test-key');
  });

  it('handles missing optional keys as undefined', () => {
    resetEnvCache();
    expect(getEnv().PIXABAY_API_KEY).toBeUndefined();
  });

  it('coerces NODE_MAX_OLD_SPACE_SIZE', () => {
    process.env.NODE_MAX_OLD_SPACE_SIZE = '2048';
    resetEnvCache();
    expect(getEnv().NODE_MAX_OLD_SPACE_SIZE).toBe(2048);
  });

  it('validates NODE_MAX_OLD_SPACE_SIZE range', () => {
    process.env.NODE_MAX_OLD_SPACE_SIZE = '256';
    resetEnvCache();
    expect(() => getEnv()).toThrow();
  });

  it('coerces REMOTION_CONCURRENCY', () => {
    process.env.REMOTION_CONCURRENCY = '6';
    resetEnvCache();
    expect(getEnv().REMOTION_CONCURRENCY).toBe(6);
  });

  it('REMOTION_CONCURRENCY is optional', () => {
    resetEnvCache();
    expect(getEnv().REMOTION_CONCURRENCY).toBeUndefined();
  });

  it('coerces CACHE_DISK_MAX_MB', () => {
    process.env.CACHE_DISK_MAX_MB = '1024';
    resetEnvCache();
    expect(getEnv().CACHE_DISK_MAX_MB).toBe(1024);
  });

  it('coerces MAX_MD_SIZE_KB', () => {
    process.env.MAX_MD_SIZE_KB = '200';
    resetEnvCache();
    expect(getEnv().MAX_MD_SIZE_KB).toBe(200);
  });

  it('error message includes field path', () => {
    process.env.PORT = '99999';
    resetEnvCache();
    try {
      getEnv();
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.message).toContain('PORT');
    }
  });

  it('error message lists all failures', () => {
    process.env.PORT = '99999';
    process.env.NODE_ENV = 'invalid';
    resetEnvCache();
    try {
      getEnv();
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.message).toContain('PORT');
      expect(err.message).toContain('NODE_ENV');
    }
  });
});
