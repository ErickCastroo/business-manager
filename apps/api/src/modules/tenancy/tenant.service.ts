import type {
  BranchData,
  BusinessData,
  CreateBranchInput,
  CreateBusinessInput,
  OnboardingData,
  UpdateBranchInput,
  UpdateBusinessInput,
} from '@business-manager/contracts';

import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isUniqueConstraintError } from '../auth/auth.repository.js';
import { USER_STATUS } from '../auth/auth.types.js';
import {
  accessibleBranches,
  activeMembership,
  businessNotFound,
  resolveBusinessContext,
  type BusinessContext,
} from './business-context.js';
import { BUSINESS_ACTIVE, DEFAULT_ROLES, SEED_PERMISSIONS } from './tenant-catalog.js';

const businessSelect = {
  id: true,
  name: true,
  baseCurrencyCode: true,
  timezone: true,
} satisfies Prisma.BusinessSelect;
const branchSelect = {
  id: true,
  businessId: true,
  code: true,
  name: true,
  timezone: true,
  isMain: true,
} satisfies Prisma.BranchSelect;
const AUDIT_REQUEST_ID_MAX_LENGTH = 80;

type BusinessRow = Prisma.BusinessGetPayload<{ select: typeof businessSelect }>;
type BranchRow = Prisma.BranchGetPayload<{ select: typeof branchSelect }>;
export type PageInput = Readonly<{ page: number; pageSize: number }>;
type RequestMetadata = Readonly<{ requestId: string; ipAddress: string | null }>;

function serializeBusiness(row: BusinessRow): BusinessData {
  return { ...row, id: String(row.id) };
}

function serializeBranch(row: BranchRow): BranchData {
  return { ...row, id: String(row.id), businessId: String(row.businessId) };
}

function branchNotFound(): AppError {
  return new AppError({
    code: 'BRANCH_NOT_FOUND',
    message: 'La sucursal no está disponible.',
    statusCode: 404,
  });
}

function branchConflict(error: unknown): never {
  if (!isUniqueConstraintError(error)) throw error;
  throw new AppError({
    code: 'BRANCH_CODE_ALREADY_EXISTS',
    message: 'Ya existe una sucursal con ese código en el negocio.',
    statusCode: 409,
  });
}

async function requireActiveUser(prisma: Prisma.TransactionClient, userId: bigint) {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: USER_STATUS.ACTIVE },
    select: { id: true },
  });

  if (user === null) {
    throw new AppError({
      code: 'ACCOUNT_DISABLED',
      message: 'La cuenta no está disponible.',
      statusCode: 403,
    });
  }
}

async function audit(
  prisma: Prisma.TransactionClient,
  context: Pick<BusinessContext, 'businessId' | 'businessUserId'>,
  metadata: RequestMetadata,
  entityType: 'Business' | 'Branch',
  action: 'CREATE' | 'UPDATE',
  after: { id: string },
  before?: { id: string },
) {
  await prisma.auditLog.create({
    data: {
      businessId: context.businessId,
      businessUserId: context.businessUserId,
      ipAddress: metadata.ipAddress,
      requestId: metadata.requestId.slice(0, AUDIT_REQUEST_ID_MAX_LENGTH),
      entityType,
      entityId: after.id,
      branchId: entityType === 'Branch' ? BigInt(after.id) : null,
      action,
      beforeJson: before === undefined ? null : JSON.stringify(before),
      afterJson: JSON.stringify(after),
    },
  });
}

const writeOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

export class TenantService {
  constructor(private readonly prisma: PrismaClient) {}

  async createBusiness(userId: bigint, input: CreateBusinessInput, metadata: RequestMetadata) {
    return this.prisma.$transaction(async (tx) => {
      await requireActiveUser(tx, userId);
      const [currency, permissions] = await Promise.all([
        tx.currency.findFirst({ where: { code: input.baseCurrencyCode, isActive: true } }),
        tx.permission.findMany({
          where: { code: { in: SEED_PERMISSIONS.map(({ code }) => code) } },
          select: { id: true, code: true },
        }),
      ]);

      if (currency === null || permissions.length !== SEED_PERMISSIONS.length) {
        throw new AppError({
          code: 'ONBOARDING_CATALOG_UNAVAILABLE',
          message: 'El catálogo inicial del negocio no está disponible.',
          statusCode: 503,
        });
      }

      const business = await tx.business.create({
        data: {
          name: input.name,
          baseCurrencyCode: input.baseCurrencyCode,
          timezone: input.timezone,
          status: BUSINESS_ACTIVE,
        },
        select: businessSelect,
      });
      const businessId = business.id;
      const branch = await tx.branch.create({
        data: {
          businessId,
          name: input.mainBranch.name,
          code: input.mainBranch.code.toUpperCase(),
          timezone: input.mainBranch.timezone ?? input.timezone,
          isMain: true,
          isActive: true,
        },
        select: branchSelect,
      });

      let ownerRoleId: bigint | undefined;
      for (const role of DEFAULT_ROLES) {
        const { id: roleId } = await tx.role.create({
          data: { businessId, code: role.code, name: role.name, isSystem: true, isActive: true },
          select: { id: true },
        });
        const codes = new Set<string>(role.permissions);
        await tx.rolePermission.createMany({
          data: permissions
            .filter(({ code }) => codes.has(code))
            .map(({ id: permissionId }) => ({ roleId, permissionId })),
        });
        if (role.code === 'OWNER') ownerRoleId = roleId;
      }
      if (ownerRoleId === undefined) throw new Error('The OWNER role is missing.');

      const owner = await tx.businessUser.create({
        data: { businessId, userId, roleId: ownerRoleId, isOwner: true, isActive: true },
        select: { id: true },
      });
      const context = { businessId, businessUserId: owner.id };
      await tx.userBranchAccess.create({ data: { ...context, branchId: branch.id } });
      const mainBranch = serializeBranch(branch);
      const createdBusiness = serializeBusiness(business);
      await audit(tx, context, metadata, 'Business', 'CREATE', createdBusiness);
      await audit(tx, context, metadata, 'Branch', 'CREATE', mainBranch);

      return {
        business: createdBusiness,
        mainBranch,
        businessUserId: String(owner.id),
      } satisfies OnboardingData;
    }, writeOptions);
  }

  async listBusinesses(userId: bigint, { page, pageSize }: PageInput) {
    await requireActiveUser(this.prisma, userId);
    const where = {
      ...activeMembership(userId),
      role: {
        isActive: true,
        rolePermissions: { some: { permission: { code: 'business.read' } } },
      },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.businessUser.findMany({
        where,
        orderBy: { businessId: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { business: { select: businessSelect } },
      }),
      this.prisma.businessUser.count({ where }),
    ]);
    return { data: rows.map(({ business }) => serializeBusiness(business)), total };
  }

  async getBusiness(context: BusinessContext) {
    const row = await this.prisma.business.findFirst({
      where: { id: context.businessId, status: BUSINESS_ACTIVE },
      select: businessSelect,
    });
    if (row === null) throw businessNotFound();
    return serializeBusiness(row);
  }

  async updateBusiness(
    context: BusinessContext,
    input: UpdateBusinessInput,
    metadata: RequestMetadata,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const scope = await resolveBusinessContext(
        tx,
        context.userId,
        context.businessId,
        'business.settings.manage',
      );
      const where = { id: scope.businessId, status: BUSINESS_ACTIVE };
      const before = await tx.business.findUnique({ where, select: businessSelect });
      if (before === null) throw businessNotFound();
      const row = await tx.business.update({
        where,
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
        },
        select: businessSelect,
      });
      const data = serializeBusiness(row);
      await audit(tx, scope, metadata, 'Business', 'UPDATE', data, serializeBusiness(before));
      return data;
    }, writeOptions);
  }

  async listBranches(context: BusinessContext, { page, pageSize }: PageInput) {
    const where = accessibleBranches(context);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.branch.findMany({
        where,
        select: branchSelect,
        orderBy: [{ isMain: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.branch.count({ where }),
    ]);
    return { data: rows.map(serializeBranch), total };
  }

  async getBranch(context: BusinessContext, branchId: bigint) {
    const row = await this.prisma.branch.findFirst({
      where: { ...accessibleBranches(context), id: branchId },
      select: branchSelect,
    });
    if (row === null) throw branchNotFound();
    return serializeBranch(row);
  }

  async createBranch(
    context: BusinessContext,
    input: CreateBranchInput,
    metadata: RequestMetadata,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const scope = await resolveBusinessContext(
          tx,
          context.userId,
          context.businessId,
          'branches.manage',
        );
        const business = await tx.business.findUniqueOrThrow({
          where: { id: scope.businessId },
          select: { timezone: true },
        });
        const branch = await tx.branch.create({
          data: {
            businessId: scope.businessId,
            name: input.name,
            code: input.code.toUpperCase(),
            timezone: input.timezone ?? business.timezone,
            isMain: false,
            isActive: true,
          },
          select: branchSelect,
        });
        await tx.userBranchAccess.create({
          data: {
            businessId: scope.businessId,
            businessUserId: scope.businessUserId,
            branchId: branch.id,
          },
        });
        const data = serializeBranch(branch);
        await audit(tx, scope, metadata, 'Branch', 'CREATE', data);
        return data;
      }, writeOptions);
    } catch (error) {
      branchConflict(error);
    }
  }

  async updateBranch(
    context: BusinessContext,
    branchId: bigint,
    input: UpdateBranchInput,
    metadata: RequestMetadata,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const scope = await resolveBusinessContext(
          tx,
          context.userId,
          context.businessId,
          'branches.manage',
        );
        const before = await tx.branch.findFirst({
          where: { ...accessibleBranches(scope), id: branchId },
          select: branchSelect,
        });
        if (before === null) throw branchNotFound();
        const branch = await tx.branch.update({
          where: { businessId_id: { businessId: scope.businessId, id: branchId } },
          data: {
            ...(input.code === undefined ? {} : { code: input.code.toUpperCase() }),
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
          },
          select: branchSelect,
        });
        const data = serializeBranch(branch);
        await audit(tx, scope, metadata, 'Branch', 'UPDATE', data, serializeBranch(before));
        return data;
      }, writeOptions);
    } catch (error) {
      branchConflict(error);
    }
  }
}
