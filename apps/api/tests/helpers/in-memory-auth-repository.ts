import {
  USER_STATUS,
  type AuthProfileRecord,
  type AuthRepository,
  type AuthUserRecord,
  type RefreshRotationResult,
  type RefreshTokenRecordInput,
  type RegisteredUserInput,
} from '../../src/modules/auth/auth.types.js';

type StoredRefreshToken = RefreshTokenRecordInput & {
  replacedByTokenHash: string | null;
  revokedAt: Date | null;
  userId: bigint;
};

class InMemoryUniqueConstraintError extends Error {
  readonly code = 'P2002';
}

export class InMemoryAuthRepository implements AuthRepository {
  #nextUserId = 1n;
  readonly #tokens = new Map<string, StoredRefreshToken>();
  readonly #users = new Map<bigint, AuthUserRecord>();

  async createRegisteredUser(
    input: RegisteredUserInput,
    token: RefreshTokenRecordInput,
  ): Promise<AuthUserRecord> {
    if ((await this.findUserByEmail(input.email)) !== null) {
      throw new InMemoryUniqueConstraintError('Email must be unique.');
    }

    const user: AuthUserRecord = {
      ...input,
      createdAt: new Date(),
      id: this.#nextUserId,
    };
    this.#nextUserId += 1n;
    this.#users.set(user.id, user);
    this.#storeToken(user.id, token);

    return user;
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return (
      [...this.#users.values()].find(
        (user) => user.email.toLocaleLowerCase('en-US') === email.toLocaleLowerCase('en-US'),
      ) ?? null
    );
  }

  async createLoginSession(
    userId: bigint,
    token: RefreshTokenRecordInput,
    _loggedInAt: Date,
  ): Promise<void> {
    this.#storeToken(userId, token);
  }

  async getUserProfile(userId: bigint): Promise<AuthProfileRecord | null> {
    const user = this.#users.get(userId);

    return user === undefined
      ? null
      : {
          memberships: [],
          user,
        };
  }

  async revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void> {
    const token = this.#tokens.get(tokenHash);

    if (token !== undefined && token.revokedAt === null) {
      token.revokedAt = revokedAt;
    }
  }

  async rotateRefreshToken(
    currentTokenHash: string,
    replacementToken: RefreshTokenRecordInput,
    rotatedAt: Date,
  ): Promise<RefreshRotationResult> {
    const currentToken = this.#tokens.get(currentTokenHash);

    if (currentToken === undefined) {
      return { status: 'invalid' };
    }

    if (currentToken.revokedAt !== null) {
      this.#revokeAllForUser(currentToken.userId, rotatedAt);
      return { status: 'reused' };
    }

    if (currentToken.expiresAt.getTime() <= rotatedAt.getTime()) {
      currentToken.revokedAt = rotatedAt;
      return { status: 'expired' };
    }

    const user = this.#users.get(currentToken.userId);

    if (user === undefined) {
      return { status: 'invalid' };
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      this.#revokeAllForUser(user.id, rotatedAt);
      return { status: 'user-inactive' };
    }

    this.#storeToken(user.id, replacementToken);
    currentToken.revokedAt = rotatedAt;
    currentToken.replacedByTokenHash = replacementToken.tokenHash;

    return { status: 'rotated', user };
  }

  disableUser(userId: bigint): void {
    const user = this.#users.get(userId);

    if (user !== undefined) {
      this.#users.set(userId, { ...user, status: USER_STATUS.DISABLED });
    }
  }

  #revokeAllForUser(userId: bigint, revokedAt: Date): void {
    for (const token of this.#tokens.values()) {
      if (token.userId === userId && token.revokedAt === null) {
        token.revokedAt = revokedAt;
      }
    }
  }

  #storeToken(userId: bigint, token: RefreshTokenRecordInput): void {
    this.#tokens.set(token.tokenHash, {
      ...token,
      replacedByTokenHash: null,
      revokedAt: null,
      userId,
    });
  }
}
