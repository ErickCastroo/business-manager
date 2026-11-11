import type {
  AuthSessionData,
  AuthToken,
  AuthUser,
  LoginRequest,
  MeData,
  RefreshData,
  RegisterRequest,
} from '@business-manager/contracts';

import type { AuthConfig } from '../../config/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthSecurity } from './auth-security.js';
import { isUniqueConstraintError } from './auth.repository.js';
import {
  USER_STATUS,
  type AuthProfileRecord,
  type AuthRepository,
  type AuthUserIdentityRecord,
  type RefreshTokenRecordInput,
  type SessionMetadata,
} from './auth.types.js';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$PIcEHXzrvkABK9JoBfIzNQ$pIkYopjMLVl30YNGTZUX8EFJr84ngoWySvcO+O1/Vyo';

export type AuthSessionResult = Readonly<{
  data: AuthSessionData;
  refreshToken: string;
}>;

export type RefreshSessionResult = Readonly<{
  data: RefreshData;
  refreshToken: string;
}>;

type Clock = () => Date;

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

function normalizeOptional(value: string | undefined): string | null {
  return value?.trim() ?? null;
}

function toAuthUser(user: AuthUserIdentityRecord): AuthUser {
  return {
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    firstName: user.firstName,
    id: user.id.toString(),
    lastName: user.lastName,
    phone: user.phone,
  };
}

function toMeData(profile: AuthProfileRecord): MeData {
  return {
    memberships: profile.memberships.map((membership) => ({
      branchIds: membership.branchIds.map(String),
      business: {
        baseCurrencyCode: membership.business.baseCurrencyCode,
        id: membership.business.id.toString(),
        name: membership.business.name,
        timezone: membership.business.timezone,
      },
      businessUserId: membership.businessUserId.toString(),
      isOwner: membership.isOwner,
      role: {
        code: membership.role.code,
        id: membership.role.id.toString(),
        name: membership.role.name,
      },
    })),
    user: toAuthUser(profile.user),
  };
}

export class AuthService {
  readonly #clock: Clock;
  readonly #config: AuthConfig;
  readonly #repository: AuthRepository;
  readonly #security: AuthSecurity;

  constructor(
    repository: AuthRepository,
    security: AuthSecurity,
    config: AuthConfig,
    clock: Clock = () => new Date(),
  ) {
    this.#clock = clock;
    this.#config = config;
    this.#repository = repository;
    this.#security = security;
  }

  async register(input: RegisterRequest, metadata: SessionMetadata): Promise<AuthSessionResult> {
    const email = normalizeEmail(input.email);
    const existingUser = await this.#repository.findUserByEmail(email);

    if (existingUser !== null) {
      throw new AppError({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Ya existe una cuenta registrada con ese correo.',
        statusCode: 409,
      });
    }

    const passwordHash = await this.#security.hashPassword(input.password);
    const now = this.#clock();
    const refreshToken = this.#security.createRefreshToken();
    const tokenRecord = this.#createRefreshTokenRecord(refreshToken.hash, metadata, now);

    try {
      const user = await this.#repository.createRegisteredUser(
        {
          email,
          firstName: input.firstName.trim(),
          lastName: normalizeOptional(input.lastName),
          passwordHash,
          phone: normalizeOptional(input.phone),
          status: USER_STATUS.ACTIVE,
        },
        tokenRecord,
      );

      return {
        data: {
          token: await this.#createAuthToken(user.id, now),
          user: toAuthUser(user),
        },
        refreshToken: refreshToken.raw,
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'Ya existe una cuenta registrada con ese correo.',
          statusCode: 409,
        });
      }

      throw error;
    }
  }

  async login(input: LoginRequest, metadata: SessionMetadata): Promise<AuthSessionResult> {
    const user = await this.#repository.findUserByEmail(normalizeEmail(input.email));
    const passwordMatches = await this.#security.verifyPassword(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      input.password,
    );

    if (user === null || !passwordMatches) {
      throw new AppError({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'El correo o la contraseña no son correctos.',
        statusCode: 401,
      });
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      throw new AppError({
        code: 'ACCOUNT_DISABLED',
        message: 'La cuenta está deshabilitada.',
        statusCode: 403,
      });
    }

    const now = this.#clock();
    const refreshToken = this.#security.createRefreshToken();
    await this.#repository.createLoginSession(
      user.id,
      this.#createRefreshTokenRecord(refreshToken.hash, metadata, now),
      now,
    );

    return {
      data: {
        token: await this.#createAuthToken(user.id, now),
        user: toAuthUser(user),
      },
      refreshToken: refreshToken.raw,
    };
  }

  async refresh(rawRefreshToken: string, metadata: SessionMetadata): Promise<RefreshSessionResult> {
    let currentTokenHash: string;

    try {
      currentTokenHash = this.#security.hashRefreshToken(rawRefreshToken);
    } catch {
      throw new AppError({
        code: 'AUTH_REFRESH_INVALID',
        message: 'La sesión de actualización no es válida.',
        statusCode: 401,
      });
    }

    const now = this.#clock();
    const replacementToken = this.#security.createRefreshToken();
    const rotation = await this.#repository.rotateRefreshToken(
      currentTokenHash,
      this.#createRefreshTokenRecord(replacementToken.hash, metadata, now),
      now,
    );

    if (rotation.status !== 'rotated') {
      const errorByStatus = {
        expired: {
          code: 'AUTH_REFRESH_EXPIRED',
          message: 'La sesión expiró. Inicia sesión nuevamente.',
          statusCode: 401,
        },
        invalid: {
          code: 'AUTH_REFRESH_INVALID',
          message: 'La sesión de actualización no es válida.',
          statusCode: 401,
        },
        reused: {
          code: 'AUTH_REFRESH_REUSED',
          message: 'La sesión fue revocada por seguridad. Inicia sesión nuevamente.',
          statusCode: 401,
        },
        'user-inactive': {
          code: 'ACCOUNT_DISABLED',
          message: 'La cuenta está deshabilitada.',
          statusCode: 403,
        },
      } as const;
      const error = errorByStatus[rotation.status];

      throw new AppError(error);
    }

    return {
      data: {
        token: await this.#createAuthToken(rotation.user.id, now),
      },
      refreshToken: replacementToken.raw,
    };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken === undefined) {
      return;
    }

    let tokenHash: string;

    try {
      tokenHash = this.#security.hashRefreshToken(rawRefreshToken);
    } catch {
      // Logout remains idempotent and does not disclose whether a cookie was recognized.
      return;
    }

    await this.#repository.revokeRefreshToken(tokenHash, this.#clock());
  }

  async me(userId: bigint): Promise<MeData> {
    const profile = await this.#repository.getUserProfile(userId);

    if (profile === null || profile.user.status !== USER_STATUS.ACTIVE) {
      throw new AppError({
        code: 'AUTH_TOKEN_INVALID',
        message: 'La sesión no es válida.',
        statusCode: 401,
      });
    }

    return toMeData(profile);
  }

  #createRefreshTokenRecord(
    tokenHash: string,
    metadata: SessionMetadata,
    createdAt: Date,
  ): RefreshTokenRecordInput {
    return {
      expiresAt: new Date(createdAt.getTime() + this.#config.refreshTokenTtlMs),
      ipAddress: metadata.ipAddress,
      tokenHash,
      userAgent: metadata.userAgent,
    };
  }

  async #createAuthToken(userId: bigint, issuedAt: Date): Promise<AuthToken> {
    return {
      accessToken: await this.#security.createAccessToken(userId, issuedAt),
      expiresIn: this.#config.accessTokenTtlSeconds,
      tokenType: 'Bearer',
    };
  }
}
