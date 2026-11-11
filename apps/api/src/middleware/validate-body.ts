import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '../shared/errors/app-error.js';

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(
        new AppError({
          code: 'INVALID_INPUT',
          details: {
            issues: result.error.issues.map((issue) => ({
              code: issue.code,
              message: issue.message,
              path: issue.path.map(String).join('.'),
            })),
          },
          message: 'Los datos enviados no son válidos.',
          statusCode: 400,
        }),
      );
      return;
    }

    request.body = result.data;
    next();
  };
}
