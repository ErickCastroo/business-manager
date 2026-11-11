import type { LoginRequest, LogoutData, RegisterRequest } from '@business-manager/contracts';
import type { Request, RequestHandler } from 'express';

import type { AuthConfig } from '../../config/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createSuccessResponse } from '../../shared/http/api-response.js';
import { getAuthenticatedUserId } from './auth-context.js';
import {
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  setRefreshTokenCookie,
} from './auth.cookies.js';
import type { AuthService } from './auth.service.js';
import type { SessionMetadata } from './auth.types.js';

type AuthServiceProvider = () => AuthService;

function getSessionMetadata(request: Request): SessionMetadata {
  return {
    ipAddress: request.ip?.slice(0, 45) ?? null,
    userAgent: request.get('user-agent')?.slice(0, 500) ?? null,
  };
}

export function createAuthController(
  getService: AuthServiceProvider,
  config: AuthConfig,
): Readonly<{
  login: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
  refresh: RequestHandler;
  register: RequestHandler;
}> {
  return {
    login: async (request, response) => {
      const result = await getService().login(
        request.body as LoginRequest,
        getSessionMetadata(request),
      );

      setRefreshTokenCookie(response, config, result.refreshToken);
      response.status(200).json(createSuccessResponse(response, result.data));
    },

    logout: async (request, response) => {
      await getService().logout(getRefreshTokenCookie(request, config));
      clearRefreshTokenCookie(response, config);

      const data: LogoutData = { loggedOut: true };
      response.status(200).json(createSuccessResponse(response, data));
    },

    me: async (request, response) => {
      const data = await getService().me(getAuthenticatedUserId(request));
      response.status(200).json(createSuccessResponse(response, data));
    },

    refresh: async (request, response, next) => {
      const refreshToken = getRefreshTokenCookie(request, config);

      if (refreshToken === undefined) {
        clearRefreshTokenCookie(response, config);
        next(
          new AppError({
            code: 'AUTH_REFRESH_MISSING',
            message: 'No se encontró una sesión de actualización.',
            statusCode: 401,
          }),
        );
        return;
      }

      try {
        const result = await getService().refresh(refreshToken, getSessionMetadata(request));
        setRefreshTokenCookie(response, config, result.refreshToken);
        response.status(200).json(createSuccessResponse(response, result.data));
      } catch (error) {
        clearRefreshTokenCookie(response, config);
        next(error);
      }
    },

    register: async (request, response) => {
      const result = await getService().register(
        request.body as RegisterRequest,
        getSessionMetadata(request),
      );

      setRefreshTokenCookie(response, config, result.refreshToken);
      response.status(201).json(createSuccessResponse(response, result.data));
    },
  };
}
