import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import {
  USER_STATUS,
  type AuthProfileRecord,
  type AuthRepository,
  type AuthUserRecord,
  type RefreshRotationResult,
  type RefreshTokenRecordInput,
  type RegisteredUserInput,
} from './auth.types.js';

const AUTH_USER_SELECT = {
  createdAt: true,
  email: true,
  firstName: true,
  id: true,
  lastName: true,
  passwordHash: true,
  phone: true,
  status: true,
} satisfies Prisma.UserSelect;

const AUTH_PROFILE_SELECT = {
  createdAt: true,
  email: true,
  firstName: true,
  id: true,
  lastName: true,
  phone: true,
  status: true,
  businessUsers: {
    include: {
      business: {
        select: {
          baseCurrencyCode: true,
          id: true,
          name: true,
          timezone: true,
        },
      },
      role: {
        select: {
          code: true,
          id: true,
          name: true,
        },
      },
      userBranchAccesses: {
        select: {
          branchId: true,
        },
        where: {
          branch: {
            isActive: true,
          },
        },
      },
    },
    where: {
      business: {
        status: USER_STATUS.ACTIVE,
      },
      isActive: true,
      role: {
        isActive: true,
      },
    },
  },
} satisfies Prisma.UserSelect;

type SelectedAuthUser = Prisma.UserGetPayload<{ select: typeof AUTH_USER_SELECT }>;
type SelectedAuthProfile = Prisma.UserGetPayload<{ select: typeof AUTH_PROFILE_SELECT }>;

class RefreshRotationRaceError extends Error {}

function mapAuthUser(user: SelectedAuthUser): AuthUserRecord {
  return {
    createdAt: user.createdAt,
    email: user.email,
    firstName: user.firstName,
    id: user.id,
    lastName: user.lastName,
    passwordHash: user.passwordHash,
    phone: user.phone,
    status: user.status,
  };
}

function mapAuthProfile(profile: SelectedAuthProfile): AuthProfileRecord {
  return {
    memberships: profile.businessUsers.map((membership) => ({
      branchIds: membership.userBranchAccesses.map((access) => access.branchId),
      business: membership.business,
      businessUserId: membership.id,
      isOwner: membership.isOwner,
      role: membership.role,
    })),
    user: {
      createdAt: profile.createdAt,
      email: profile.email,
      firstName: profile.firstName,
      id: profile.id,
      lastName: profile.lastName,
      phone: profile.phone,
      status: profile.status,
    },
  };
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

export function isUniqueConstraintError(error: unknown): boolean {
  return hasPrismaErrorCode(error, 'P2002');
}

export class PrismaAuthRepository implements AuthRepository {
  readonly #prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma;
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.#prisma.user.findUnique({
      select: AUTH_USER_SELECT,
      where: { email },
    });

    return user === null ? null : mapAuthUser(user);
  }

  async createRegisteredUser(
    userInput: RegisteredUserInput,
    tokenInput: RefreshTokenRecordInput,
  ): Promise<AuthUserRecord> {
    const user = await this.#prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          email: userInput.email,
          firstName: userInput.firstName,
          lastLoginAt: new Date(),
          lastName: userInput.lastName,
          passwordHash: userInput.passwordHash,
          phone: userInput.phone,
          status: userInput.status,
        },
        select: AUTH_USER_SELECT,
      });

      await transaction.refreshToken.create({
        data: {
          ...tokenInput,
          userId: createdUser.id,
        },
      });

      return createdUser;
    });

    return mapAuthUser(user);
  }

  async createLoginSession(
    userId: bigint,
    tokenInput: RefreshTokenRecordInput,
    loggedInAt: Date,
  ): Promise<void> {
    await this.#prisma.$transaction([
      this.#prisma.user.update({
        data: { lastLoginAt: loggedInAt },
        where: { id: userId },
      }),
      this.#prisma.refreshToken.create({
        data: {
          ...tokenInput,
          userId,
        },
      }),
    ]);
  }

  async getUserProfile(userId: bigint): Promise<AuthProfileRecord | null> {
    const profile = await this.#prisma.user.findUnique({
      select: AUTH_PROFILE_SELECT,
      where: { id: userId },
    });

    return profile === null ? null : mapAuthProfile(profile);
  }

  async revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.#prisma.refreshToken.updateMany({
      data: { revokedAt },
      where: {
        revokedAt: null,
        tokenHash,
      },
    });
  }

  async rotateRefreshToken(
    currentTokenHash: string,
    replacementToken: RefreshTokenRecordInput,
    rotatedAt: Date,
  ): Promise<RefreshRotationResult> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.#rotateRefreshTokenTransaction(
          currentTokenHash,
          replacementToken,
          rotatedAt,
        );
      } catch (error) {
        const canRetry =
          attempt === 0 &&
          (error instanceof RefreshRotationRaceError || hasPrismaErrorCode(error, 'P2034'));

        if (!canRetry) {
          throw error;
        }
      }
    }

    return { status: 'invalid' };
  }

  async #rotateRefreshTokenTransaction(
    currentTokenHash: string,
    replacementToken: RefreshTokenRecordInput,
    rotatedAt: Date,
  ): Promise<RefreshRotationResult> {
    return this.#prisma.$transaction(
      async (transaction) => {
        const currentToken = await transaction.refreshToken.findUnique({
          include: {
            user: {
              select: AUTH_USER_SELECT,
            },
          },
          where: { tokenHash: currentTokenHash },
        });

        if (currentToken === null) {
          return { status: 'invalid' };
        }

        if (currentToken.revokedAt !== null) {
          await transaction.refreshToken.updateMany({
            data: { revokedAt: rotatedAt },
            where: {
              revokedAt: null,
              userId: currentToken.userId,
            },
          });
          return { status: 'reused' };
        }

        if (currentToken.expiresAt.getTime() <= rotatedAt.getTime()) {
          await transaction.refreshToken.updateMany({
            data: { revokedAt: rotatedAt },
            where: {
              id: currentToken.id,
              revokedAt: null,
            },
          });
          return { status: 'expired' };
        }

        if (currentToken.user.status !== USER_STATUS.ACTIVE) {
          await transaction.refreshToken.updateMany({
            data: { revokedAt: rotatedAt },
            where: {
              revokedAt: null,
              userId: currentToken.userId,
            },
          });
          return { status: 'user-inactive' };
        }

        const createdToken = await transaction.refreshToken.create({
          data: {
            ...replacementToken,
            userId: currentToken.userId,
          },
        });
        const rotation = await transaction.refreshToken.updateMany({
          data: {
            replacedByTokenId: createdToken.id,
            revokedAt: rotatedAt,
          },
          where: {
            id: currentToken.id,
            revokedAt: null,
          },
        });

        if (rotation.count !== 1) {
          throw new RefreshRotationRaceError('Refresh token was rotated concurrently.');
        }

        return {
          status: 'rotated',
          user: mapAuthUser(currentToken.user),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}
