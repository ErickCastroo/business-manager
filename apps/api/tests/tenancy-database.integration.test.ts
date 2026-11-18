import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { getAuthConfig } from '../src/config/auth.js';
import { disconnectPrismaClient, getPrismaClient } from '../src/lib/prisma.js';

const runId = randomUUID();
const emails = {
  first: `task006-${runId}-first@example.invalid`,
  second: `task006-${runId}-second@example.invalid`,
};
const app = createApp({
  auth: {
    config: getAuthConfig({
      JWT_ACCESS_SECRET: 'test-secret-with-at-least-thirty-two-characters',
      NODE_ENV: 'test',
    }),
  },
  exposeApiDocs: true,
});

const businessInput = {
  name: `Tarea 006 ${runId}`,
  baseCurrencyCode: 'MXN',
  timezone: 'America/Mazatlan',
  mainBranch: { name: 'Sucursal Centro', code: 'centro' },
};

it('documents tenant selection and denies unauthenticated requests', async () => {
  const anonymous = await request(app).get('/api/v1/businesses');
  expect(anonymous.status).toBe(401);
  expect(anonymous.body.error.code).toBe('AUTH_TOKEN_MISSING');
  const spec = await request(app).get('/openapi.json');
  expect(spec.body.paths['/api/v1/businesses'].post.responses).toHaveProperty('201');
  expect(spec.body.paths['/api/v1/branches/{id}'].get.parameters).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'X-Business-Id', required: true })]),
  );
});

describe.runIf(process.env.RUN_DATABASE_INTEGRATION === 'true')(
  'multiempresa en SQL Server',
  () => {
    async function register(email: string) {
      const response = await request(app).post('/api/v1/auth/register').send({
        email,
        firstName: 'Tarea 006',
        password: 'DatabasePassword7',
      });
      expect(response.status).toBe(201);
      return {
        id: BigInt(response.body.data.user.id),
        auth: `Bearer ${response.body.data.token.accessToken}`,
      };
    }

    afterAll(async () => {
      const prisma = getPrismaClient();
      try {
        await prisma.$transaction(async (tx) => {
          const users = await tx.user.findMany({
            where: { email: { in: Object.values(emails) } },
            select: { id: true },
          });
          const userIds = users.map(({ id }) => id);
          const businesses = await tx.business.findMany({
            where: { businessUsers: { some: { userId: { in: userIds }, isOwner: true } } },
            select: { id: true },
          });
          const businessIds = businesses.map(({ id }) => id);
          const businessScope = { businessId: { in: businessIds } };
          await tx.auditLog.deleteMany({ where: businessScope });
          await tx.userBranchAccess.deleteMany({ where: businessScope });
          await tx.businessUser.deleteMany({ where: businessScope });
          await tx.rolePermission.deleteMany({ where: { role: businessScope } });
          await tx.role.deleteMany({ where: businessScope });
          await tx.branch.deleteMany({ where: businessScope });
          await tx.business.deleteMany({ where: { id: { in: businessIds } } });
          await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
          await tx.user.deleteMany({ where: { id: { in: userIds } } });
        });
      } finally {
        await disconnectPrismaClient();
      }
    });

    it('provisions a business and enforces membership, role and branch access', async () => {
      const first = await register(emails.first);
      const second = await register(emails.second);
      const requestId = 'a'.repeat(100);
      const firstOnboarding = await request(app)
        .post('/api/v1/businesses')
        .set('Authorization', first.auth)
        .set('X-Request-Id', requestId)
        .send(businessInput);
      const secondOnboarding = await request(app)
        .post('/api/v1/businesses')
        .set('Authorization', second.auth)
        .send({ ...businessInput, baseCurrencyCode: 'USD' });
      expect(firstOnboarding.status).toBe(201);
      expect(secondOnboarding.status).toBe(201);
      const { business, mainBranch, businessUserId } = firstOnboarding.body.data;
      const other = secondOnboarding.body.data;
      const prisma = getPrismaClient();
      const stored = await prisma.business.findUniqueOrThrow({
        where: { id: BigInt(business.id) },
        include: {
          roles: { include: { rolePermissions: true } },
          auditLogs: true,
          businessUsers: true,
        },
      });
      expect(stored.roles.map(({ code }) => code)).toEqual(
        expect.arrayContaining(['OWNER', 'ADMIN', 'CASHIER', 'INVENTORY', 'FINANCE']),
      );
      expect(stored.roles.find(({ code }) => code === 'OWNER')?.rolePermissions).toHaveLength(36);
      expect(stored.businessUsers).toMatchObject([
        { id: BigInt(businessUserId), userId: first.id, isOwner: true },
      ]);
      expect(stored.auditLogs).toHaveLength(2);
      expect(firstOnboarding.body.meta.requestId).toBe(requestId);
      expect(stored.auditLogs.map((log) => log.requestId)).toEqual(
        Array(2).fill(requestId.slice(0, 80)),
      );
      expect(mainBranch).toMatchObject({
        businessId: business.id,
        code: 'CENTRO',
        isMain: true,
        timezone: businessInput.timezone,
      });

      const businesses = await request(app)
        .get('/api/v1/businesses?pageSize=1')
        .set('Authorization', first.auth);
      expect(businesses.body.data).toEqual([business]);
      expect(businesses.body.meta).toMatchObject({ page: 1, pageSize: 1, total: 1, totalPages: 1 });
      const foreignBusiness = await request(app)
        .get(`/api/v1/businesses/${other.business.id}`)
        .set('Authorization', first.auth);
      expect(foreignBusiness.status).toBe(404);
      const foreignSelection = await request(app)
        .get('/api/v1/branches')
        .set('Authorization', first.auth)
        .set('X-Business-Id', other.business.id);
      expect(foreignSelection.status).toBe(404);

      const owner = { Authorization: first.auth, 'X-Business-Id': String(business.id) };
      const invalid = await request(app)
        .post('/api/v1/branches')
        .set(owner)
        .send({ code: 'norte', name: 'Norte', businessId: other.business.id });
      expect(invalid.status).toBe(400);
      expect((await request(app).get('/api/v1/branches?pageSize=101').set(owner)).status).toBe(400);
      const created = await request(app)
        .post('/api/v1/branches')
        .set(owner)
        .send({ code: 'norte', name: 'Norte' });
      expect(created.status).toBe(201);
      const north = created.body.data;
      const duplicate = await request(app)
        .post('/api/v1/branches')
        .set(owner)
        .send({ code: 'NORTE', name: 'Duplicada' });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('BRANCH_CODE_ALREADY_EXISTS');
      const updated = await request(app)
        .patch(`/api/v1/branches/${north.id}`)
        .set(owner)
        .send({ name: 'Sucursal Norte' });
      expect(updated.status).toBe(200);
      expect(updated.body.data.name).toBe('Sucursal Norte');
      const updatedBusiness = await request(app)
        .patch(`/api/v1/businesses/${business.id}`)
        .set(owner)
        .send({ name: 'Nuevo nombre' });
      expect(updatedBusiness.status).toBe(200);
      expect(updatedBusiness.body.data.name).toBe('Nuevo nombre');
      const foreignBranch = await request(app)
        .get(`/api/v1/branches/${other.mainBranch.id}`)
        .set(owner);
      expect(foreignBranch.status).toBe(404);
      const foreignUpdate = await request(app)
        .patch(`/api/v1/branches/${other.mainBranch.id}`)
        .set(owner)
        .send({ name: 'Otro' });
      expect(foreignUpdate.status).toBe(404);

      const cashierRole = stored.roles.find(({ code }) => code === 'CASHIER');
      if (cashierRole === undefined) throw new Error('Missing cashier role.');
      const cashier = await prisma.businessUser.create({
        data: {
          businessId: stored.id,
          userId: second.id,
          roleId: cashierRole.id,
          isOwner: false,
          isActive: true,
        },
      });
      await prisma.userBranchAccess.create({
        data: {
          businessId: stored.id,
          businessUserId: cashier.id,
          branchId: BigInt(mainBranch.id),
        },
      });
      const limited = { Authorization: second.auth, 'X-Business-Id': String(business.id) };
      const visible = await request(app).get('/api/v1/branches').set(limited);
      expect(visible.body.data).toEqual([mainBranch]);
      expect((await request(app).get(`/api/v1/branches/${north.id}`).set(limited)).status).toBe(
        404,
      );
      expect(
        (
          await request(app)
            .patch(`/api/v1/branches/${mainBranch.id}`)
            .set(limited)
            .send({ name: 'Otro' })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .patch(`/api/v1/businesses/${business.id}`)
            .set(limited)
            .send({ name: 'Otro' })
        ).status,
      ).toBe(403);

      const me = await request(app).get('/api/v1/auth/me').set('Authorization', first.auth);
      expect(me.body.data.memberships).toMatchObject([
        { branchIds: [mainBranch.id, north.id], isOwner: true },
      ]);
      const ownBranch = await request(app).get(`/api/v1/branches/${north.id}`).set(owner);
      expect(ownBranch.body.data.name).toBe('Sucursal Norte');
      expect(await prisma.auditLog.count({ where: { businessId: stored.id } })).toBe(5);
    }, 15_000);
  },
);
