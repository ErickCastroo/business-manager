import { createHash, randomUUID } from 'node:crypto';

import request, { type Response as SupertestResponse } from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { getAuthConfig } from '../src/config/auth.js';
import { disconnectPrismaClient, getPrismaClient } from '../src/lib/prisma.js';

const runDatabaseIntegration = process.env.RUN_DATABASE_INTEGRATION === 'true';
const uniqueRunId = randomUUID();
const firstEmail = `task005-${uniqueRunId}-one@example.invalid`;
const secondEmail = `task005-${uniqueRunId}-two@example.invalid`;
const emails = [firstEmail, secondEmail] as const;
const password = 'DatabasePassword7';
const config = {
  ...getAuthConfig({
    ACCESS_TOKEN_TTL: '15m',
    JWT_ACCESS_SECRET: 'database-integration-secret-at-least-32-characters',
    NODE_ENV: 'test',
    REFRESH_TOKEN_DAYS: '30',
  }),
  loginRateLimit: 100,
  refreshRateLimit: 100,
  registerRateLimit: 100,
};

function getCookiePair(response: SupertestResponse): string {
  const header: unknown = response.headers['set-cookie'];
  const firstHeader =
    typeof header === 'string' ? header : Array.isArray(header) ? header[0] : undefined;

  if (typeof firstHeader !== 'string') {
    throw new Error('Response did not include a refresh cookie.');
  }

  return firstHeader.split(';', 1)[0] ?? firstHeader;
}

function getRawCookieValue(cookiePair: string): string {
  const separator = cookiePair.indexOf('=');

  if (separator < 0) {
    throw new Error('Refresh cookie format is invalid.');
  }

  return cookiePair.slice(separator + 1);
}

describe.runIf(runDatabaseIntegration)('auth API with SQL Server', () => {
  const app = createApp({
    auth: { config },
    exposeApiDocs: false,
    http: {
      allowedOrigins: new Set(['http://localhost:5173']),
      isProduction: false,
    },
  });

  afterAll(async () => {
    const prisma = getPrismaClient();
    const users = await prisma.user.findMany({
      select: { id: true },
      where: { email: { in: [...emails] } },
    });
    const userIds = users.map((user) => user.id);

    if (userIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await disconnectPrismaClient();
  });

  it('authenticates two users and persists only hashed, rotatable refresh tokens', async () => {
    const firstRegistration = await request(app).post('/api/v1/auth/register').send({
      email: emails[0],
      firstName: 'Primera',
      password,
    });
    const secondRegistration = await request(app).post('/api/v1/auth/register').send({
      email: emails[1],
      firstName: 'Segunda',
      password,
    });

    expect(firstRegistration.status).toBe(201);
    expect(secondRegistration.status).toBe(201);

    const firstAccessToken: unknown = firstRegistration.body.data.token.accessToken;
    const secondAccessToken: unknown = secondRegistration.body.data.token.accessToken;
    expect(typeof firstAccessToken).toBe('string');
    expect(typeof secondAccessToken).toBe('string');

    const firstMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${String(firstAccessToken)}`);
    const secondMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${String(secondAccessToken)}`);
    expect(firstMe.status).toBe(200);
    expect(secondMe.status).toBe(200);
    expect(firstMe.body.data.user.email).toBe(emails[0]);
    expect(secondMe.body.data.user.email).toBe(emails[1]);

    const databaseLogin = await request(app).post('/api/v1/auth/login').send({
      email: firstEmail.toUpperCase(),
      password,
    });
    expect(databaseLogin.status).toBe(200);
    expect(databaseLogin.body.data.user.email).toBe(firstEmail);

    const firstCookie = getCookiePair(firstRegistration);
    const rawRefreshToken = getRawCookieValue(firstCookie);
    const tokenHash = createHash('sha256').update(rawRefreshToken, 'utf8').digest('hex');
    const prisma = getPrismaClient();
    const storedUser = await prisma.user.findUniqueOrThrow({
      select: { id: true, passwordHash: true },
      where: { email: emails[0] },
    });
    const storedToken = await prisma.refreshToken.findUnique({
      select: { tokenHash: true },
      where: { tokenHash },
    });
    expect(storedUser.passwordHash).toMatch(/^\$argon2id\$/);
    expect(storedToken?.tokenHash).toBe(tokenHash);
    expect(storedToken?.tokenHash).not.toBe(rawRefreshToken);

    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie);
    expect(refresh.status).toBe(200);
    const replacementCookie = getCookiePair(refresh);
    const rotatedToken = await prisma.refreshToken.findUniqueOrThrow({
      select: { replacedByTokenId: true, revokedAt: true },
      where: { tokenHash },
    });
    expect(rotatedToken.revokedAt).not.toBeNull();
    expect(rotatedToken.replacedByTokenId).not.toBeNull();

    const reused = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie);
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe('AUTH_REFRESH_REUSED');

    const revokedReplacement = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', replacementCookie);
    expect(revokedReplacement.status).toBe(401);

    const secondCookie = getCookiePair(secondRegistration);
    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', secondCookie);
    expect(logout.status).toBe(200);
    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', secondCookie);
    expect(refreshAfterLogout.status).toBe(401);

    const activeTokens = await prisma.refreshToken.count({
      where: {
        revokedAt: null,
        userId: storedUser.id,
      },
    });
    expect(activeTokens).toBe(0);
  });
});
