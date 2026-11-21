import { createHash, randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { getAuthConfig } from '../src/config/auth.js';
import { disconnectPrismaClient, getPrismaClient } from '../src/lib/prisma.js';
import { createInvitationMailer } from '../src/modules/members/invitation-mailer.js';
import { startLocalSmtp } from './helpers/local-smtp.js';

const runId = randomUUID();
const emails = {
  owner: `task008-${runId}-owner@example.invalid`,
  invited: `task008-${runId}-member@example.invalid`,
  other: `task008-${runId}-other@example.invalid`,
};

const auth = {
  config: getAuthConfig({
    JWT_ACCESS_SECRET: 'members-integration-secret-at-least-32-characters',
    NODE_ENV: 'test',
  }),
};
const app = createApp({
  auth,
  invitationMailer: null,
  exposeApiDocs: true,
});

it('requires authentication and documents membership operations', async () => {
  expect((await request(app).get('/api/v1/users')).status).toBe(401);
  expect((await request(app).get('/api/v1/roles')).status).toBe(401);
  const spec = await request(app).get('/openapi.json');
  expect(spec.body.paths['/api/v1/users/invitations/accept'].post.responses).toHaveProperty('201');
  expect(spec.body.paths['/api/v1/users/invitations/email'].post.responses).toHaveProperty('503');
  expect(spec.body.paths['/api/v1/users/{id}'].patch.parameters).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'X-Business-Id', required: true })]),
  );
});

describe.runIf(process.env.RUN_DATABASE_INTEGRATION === 'true')('membresías en SQL Server', () => {
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
        const scope = { businessId: { in: businessIds } };
        await tx.auditLog.deleteMany({ where: scope });
        await tx.membershipInvitation.deleteMany({ where: scope });
        await tx.userBranchAccess.deleteMany({ where: scope });
        await tx.businessUser.deleteMany({ where: scope });
        await tx.rolePermission.deleteMany({ where: { role: scope } });
        await tx.role.deleteMany({ where: scope });
        await tx.branch.deleteMany({ where: scope });
        await tx.business.deleteMany({ where: { id: { in: businessIds } } });
        await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      });
    } finally {
      await disconnectPrismaClient();
    }
  });

  async function createAccount(email: string) {
    const response = await request(app).post('/api/v1/auth/register').send({
      email,
      firstName: 'Tarea 008',
      password: 'DatabasePassword7',
    });
    expect(response.status).toBe(201);
    return { Authorization: `Bearer ${response.body.data.token.accessToken}` };
  }

  async function createBusiness(auth: { Authorization: string }) {
    const response = await request(app)
      .post('/api/v1/businesses')
      .set(auth)
      .send({
        name: `Tarea 008 ${runId}`,
        baseCurrencyCode: 'MXN',
        timezone: 'America/Mazatlan',
        mainBranch: { name: 'Centro', code: 'CENTRO' },
      });
    expect(response.status).toBe(201);
    return {
      id: String(response.body.data.business.id),
      branchId: String(response.body.data.mainBranch.id),
      ownerId: String(response.body.data.businessUserId),
    };
  }

  it('issues and consumes an invitation, then enforces tenant, role and branch boundaries', async () => {
    const owner = await createAccount(emails.owner);
    const other = await createAccount(emails.other);
    const business = await createBusiness(owner);
    const foreign = await createBusiness(other);
    const scope = { ...owner, 'X-Business-Id': business.id };
    const otherScope = { ...other, 'X-Business-Id': foreign.id };
    const prisma = getPrismaClient();
    const secondBranch = await request(app)
      .post('/api/v1/branches')
      .set(scope)
      .send({ name: 'Norte', code: 'NORTE' });
    expect(secondBranch.status).toBe(201);
    const northId = String(secondBranch.body.data.id);
    const roles = await request(app).get('/api/v1/roles').set(scope);
    expect(roles.status).toBe(200);
    expect(roles.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'OWNER',
          permissionCodes: expect.arrayContaining(['users.manage']),
        }),
      ]),
    );
    const cashier = await prisma.role.findUniqueOrThrow({
      where: { businessId_code: { businessId: BigInt(business.id), code: 'CASHIER' } },
    });
    const admin = await prisma.role.findUniqueOrThrow({
      where: { businessId_code: { businessId: BigInt(business.id), code: 'ADMIN' } },
    });
    const foreignRole = await prisma.role.findUniqueOrThrow({
      where: { businessId_code: { businessId: BigInt(foreign.id), code: 'CASHIER' } },
    });
    const ownerRole = await prisma.role.findUniqueOrThrow({
      where: { businessId_code: { businessId: BigInt(business.id), code: 'OWNER' } },
    });

    const invite = (roleId = String(cashier.id), branchId = business.branchId) =>
      request(app)
        .post('/api/v1/users/invitations')
        .set(scope)
        .send({ email: emails.invited.toUpperCase(), roleId, branchIds: [branchId] });
    expect((await invite(String(foreignRole.id))).body.error.code).toBe('ROLE_NOT_ASSIGNABLE');
    expect((await invite(String(ownerRole.id))).body.error.code).toBe('ROLE_NOT_ASSIGNABLE');
    expect((await invite(String(cashier.id), foreign.branchId)).body.error.code).toBe(
      'BRANCH_ASSIGNMENT_INVALID',
    );

    const invitationPayload = {
      email: emails.invited,
      roleId: String(cashier.id),
      branchIds: [business.branchId],
    };
    const sendInvitation = (target = app) =>
      request(target).post('/api/v1/users/invitations/email').set(scope).send(invitationPayload);
    const captureInvitationCode = async (linkPattern: RegExp) => {
      const smtp = await startLocalSmtp();
      try {
        const mailer = createInvitationMailer({
          NODE_ENV: 'test',
          SMTP_HOST: '127.0.0.1',
          SMTP_PORT: String(smtp.port),
          SMTP_FROM: 'invitaciones@example.invalid',
          INVITATION_WEB_URL: 'http://localhost:5173',
        });
        expect(mailer).not.toBeNull();
        const issued = await sendInvitation(createApp({ auth, invitationMailer: mailer }));
        expect(issued.status).toBe(201);
        expect(issued.body.data).toEqual({ sent: true, expiresAt: expect.any(String) });
        expect(Date.parse(issued.body.data.expiresAt)).toBeGreaterThan(Date.now());
        expect(smtp.recipients).toEqual([`RCPT TO:<${emails.invited}>`]);
        expect(smtp.messages).toHaveLength(1);
        const message = smtp.messages[0]?.replace(/=\r\n/g, '').replaceAll('=3D', '=') ?? '';
        const code = linkPattern.exec(message)?.[1];
        if (!code) throw new Error('SMTP did not receive the expected invitation link.');
        return code;
      } finally {
        await smtp.close();
      }
    };
    const unconfigured = await sendInvitation();
    expect(unconfigured.status).toBe(503);
    expect(unconfigured.body.error.code).toBe('INVITATION_EMAIL_UNAVAILABLE');
    expect(
      await prisma.membershipInvitation.count({ where: { businessId: BigInt(business.id) } }),
    ).toBe(0);

    const registrationCode = await captureInvitationCode(
      /http:\/\/localhost:5173\/registro\?continuar=invitacion#codigo=([A-Za-z0-9_-]{43})/,
    );
    const invited = await createAccount(emails.invited);
    const accept = (invitationCode: string, auth = invited) =>
      request(app).post('/api/v1/users/invitations/accept').set(auth).send({ invitationCode });
    expect((await accept(registrationCode, other)).body.error.code).toBe('INVITATION_UNAVAILABLE');

    const inviteKey = {
      businessId_email: { businessId: BigInt(business.id), email: emails.invited },
    };
    const renewed = await invite();
    expect(renewed.status).toBe(201);
    expect((await accept(registrationCode)).status).toBe(404);
    await prisma.membershipInvitation.update({
      where: inviteKey,
      data: { expiresAt: new Date(0) },
    });
    expect((await accept(renewed.body.data.invitationCode)).status).toBe(404);

    const failingMailApp = createApp({
      auth,
      invitationMailer: {
        async send() {
          throw new Error('Private SMTP diagnostic');
        },
      },
    });
    const failedSend = await sendInvitation(failingMailApp);
    expect(failedSend.status).toBe(502);
    expect(failedSend.body.error.code).toBe('INVITATION_EMAIL_FAILED');
    expect(JSON.stringify(failedSend.body)).not.toContain('Private SMTP diagnostic');

    const invitationCode = await captureInvitationCode(
      /http:\/\/localhost:5173\/invitacion#codigo=([A-Za-z0-9_-]{43})/,
    );
    const stored = await prisma.membershipInvitation.findUniqueOrThrow({ where: inviteKey });
    expect(stored.tokenHash).toBe(createHash('sha256').update(invitationCode).digest('hex'));
    expect(stored.acceptedAt).toBeNull();
    const [firstAttempt, retry] = await Promise.all([
      accept(invitationCode),
      accept(invitationCode),
    ]);
    expect([firstAttempt.status, retry.status].sort()).toEqual([201, 404]);
    const accepted = firstAttempt.status === 201 ? firstAttempt : retry;
    expect(accepted.body.data).toMatchObject({
      businessId: business.id,
      email: emails.invited,
      role: { code: 'CASHIER' },
      branchIds: [business.branchId],
      isOwner: false,
    });
    expect((await accept(invitationCode)).status).toBe(404);
    expect((await invite()).status).toBe(409);

    const memberUrl = `/api/v1/users/${accepted.body.data.id}`;
    const invitedScope = { ...invited, 'X-Business-Id': business.id };
    expect((await request(app).get('/api/v1/users').set(invitedScope)).status).toBe(403);
    expect(
      (
        await request(app)
          .get('/api/v1/users')
          .set({ ...other, 'X-Business-Id': business.id })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).patch(memberUrl).set(otherScope).send({ isActive: false })).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/v1/users/${business.ownerId}`)
          .set(scope)
          .send({ isActive: false })
      ).body.error.code,
    ).toBe('OWNER_MEMBERSHIP_PROTECTED');
    expect(
      (
        await request(app)
          .patch(memberUrl)
          .set(scope)
          .send({ branchIds: [foreign.branchId] })
      ).status,
    ).toBe(400);

    const updated = await request(app)
      .patch(memberUrl)
      .set(scope)
      .send({ roleId: String(admin.id), branchIds: [northId] });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ role: { code: 'ADMIN' }, branchIds: [northId] });
    const branches = await request(app).get('/api/v1/branches').set(invitedScope);
    expect(branches.body.data.map(({ id }: { id: string }) => id)).toEqual([northId]);
    const listing = await request(app).get('/api/v1/users?pageSize=1').set(invitedScope);
    expect(listing.body.data[0]).toMatchObject({ id: business.ownerId, branchIds: [northId] });
    expect(listing.body.meta).toMatchObject({ pageSize: 1, total: 2 });
    expect(
      (
        await request(app)
          .patch(memberUrl)
          .set(invitedScope)
          .send({ branchIds: [business.branchId] })
      ).body.error.code,
    ).toBe('OWNER_REQUIRED');

    expect((await request(app).patch(memberUrl).set(scope).send({ isActive: false })).status).toBe(
      200,
    );
    expect((await request(app).get('/api/v1/branches').set(invitedScope)).status).toBe(404);
    const log = await prisma.auditLog.findMany({
      where: {
        businessId: BigInt(business.id),
        entityType: { in: ['BusinessUser', 'MembershipInvitation'] },
      },
    });
    expect(log).toHaveLength(7);
    expect(log.some(({ afterJson }) => afterJson?.includes(invitationCode))).toBe(false);
  }, 20_000);
});
