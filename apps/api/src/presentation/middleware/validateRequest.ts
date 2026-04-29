import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { ZodObject, ZodTypeAny } from 'zod';

interface ValidateOptions {
  body?: ZodObject<Record<string, ZodTypeAny>>;
  params?: ZodObject<Record<string, ZodTypeAny>>;
  query?: ZodObject<Record<string, ZodTypeAny>>;
}

type RouteSchema = ZodObject<{
  body?: ZodObject<Record<string, ZodTypeAny>>;
  params?: ZodObject<Record<string, ZodTypeAny>>;
  query?: ZodObject<Record<string, ZodTypeAny>>;
}>;

export function validateRequest(schema: ValidateOptions | RouteSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Support both flat { body, params, query } and wrapped { body: {...}, params: {...} }
      const bodySchema = (schema as RouteSchema).shape?.body ?? (schema as ValidateOptions).body;
      const paramsSchema = (schema as RouteSchema).shape?.params ?? (schema as ValidateOptions).params;
      const querySchema = (schema as RouteSchema).shape?.query ?? (schema as ValidateOptions).query;

      if (paramsSchema) {
        req.params = paramsSchema.parse(req.params);
      }
      if (bodySchema) {
        req.body = bodySchema.parse(req.body);
      }
      if (querySchema) {
        req.query = querySchema.parse(req.query);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
}