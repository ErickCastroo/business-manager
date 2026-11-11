export const USER_STATUS = {
  ACTIVE: 1,
  DISABLED: 0,
} as const;

export type AuthUserIdentityRecord = Readonly<{
  createdAt: Date;
  email: string;
  firstName: string;
  id: bigint;
  lastName: string | null;
  phone: string | null;
  status: number;
}>;

export type AuthUserRecord = AuthUserIdentityRecord &
  Readonly<{
    passwordHash: string;
  }>;

export type AuthMembershipRecord = Readonly<{
  branchIds: readonly bigint[];
  business: Readonly<{
    baseCurrencyCode: string;
    id: bigint;
    name: string;
    timezone: string;
  }>;
  businessUserId: bigint;
  isOwner: boolean;
  role: Readonly<{
    code: string;
    id: bigint;
    name: string;
  }>;
}>;

export type AuthProfileRecord = Readonly<{
  memberships: readonly AuthMembershipRecord[];
  user: AuthUserIdentityRecord;
}>;

export type RefreshTokenRecordInput = Readonly<{
  expiresAt: Date;
  ipAddress: string | null;
  tokenHash: string;
  userAgent: string | null;
}>;

export type RegisteredUserInput = Readonly<{
  email: string;
  firstName: string;
  lastName: string | null;
  passwordHash: string;
  phone: string | null;
  status: number;
}>;

export type SessionMetadata = Readonly<{
  ipAddress: string | null;
  userAgent: string | null;
}>;

export type RefreshRotationResult =
  | Readonly<{ status: 'expired' | 'invalid' | 'reused' | 'user-inactive' }>
  | Readonly<{ status: 'rotated'; user: AuthUserRecord }>;

export interface AuthRepository {
  createLoginSession(
    userId: bigint,
    token: RefreshTokenRecordInput,
    loggedInAt: Date,
  ): Promise<void>;
  createRegisteredUser(
    user: RegisteredUserInput,
    token: RefreshTokenRecordInput,
  ): Promise<AuthUserRecord>;
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  getUserProfile(userId: bigint): Promise<AuthProfileRecord | null>;
  revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void>;
  rotateRefreshToken(
    currentTokenHash: string,
    replacementToken: RefreshTokenRecordInput,
    rotatedAt: Date,
  ): Promise<RefreshRotationResult>;
}
