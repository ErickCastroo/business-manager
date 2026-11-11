import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { argon2id, hash, verify } from 'argon2';
import { jwtVerify, SignJWT } from 'jose';

import type { AuthConfig } from '../../config/auth.js';

const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  parallelism: 1,
  timeCost: 2,
  type: argon2id,
} as const;

const MAX_ACCESS_TOKEN_LENGTH = 4096;
const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{64}$/;

export type RefreshTokenPair = Readonly<{
  hash: string;
  raw: string;
}>;

export class AuthSecurity {
  readonly #config: AuthConfig;
  readonly #jwtSecret: Uint8Array;

  constructor(config: AuthConfig) {
    this.#config = config;
    this.#jwtSecret = new TextEncoder().encode(config.accessTokenSecret);
  }

  async hashPassword(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }

  createRefreshToken(): RefreshTokenPair {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    return {
      hash: this.hashRefreshToken(raw),
      raw,
    };
  }

  hashRefreshToken(rawToken: string): string {
    if (!REFRESH_TOKEN_PATTERN.test(rawToken)) {
      throw new Error('Refresh token format is invalid.');
    }

    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }

  async createAccessToken(userId: bigint, issuedAt: Date = new Date()): Promise<string> {
    const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);

    return new SignJWT({ tokenUse: 'access' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setAudience(this.#config.accessTokenAudience)
      .setExpirationTime(issuedAtSeconds + this.#config.accessTokenTtlSeconds)
      .setIssuedAt(issuedAtSeconds)
      .setIssuer(this.#config.accessTokenIssuer)
      .setJti(randomUUID())
      .setSubject(userId.toString())
      .sign(this.#jwtSecret);
  }

  async verifyAccessToken(token: string): Promise<bigint> {
    if (token.length === 0 || token.length > MAX_ACCESS_TOKEN_LENGTH) {
      throw new Error('Access token format is invalid.');
    }

    const { payload } = await jwtVerify(token, this.#jwtSecret, {
      algorithms: ['HS256'],
      audience: this.#config.accessTokenAudience,
      clockTolerance: 5,
      issuer: this.#config.accessTokenIssuer,
      typ: 'JWT',
    });

    if (payload.tokenUse !== 'access' || !/^[1-9][0-9]*$/.test(payload.sub ?? '')) {
      throw new Error('Access token claims are invalid.');
    }

    return BigInt(payload.sub as string);
  }
}
