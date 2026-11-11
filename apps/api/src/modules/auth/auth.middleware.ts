import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/app-error.js';
import { setAuthenticatedUserId } from './auth-context.js';
import type { AuthSecurity } from './auth-security.js';

const BEARER_TOKEN_PATTERN = /^Bearer ([^\s]+)$/i;

export function createRequireAuth(security: AuthSecurity): RequestHandler {
  return async (request, _response, next) => {
    const authorization = request.get('authorization');
    const match = authorization === undefined ? null : BEARER_TOKEN_PATTERN.exec(authorization);

    if (match?.[1] === undefined) {
      next(
        new AppError({
          code: 'AUTH_TOKEN_MISSING',
          message: 'Se requiere un token de acceso.',
          statusCode: 401,
        }),
      );
      return;
    }

    try {
      const userId = await security.verifyAccessToken(match[1]);
      setAuthenticatedUserId(request, userId);
      next();
    } catch {
      next(
        new AppError({
          code: 'AUTH_TOKEN_INVALID',
          message: 'El token de acceso no es válido o expiró.',
          statusCode: 401,
        }),
      );
    }
  };
}
