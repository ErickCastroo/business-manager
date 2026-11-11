import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';

import type { AuthConfig } from '../../config/auth.js';
import { AppError } from '../../shared/errors/app-error.js';

export function createAuthRateLimiter(
  config: AuthConfig,
  limit: number,
  identifier: string,
): RateLimitRequestHandler {
  return rateLimit({
    handler(_request, _response, next) {
      next(
        new AppError({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Se realizaron demasiados intentos. Intenta nuevamente más tarde.',
          statusCode: 429,
        }),
      );
    },
    identifier,
    legacyHeaders: false,
    limit,
    standardHeaders: 'draft-8',
    windowMs: config.rateLimitWindowMs,
  });
}
