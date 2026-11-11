import type { AuthConfig } from '../src/config/auth.js';
import { getAuthConfig } from '../src/config/auth.js';
import { createApp } from '../src/app.js';
import request, { type Response as SupertestResponse } from 'supertest';
import { describe, expect, it } from 'vitest';

import { InMemoryAuthRepository } from './helpers/in-memory-auth-repository.js';

const VALID_PASSWORD = 'StrongPassword7';
const TEST_ORIGIN = 'http://localhost:5173';

function createTestConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    ...getAuthConfig({
      ACCESS_TOKEN_TTL: '15m',
      JWT_ACCESS_SECRET: 'test-secret-with-at-least-thirty-two-characters',
      NODE_ENV: 'test',
      REFRESH_TOKEN_DAYS: '30',
    }),
    ...overrides,
  };
}

function createTestApp(repository = new InMemoryAuthRepository(), config = createTestConfig()) {
  return {
    app: createApp({
      auth: { config, repository },
      exposeApiDocs: true,
      http: {
        allowedOrigins: new Set([TEST_ORIGIN]),
        isProduction: false,
      },
    }),
    repository,
  };
}

function getSetCookieHeaders(response: SupertestResponse): string[] {
  const setCookie: unknown = response.headers['set-cookie'];

  if (typeof setCookie === 'string') {
    return [setCookie];
  }

  if (Array.isArray(setCookie) && setCookie.every((value) => typeof value === 'string')) {
    return setCookie;
  }

  throw new Error('Response did not include a Set-Cookie header.');
}

function getCookiePair(response: SupertestResponse): string {
  const cookie = getSetCookieHeaders(response)[0];

  if (cookie === undefined) {
    throw new Error('Response did not include a refresh cookie.');
  }

  return cookie.split(';', 1)[0] ?? cookie;
}

function validRegistration(email = 'owner@example.com') {
  return {
    email,
    firstName: '  Alicia  ',
    lastName: 'Dueña',
    password: VALID_PASSWORD,
    phone: '+52 614 123 4567',
  };
}

describe('authentication API', () => {
  it('registers a user, sets an HttpOnly cookie and authorizes GET /me', async () => {
    const { app } = createTestApp();
    const registration = await request(app)
      .post('/api/v1/auth/register')
      .send(validRegistration('OWNER@Example.com'));

    expect(registration.status).toBe(201);
    expect(registration.body.data.user).toMatchObject({
      email: 'owner@example.com',
      firstName: 'Alicia',
      id: '1',
    });
    expect(registration.body.data.token).toMatchObject({
      expiresIn: 900,
      tokenType: 'Bearer',
    });
    expect(JSON.stringify(registration.body)).not.toContain(VALID_PASSWORD);
    expect(JSON.stringify(registration.body)).not.toContain('passwordHash');

    const cookie = getSetCookieHeaders(registration).join('; ');
    expect(cookie).toContain('business_manager_refresh=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie).not.toContain('Secure');

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registration.body.data.token.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({
      memberships: [],
      user: {
        email: 'owner@example.com',
        id: '1',
      },
    });
    expect(me.body.meta.requestId).toEqual(expect.any(String));
  });

  it('rejects duplicate email addresses without case sensitivity', async () => {
    const { app } = createTestApp();

    await request(app).post('/api/v1/auth/register').send(validRegistration('user@example.com'));
    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .send(validRegistration('USER@example.com'));

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('uses a generic error for invalid login and creates a session for valid credentials', async () => {
    const { app } = createTestApp();
    await request(app).post('/api/v1/auth/register').send(validRegistration());

    const invalid = await request(app).post('/api/v1/auth/login').send({
      email: 'owner@example.com',
      password: 'WrongPassword7',
    });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error).toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'El correo o la contraseña no son correctos.',
    });

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'OWNER@example.com',
      password: VALID_PASSWORD,
    });
    expect(login.status).toBe(200);
    expect(login.body.data.user.email).toBe('owner@example.com');
    expect(getSetCookieHeaders(login).join('; ')).toContain('HttpOnly');
  });

  it('rejects login and refresh when the account is disabled', async () => {
    const repository = new InMemoryAuthRepository();
    const { app } = createTestApp(repository);
    const registration = await request(app).post('/api/v1/auth/register').send(validRegistration());
    repository.disableUser(1n);

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'owner@example.com',
      password: VALID_PASSWORD,
    });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_DISABLED');

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', getCookiePair(registration));
    expect(refresh.status).toBe(403);
    expect(refresh.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('rotates refresh tokens and revokes the token family when an old token is reused', async () => {
    const { app } = createTestApp();
    const registration = await request(app).post('/api/v1/auth/register').send(validRegistration());
    const oldCookie = getCookiePair(registration);

    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);
    expect(refresh.status).toBe(200);
    const replacementCookie = getCookiePair(refresh);
    expect(replacementCookie).not.toBe(oldCookie);

    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('AUTH_REFRESH_REUSED');

    const revokedReplacement = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', replacementCookie);
    expect(revokedReplacement.status).toBe(401);
  });

  it('revokes the refresh token on logout and clears the cookie', async () => {
    const { app } = createTestApp();
    const registration = await request(app).post('/api/v1/auth/register').send(validRegistration());
    const cookie = getCookiePair(registration);

    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);
    expect(logout.body.data).toEqual({ loggedOut: true });
    expect(getSetCookieHeaders(logout).join('; ')).toContain('Expires=Thu, 01 Jan 1970');

    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);
    expect(refresh.body.error.code).toBe('AUTH_REFRESH_REUSED');
  });

  it('validates registration input without returning the submitted password', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...validRegistration(),
        password: 'weak',
        unexpected: true,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
    expect(JSON.stringify(response.body)).not.toContain('weak');
  });

  it('requires a valid Bearer access token for GET /me', async () => {
    const { app } = createTestApp();

    const missing = await request(app).get('/api/v1/auth/me');
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTH_TOKEN_MISSING');

    const invalid = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('requires the refresh cookie and marks it Secure in production mode', async () => {
    const { app } = createTestApp(
      new InMemoryAuthRepository(),
      createTestConfig({ cookieSecure: true }),
    );
    const missing = await request(app).post('/api/v1/auth/refresh');
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTH_REFRESH_MISSING');

    const registration = await request(app).post('/api/v1/auth/register').send(validRegistration());
    expect(getSetCookieHeaders(registration).join('; ')).toContain('Secure');
  });

  it('rate limits repeated authentication attempts with a stable error response', async () => {
    const { app } = createTestApp(
      new InMemoryAuthRepository(),
      createTestConfig({ registerRateLimit: 2 }),
    );

    await request(app).post('/api/v1/auth/register').send({});
    await request(app).post('/api/v1/auth/register').send({});
    const limited = await request(app).post('/api/v1/auth/register').send({});

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(limited.headers['ratelimit']).toEqual(expect.any(String));
  });

  it.each([
    {
      body: { email: 'missing@example.com', password: VALID_PASSWORD },
      path: '/api/v1/auth/login',
      rateOverride: { loginRateLimit: 1 },
    },
    {
      body: undefined,
      path: '/api/v1/auth/refresh',
      rateOverride: { refreshRateLimit: 1 },
    },
  ])('applies the rate limiter to $path', async ({ body, path, rateOverride }) => {
    const { app } = createTestApp(new InMemoryAuthRepository(), createTestConfig(rateOverride));
    const firstRequest = request(app).post(path);

    if (body !== undefined) {
      firstRequest.send(body);
    }

    await firstRequest;
    const secondRequest = request(app).post(path);

    if (body !== undefined) {
      secondRequest.send(body);
    }

    const limited = await secondRequest;
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('returns stable errors for malformed JSON and includes Helmet headers', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('denies credentialed requests from origins outside the CORS allowlist', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://malicious.example')
      .send({ email: 'owner@example.com', password: VALID_PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CORS_ORIGIN_DENIED');
  });

  it('publishes all five auth operations and their security schemes in OpenAPI', async () => {
    const { app } = createTestApp();
    const response = await request(app).get('/openapi.json');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/auth/register',
        '/api/v1/auth/login',
        '/api/v1/auth/refresh',
        '/api/v1/auth/logout',
        '/api/v1/auth/me',
      ]),
    );
    expect(response.body.components.securitySchemes).toMatchObject({
      bearerAuth: { scheme: 'bearer', type: 'http' },
      refreshCookie: { in: 'cookie', type: 'apiKey' },
    });
  });
});
