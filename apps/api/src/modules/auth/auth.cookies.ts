import type { CookieOptions, Request, Response } from 'express';

import type { AuthConfig } from '../../config/auth.js';

const AUTH_COOKIE_PATH = '/api/v1/auth';

function getBaseCookieOptions(config: AuthConfig): CookieOptions {
  return {
    httpOnly: true,
    path: AUTH_COOKIE_PATH,
    sameSite: 'lax',
    secure: config.cookieSecure,
  };
}

export function getRefreshTokenCookie(request: Request, config: AuthConfig): string | undefined {
  const cookies: unknown = request.cookies;

  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }

  const value: unknown = Reflect.get(cookies, config.cookieName);

  return typeof value === 'string' ? value : undefined;
}

export function setRefreshTokenCookie(response: Response, config: AuthConfig, token: string): void {
  response.cookie(config.cookieName, token, {
    ...getBaseCookieOptions(config),
    maxAge: config.refreshTokenTtlMs,
  });
}

export function clearRefreshTokenCookie(response: Response, config: AuthConfig): void {
  response.clearCookie(config.cookieName, getBaseCookieOptions(config));
}
