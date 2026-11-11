import { describe, expect, it } from 'vitest';

import { getAuthConfig } from '../src/config/auth.js';
import { AuthSecurity } from '../src/modules/auth/auth-security.js';

const config = getAuthConfig({
  ACCESS_TOKEN_TTL: '15m',
  JWT_ACCESS_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  NODE_ENV: 'test',
  REFRESH_TOKEN_DAYS: '30',
});

describe('AuthSecurity', () => {
  it('hashes and verifies passwords with the required Argon2id parameters', async () => {
    const security = new AuthSecurity(config);
    const passwordHash = await security.hashPassword('CorrectHorse7Battery');

    expect(passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await expect(security.verifyPassword(passwordHash, 'CorrectHorse7Battery')).resolves.toBe(true);
    await expect(security.verifyPassword(passwordHash, 'WrongPassword7')).resolves.toBe(false);
  });

  it('creates signed access tokens and rejects tampering', async () => {
    const security = new AuthSecurity(config);
    const accessToken = await security.createAccessToken(42n);
    const [header, payload, signature] = accessToken.split('.');

    expect(header).toBeDefined();
    expect(payload).toBeDefined();
    expect(signature).toBeDefined();
    await expect(security.verifyAccessToken(accessToken)).resolves.toBe(42n);

    if (signature === undefined) {
      throw new Error('The generated access token does not contain a signature.');
    }

    const tamperedSignature = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;

    await expect(
      security.verifyAccessToken(`${header}.${payload}.${tamperedSignature}`),
    ).rejects.toThrow();
  });

  it('generates unique opaque refresh tokens and stores only SHA-256 hashes', () => {
    const security = new AuthSecurity(config);
    const first = security.createRefreshToken();
    const second = security.createRefreshToken();

    expect(first.raw).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.hash).not.toBe(first.raw);
    expect(second.raw).not.toBe(first.raw);
    expect(second.hash).not.toBe(first.hash);
  });
});
