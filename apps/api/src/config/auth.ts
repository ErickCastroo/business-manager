import { loadEnvironment } from './environment.js';

loadEnvironment();

const TEST_SECRET = 'business-manager-test-secret-only-32-characters-minimum';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_TTL_PATTERN = /^([1-9][0-9]*)(s|m|h)$/;

export type AuthConfig = Readonly<{
  accessTokenAudience: string;
  accessTokenIssuer: string;
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
  cookieName: string;
  cookieSecure: boolean;
  loginRateLimit: number;
  rateLimitWindowMs: number;
  refreshRateLimit: number;
  refreshTokenTtlMs: number;
  registerRateLimit: number;
}>;

function parseAccessTokenTtl(rawValue: string | undefined): number {
  const value = rawValue?.trim() ?? '15m';
  const match = ACCESS_TOKEN_TTL_PATTERN.exec(value);

  if (match === null) {
    throw new Error('ACCESS_TOKEN_TTL must use a positive duration such as 15m, 1h or 900s.');
  }

  const quantity = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;
  const seconds = quantity * multiplier;

  if (!Number.isSafeInteger(seconds) || seconds > 24 * 60 * 60) {
    throw new Error('ACCESS_TOKEN_TTL must not exceed 24 hours.');
  }

  return seconds;
}

function parseRefreshTokenTtl(rawValue: string | undefined): number {
  const days = Number(rawValue?.trim() ?? '30');

  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error('REFRESH_TOKEN_DAYS must be an integer between 1 and 90.');
  }

  return days * MILLISECONDS_PER_DAY;
}

function resolveSecret(environment: NodeJS.ProcessEnv): string {
  const nodeEnvironment = environment.NODE_ENV ?? 'development';
  const secret =
    environment.JWT_ACCESS_SECRET?.trim() ?? (nodeEnvironment === 'test' ? TEST_SECRET : '');

  if (secret.length < 32 || /change[-_ ]?me/i.test(secret)) {
    throw new Error(
      'JWT_ACCESS_SECRET must contain at least 32 non-placeholder characters. Run scripts/configure-local-auth.ps1 for local development.',
    );
  }

  return secret;
}

export function getAuthConfig(environment: NodeJS.ProcessEnv = process.env): AuthConfig {
  const nodeEnvironment = environment.NODE_ENV ?? 'development';

  return {
    accessTokenAudience: 'business-manager-web',
    accessTokenIssuer: 'business-manager-api',
    accessTokenSecret: resolveSecret(environment),
    accessTokenTtlSeconds: parseAccessTokenTtl(environment.ACCESS_TOKEN_TTL),
    cookieName: 'business_manager_refresh',
    cookieSecure: nodeEnvironment === 'production',
    loginRateLimit: 10,
    rateLimitWindowMs: 15 * 60 * 1000,
    refreshRateLimit: 20,
    refreshTokenTtlMs: parseRefreshTokenTtl(environment.REFRESH_TOKEN_DAYS),
    registerRateLimit: 5,
  };
}
