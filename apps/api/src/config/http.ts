import { loadEnvironment } from './environment.js';

loadEnvironment();

export type HttpConfig = Readonly<{
  allowedOrigins: ReadonlySet<string>;
  isProduction: boolean;
}>;

export function getHttpConfig(environment: NodeJS.ProcessEnv = process.env): HttpConfig {
  const nodeEnvironment = environment.NODE_ENV ?? 'development';
  const rawOrigins = environment.CORS_ORIGINS?.trim();
  const origins = (rawOrigins?.length ? rawOrigins : 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.some((origin) => origin === '*')) {
    throw new Error(
      'CORS_ORIGINS cannot contain a wildcard when credentialed cookies are enabled.',
    );
  }

  return {
    allowedOrigins: new Set(origins),
    isProduction: nodeEnvironment === 'production',
  };
}
