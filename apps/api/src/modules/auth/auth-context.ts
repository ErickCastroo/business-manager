import type { Request } from 'express';

const AUTH_CONTEXT = Symbol('auth-context');

type RequestWithAuthContext = Request & {
  [AUTH_CONTEXT]?: Readonly<{
    userId: bigint;
  }>;
};

export function setAuthenticatedUserId(request: Request, userId: bigint): void {
  (request as RequestWithAuthContext)[AUTH_CONTEXT] = { userId };
}

export function getAuthenticatedUserId(request: Request): bigint {
  const context = (request as RequestWithAuthContext)[AUTH_CONTEXT];

  if (context === undefined) {
    throw new Error('Authenticated request context is missing.');
  }

  return context.userId;
}
