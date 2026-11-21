import { createHash, randomBytes } from 'node:crypto';

import {
  memberBranchIdsSchema,
  type InviteMemberInput,
  type MemberData,
  type UpdateMemberInput,
} from '@business-manager/contracts';

import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { USER_STATUS } from '../auth/auth.types.js';
import {
  accessibleBranches,
  resolveBusinessContext,
  type BusinessContext,
} from '../tenancy/business-context.js';
import { BUSINESS_ACTIVE } from '../tenancy/tenant-catalog.js';
import type { PageInput } from '../tenancy/tenant.service.js';
import type { InvitationMailer } from './invitation-mailer.js';

const invitationLifetime = 48 * 60 * 60 * 1000;
const roleSelect = { id: true, code: true, name: true } satisfies Prisma.RoleSelect;
const userSelect = { email: true, firstName: true, lastName: true } satisfies Prisma.UserSelect;
const memberSelect = {
  id: true,
  businessId: true,
  isOwner: true,
  isActive: true,
  user: { select: userSelect },
  role: { select: roleSelect },
  userBranchAccesses: { select: { branchId: true }, orderBy: { branchId: 'asc' } },
} satisfies Prisma.BusinessUserSelect;
type MemberRow = Prisma.BusinessUserGetPayload<{ select: typeof memberSelect }>;
type AuditMetadata = { requestId: string; ipAddress: string | null };

function toMember(row: MemberRow): MemberData {
  return {
    ...row.user,
    id: String(row.id),
    businessId: String(row.businessId),
    role: { ...row.role, id: String(row.role.id) },
    branchIds: row.userBranchAccesses.map(({ branchId }) => String(branchId)),
    isOwner: row.isOwner,
    isActive: row.isActive,
  };
}

function invitationHash(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

function invitationUnavailable() {
  return new AppError({
    code: 'INVITATION_UNAVAILABLE',
    message:
      'La invitación no está disponible para esta cuenta. Solicita una nueva al propietario.',
    statusCode: 404,
  });
}

function alreadyMember() {
  return new AppError({
    code: 'MEMBER_ALREADY_EXISTS',
    message: 'Esta cuenta ya tiene una membresía en el negocio.',
    statusCode: 409,
  });
}

function snapshot(member: MemberData) {
  return { roleId: member.role.id, branchIds: member.branchIds, isActive: member.isActive };
}

function assertOwner(context: BusinessContext) {
  if (!context.isOwner) {
    throw new AppError({
      code: 'OWNER_REQUIRED',
      message: 'Solo el propietario puede administrar membresías e invitaciones.',
      statusCode: 403,
    });
  }
}

async function requireOwner(tx: Prisma.TransactionClient, context: BusinessContext) {
  const scope = await resolveBusinessContext(
    tx,
    context.userId,
    context.businessId,
    'users.manage',
  );
  assertOwner(scope);
  return scope;
}

async function assertAssignments(
  tx: Prisma.TransactionClient,
  businessId: bigint,
  roleId: bigint,
  branchIds: bigint[],
) {
  const role = await tx.role.findFirst({
    where: { businessId, id: roleId, isActive: true, code: { not: 'OWNER' } },
    select: { id: true },
  });
  if (role === null) {
    throw new AppError({
      code: 'ROLE_NOT_ASSIGNABLE',
      message: 'El rol seleccionado no está disponible para asignación.',
      statusCode: 400,
    });
  }

  const branches = await tx.branch.count({
    where: { businessId, id: { in: branchIds }, isActive: true },
  });
  if (branches !== branchIds.length) {
    throw new AppError({
      code: 'BRANCH_ASSIGNMENT_INVALID',
      message: 'Selecciona únicamente sucursales activas del negocio.',
      statusCode: 400,
    });
  }
}

async function insertBranchGrants(
  tx: Prisma.TransactionClient,
  businessId: bigint,
  businessUserId: bigint,
  branchIds: bigint[],
) {
  if (branchIds.length === 0) return;
  await tx.userBranchAccess.createMany({
    data: branchIds.map((branchId) => ({ businessId, businessUserId, branchId })),
  });
}

async function audit(
  tx: Prisma.TransactionClient,
  metadata: AuditMetadata,
  event: {
    businessId: bigint;
    businessUserId: bigint;
    entityId: bigint;
    entityType: 'MembershipInvitation' | 'BusinessUser';
    action: 'ISSUE' | 'ACCEPT' | 'UPDATE';
    after: object;
    before?: object;
  },
) {
  const { entityId, after, before, ...fields } = event;
  await tx.auditLog.create({
    data: {
      ...fields,
      entityId: String(entityId),
      beforeJson: before === undefined ? null : JSON.stringify(before),
      afterJson: JSON.stringify(after),
      requestId: metadata.requestId.slice(0, 80),
      ipAddress: metadata.ipAddress,
    },
  });
}

export class MembersService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(context: BusinessContext, { page, pageSize }: PageInput) {
    const where = { businessId: context.businessId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.businessUser.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          ...memberSelect,
          userBranchAccesses: {
            ...memberSelect.userBranchAccesses,
            where: { branch: accessibleBranches(context) },
          },
        },
      }),
      this.prisma.businessUser.count({ where }),
    ]);
    return { data: rows.map(toMember), total };
  }

  async listRoles(context: BusinessContext) {
    const roles = await this.prisma.role.findMany({
      where: { businessId: context.businessId, isActive: true },
      orderBy: { code: 'asc' },
      select: {
        ...roleSelect,
        rolePermissions: { select: { permission: { select: { code: true } } } },
      },
    });
    return roles.map(({ id, code, name, rolePermissions }) => ({
      id: String(id),
      code,
      name,
      permissionCodes: rolePermissions.map(({ permission }) => permission.code).sort(),
    }));
  }

  async invite(context: BusinessContext, input: InviteMemberInput, metadata: AuditMetadata) {
    const { invitationCode, expiresAt } = await this.#issueInvitation(context, input, metadata);
    return { invitationCode, expiresAt };
  }

  async inviteByEmail(
    context: BusinessContext,
    input: InviteMemberInput,
    metadata: AuditMetadata,
    mailer: InvitationMailer | null,
  ) {
    assertOwner(context);
    if (!mailer) {
      throw new AppError({
        code: 'INVITATION_EMAIL_UNAVAILABLE',
        message: 'El envío por correo aún no está configurado. Puedes generar un enlace manual.',
        statusCode: 503,
      });
    }
    const issued = await this.#issueInvitation(context, input, metadata, 'email');
    try {
      await mailer.send({
        email: issued.email,
        businessName: issued.businessName,
        invitationCode: issued.invitationCode,
        requiresRegistration: issued.requiresRegistration,
      });
    } catch {
      throw new AppError({
        code: 'INVITATION_EMAIL_FAILED',
        message:
          'El servidor de correo no confirmó el envío. Puedes reintentar o generar un enlace manual.',
        statusCode: 502,
      });
    }
    return { sent: true as const, expiresAt: issued.expiresAt };
  }

  #issueInvitation(
    context: BusinessContext,
    input: InviteMemberInput,
    metadata: AuditMetadata,
    delivery: 'manual' | 'email' = 'manual',
  ) {
    return this.#write(async (tx) => {
      const { businessId, businessUserId } = await requireOwner(tx, context);
      const email = input.email.toLowerCase();
      const business = await tx.business.findUniqueOrThrow({
        where: { id: businessId },
        select: { name: true },
      });
      const roleId = BigInt(input.roleId);
      await assertAssignments(tx, businessId, roleId, input.branchIds.map(BigInt));
      const member = await tx.businessUser.findFirst({
        where: { businessId, user: { email } },
        select: { id: true },
      });
      if (member !== null) throw alreadyMember();
      const requiresRegistration =
        delivery === 'email' &&
        (await tx.user.findUnique({ where: { email }, select: { id: true } })) === null;

      const invitationCode = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + invitationLifetime);
      const data = {
        roleId,
        branchIds: JSON.stringify(input.branchIds),
        tokenHash: invitationHash(invitationCode),
        expiresAt,
        acceptedAt: null,
      };
      const invitation = await tx.membershipInvitation.upsert({
        where: { businessId_email: { businessId, email } },
        create: { ...data, businessId, email },
        update: data,
        select: { id: true },
      });
      await audit(tx, metadata, {
        businessId,
        businessUserId,
        entityId: invitation.id,
        entityType: 'MembershipInvitation',
        action: 'ISSUE',
        after: {
          roleId: input.roleId,
          branchIds: input.branchIds,
          expiresAt: expiresAt.toISOString(),
        },
      });
      return {
        invitationCode,
        expiresAt: expiresAt.toISOString(),
        businessName: business.name,
        email,
        requiresRegistration,
      };
    });
  }

  accept(userId: bigint, invitationCode: string, metadata: AuditMetadata) {
    return this.#write(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, status: USER_STATUS.ACTIVE },
        select: { email: true },
      });
      if (user === null) throw invitationUnavailable();
      const tokenHash = invitationHash(invitationCode);
      const invitation = await tx.membershipInvitation.findFirst({
        where: {
          tokenHash,
          email: user.email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
          business: { status: BUSINESS_ACTIVE },
        },
        select: { id: true, businessId: true, roleId: true, branchIds: true, email: true },
      });
      if (invitation === null || invitation.email !== user.email.toLowerCase()) {
        throw invitationUnavailable();
      }
      const { businessId, roleId } = invitation;
      const ids = memberBranchIdsSchema.parse(JSON.parse(invitation.branchIds)).map(BigInt);
      await assertAssignments(tx, businessId, roleId, ids);
      const member = await tx.businessUser.findUnique({
        where: { businessId_userId: { businessId, userId } },
        select: { id: true },
      });
      if (member !== null) throw alreadyMember();

      const now = new Date();
      const claim = await tx.membershipInvitation.updateMany({
        where: {
          id: invitation.id,
          businessId,
          tokenHash,
          acceptedAt: null,
          expiresAt: { gt: now },
        },
        data: { acceptedAt: now },
      });
      if (claim.count !== 1) throw invitationUnavailable();
      const created = await tx.businessUser.create({
        data: { businessId, userId, roleId, isActive: true, isOwner: false },
        select: { id: true },
      });
      await insertBranchGrants(tx, businessId, created.id, ids);
      const row = await tx.businessUser.findUniqueOrThrow({
        where: { businessId_id: { businessId, id: created.id } },
        select: memberSelect,
      });
      const result = toMember(row);
      await audit(tx, metadata, {
        businessId,
        businessUserId: created.id,
        entityId: created.id,
        entityType: 'BusinessUser',
        action: 'ACCEPT',
        after: snapshot(result),
      });
      return result;
    });
  }

  update(context: BusinessContext, id: bigint, input: UpdateMemberInput, metadata: AuditMetadata) {
    return this.#write(async (tx) => {
      const { businessId, businessUserId } = await requireOwner(tx, context);
      const where = { businessId_id: { businessId, id } };
      const row = await tx.businessUser.findUnique({ where, select: memberSelect });
      if (row === null) {
        throw new AppError({
          code: 'MEMBER_NOT_FOUND',
          message: 'La membresía no está disponible.',
          statusCode: 404,
        });
      }
      if (row.isOwner || row.role.code === 'OWNER') {
        throw new AppError({
          code: 'OWNER_MEMBERSHIP_PROTECTED',
          message: 'La membresía del propietario está protegida.',
          statusCode: 403,
        });
      }

      const roleId = input.roleId === undefined ? row.role.id : BigInt(input.roleId);
      const ids = input.branchIds?.map(BigInt);
      if (input.roleId !== undefined || ids !== undefined) {
        await assertAssignments(tx, businessId, roleId, ids ?? []);
      }
      await tx.businessUser.update({
        where,
        data: { roleId, isActive: input.isActive ?? row.isActive },
        select: { id: true },
      });
      if (ids !== undefined) {
        await tx.userBranchAccess.deleteMany({ where: { businessId, businessUserId: id } });
        await insertBranchGrants(tx, businessId, id, ids);
      }
      const result = toMember(
        await tx.businessUser.findUniqueOrThrow({ where, select: memberSelect }),
      );
      await audit(tx, metadata, {
        businessId,
        businessUserId,
        entityId: id,
        entityType: 'BusinessUser',
        action: 'UPDATE',
        before: snapshot(toMember(row)),
        after: snapshot(result),
      });
      return result;
    });
  }

  async #write<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const options = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };
    try {
      return await this.prisma.$transaction(operation, options);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return this.prisma.$transaction(operation, options);
      }
      throw error;
    }
  }
}
