import { describe, expect, it } from 'vitest';

import { getAuthConfig } from '../src/config/auth.js';
import { getHttpConfig } from '../src/config/http.js';

describe('authentication configuration', () => {
  it('parses bounded access and refresh token lifetimes', () => {
    const config = getAuthConfig({
      ACCESS_TOKEN_TTL: '20m',
      JWT_ACCESS_SECRET: 'a-secure-local-secret-with-more-than-32-characters',
      NODE_ENV: 'production',
      REFRESH_TOKEN_DAYS: '45',
    });

    expect(config.accessTokenTtlSeconds).toBe(1200);
    expect(config.refreshTokenTtlMs).toBe(45 * 24 * 60 * 60 * 1000);
    expect(config.cookieSecure).toBe(true);
  });

  it('rejects placeholder JWT secrets and excessive token lifetimes', () => {
    expect(() =>
      getAuthConfig({
        ACCESS_TOKEN_TTL: '15m',
        JWT_ACCESS_SECRET: 'change-me-with-a-longer-but-still-placeholder-value',
        NODE_ENV: 'production',
        REFRESH_TOKEN_DAYS: '30',
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);

    expect(() =>
      getAuthConfig({
        ACCESS_TOKEN_TTL: '25h',
        JWT_ACCESS_SECRET: 'a-secure-local-secret-with-more-than-32-characters',
        NODE_ENV: 'production',
        REFRESH_TOKEN_DAYS: '30',
      }),
    ).toThrow(/24 hours/);
  });

  it('rejects wildcard CORS when cookies are credentialed', () => {
    expect(() =>
      getHttpConfig({
        CORS_ORIGINS: '*',
        NODE_ENV: 'production',
      }),
    ).toThrow(/wildcard/);
  });
});
