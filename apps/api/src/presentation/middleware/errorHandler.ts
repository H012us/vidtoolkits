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
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err instanceof DomainError && 'field' in err ? { field: (err as { field?: string }).field } : {}),
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