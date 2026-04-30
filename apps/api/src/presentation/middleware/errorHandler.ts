import type { Request, Response, NextFunction } from 'express';
import { DomainError } from '../../domain/errors/index.js';
import { logger } from '../../infrastructure/logger.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof DomainError) {
    const base: Record<string, unknown> = { error: err.code, message: err.message };
    if ('field' in err) base.field = (err as DomainError & { field?: string }).field;
    if ('provider' in err) base.provider = (err as DomainError & { provider?: string }).provider;
    if ('engine' in err) base.engine = (err as DomainError & { engine?: string }).engine;
    res.status(err.statusCode).json(base);
    return;
  }

  // Handle SERVICE_UNAVAILABLE errors from pre-render validation
  if ((err as any).code === 'SERVICE_UNAVAILABLE') {
    res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: (err as Error).message,
      failures: (err as any).failures ?? [],
    });
    return;
  }

  const unexpected = err instanceof Error ? err : new Error(String(err));
  logger.error({ err: unexpected }, 'Unexpected error');

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}