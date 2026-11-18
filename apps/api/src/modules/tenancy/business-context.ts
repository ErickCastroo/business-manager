import type { Request } from 'express';

import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { USER_STATUS } from '../auth/auth.types.js';
import { BUSINESS_ACTIVE, type PermissionCode } from './tenant-catalog.js';

export type BusinessContext = Readonly<{
  userId: bigint;
  businessId: bigint;
  businessUserId: bigint;
  roleId: bigint;
  isOwner: boolean;
}>;

const BUSINESS_CONTEXT = Symbol('business-context');
type ScopedRequest = Request & { [BUSINESS_CONTEXT]?: BusinessContext };

export function setBusinessContext(request: Request, context: BusinessContext): void {
  (request as ScopedRequest)[BUSINESS_CONTEXT] = context;
}

export function getBusinessContext(request: Request): BusinessContext {
  const context = (request as ScopedRequest)[BUSINESS_CONTEXT];
  if (context === undefined) throw new Error('Business context is missing.');
  return context;
}

export function businessNotFound(): AppError {
  return new AppError({
    code: 'BUSINESS_NOT_FOUND',
    message: 'El negocio no está disponible.',
    statusCode: 404,
  });
}

export function activeMembership(userId: bigint): Prisma.BusinessUserWhereInput {
  return {
    userId,
    isActive: true,
    user: { status: USER_STATUS.ACTIVE },
    business: { status: BUSINESS_ACTIVE },
    role: { isActive: true },
  };
}

export async function resolveBusinessContext(
  prisma: Prisma.TransactionClient,
  userId: bigint,
  businessId: bigint,
  permission: PermissionCode,
): Promise<BusinessContext> {
  const membership = await prisma.businessUser.findFirst({
    where: { ...activeMembership(userId), businessId },
    select: {
      id: true,
      businessId: true,
      isOwner: true,
      roleId: true,
      role: {
        select: {
          rolePermissions: {
            where: { permission: { code: permission } },
            select: { permissionId: true },
          },
        },
      },
    },
  });

  if (membership === null) throw businessNotFound();

  if (membership.role.rolePermissions.length === 0) {
    throw new AppError({
      code: 'PERMISSION_DENIED',
      message: 'No tienes permiso para esta operación.',
      statusCode: 403,
    });
  }

  return {
    userId,
    businessId: membership.businessId,
    businessUserId: membership.id,
    isOwner: membership.isOwner,
    roleId: membership.roleId,
  };
}

export function accessibleBranches(context: BusinessContext): Prisma.BranchWhereInput {
  return {
    businessId: context.businessId,
    isActive: true,
    ...(context.isOwner
      ? {}
      : {
          userBranchAccesses: {
            some: { businessId: context.businessId, businessUserId: context.businessUserId },
          },
        }),
  };
}
