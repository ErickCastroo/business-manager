import { loginRequestSchema, registerRequestSchema } from '@business-manager/contracts';
import { Router, type RequestHandler } from 'express';

import { getAuthConfig, type AuthConfig } from '../../config/auth.js';
import { getPrismaClient } from '../../lib/prisma.js';
import { validateBody } from '../../middleware/validate-body.js';
import { createAuthController } from './auth.controller.js';
import { createRequireAuth } from './auth.middleware.js';
import { createAuthRateLimiter } from './auth-rate-limit.js';
import { PrismaAuthRepository } from './auth.repository.js';
import { AuthSecurity } from './auth-security.js';
import { AuthService } from './auth.service.js';
import type { AuthRepository } from './auth.types.js';

export type AuthRouterOptions = Readonly<{
  config?: AuthConfig;
  repository?: AuthRepository;
  security?: AuthSecurity;
}>;

const disableAuthCaching: RequestHandler = (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
};

export function createAuthRouter(options: AuthRouterOptions = {}): Router {
  const config = options.config ?? getAuthConfig();
  const security = options.security ?? new AuthSecurity(config);
  let service: AuthService | undefined;
  const getService = () => {
    service ??= new AuthService(
      options.repository ?? new PrismaAuthRepository(getPrismaClient()),
      security,
      config,
    );
    return service;
  };
  const controller = createAuthController(getService, config);
  const router = Router();

  router.use(disableAuthCaching);
  router.post(
    '/register',
    createAuthRateLimiter(config, config.registerRateLimit, 'auth-register'),
    validateBody(registerRequestSchema),
    controller.register,
  );
  router.post(
    '/login',
    createAuthRateLimiter(config, config.loginRateLimit, 'auth-login'),
    validateBody(loginRequestSchema),
    controller.login,
  );
  router.post(
    '/refresh',
    createAuthRateLimiter(config, config.refreshRateLimit, 'auth-refresh'),
    controller.refresh,
  );
  router.post('/logout', controller.logout);
  router.get('/me', createRequireAuth(security), controller.me);

  return router;
}
