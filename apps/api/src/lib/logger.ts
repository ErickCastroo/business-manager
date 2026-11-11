import pino from 'pino';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const environment = process.env.NODE_ENV ?? 'development';

type LogLevel = (typeof LOG_LEVELS)[number];

function isLogLevel(value: string): value is LogLevel {
  return LOG_LEVELS.some((level) => level === value);
}

function resolveLogLevel(value: string | undefined): LogLevel {
  if (value !== undefined && isLogLevel(value)) {
    return value;
  }

  return environment === 'production' ? 'info' : 'debug';
}

const developmentTransport =
  environment === 'development'
    ? {
        transport: {
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
          target: 'pino-pretty',
        },
      }
    : {};

export const logger = pino({
  base: {
    environment,
    service: 'business-manager-api',
  },
  enabled: environment !== 'test',
  level: resolveLogLevel(process.env.LOG_LEVEL),
  redact: {
    censor: '[REDACTED]',
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.passwordHash',
      'req.body.token',
      'req.body.accessToken',
      'req.body.refreshToken',
      'res.headers["set-cookie"]',
    ],
  },
  ...developmentTransport,
});
