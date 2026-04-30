import { vi } from 'vitest';

// Mock pino so any module that does: import pino from 'pino' or import * as pino from 'pino'
// gets a working noop logger
vi.mock('pino', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    })),
  })),
}));

// Mock the logger singleton used across the app (relative from src/__tests__/setup.ts)
vi.mock('../infrastructure/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    })),
  },
}));
