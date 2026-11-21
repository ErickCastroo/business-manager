import {
  acceptInvitationSchema,
  inviteMemberSchema,
  updateMemberSchema,
} from '@business-manager/contracts';
import { Router } from 'express';

import type { AuthConfig } from '../../config/auth.js';
import { getPrismaClient } from '../../lib/prisma.js';
import { validateBody } from '../../middleware/validate-body.js';
import { createRequireAuth } from '../auth/auth.middleware.js';
import { createAuthRateLimiter } from '../auth/auth-rate-limit.js';
import { disableAuthCaching } from '../auth/auth.routes.js';
import type { AuthSecurity } from '../auth/auth-security.js';
import { rejectUnexpectedQuery } from '../tenancy/tenant.controller.js';
import { requireBusiness } from '../tenancy/tenant.routes.js';
import type { InvitationMailer } from './invitation-mailer.js';
import { createMembersController } from './members.controller.js';
import { MembersService } from './members.service.js';

export function createMembersRouters(
  security: AuthSecurity,
  config: AuthConfig,
  mailer: InvitationMailer | null,
) {
  const users = Router();
  const roles = Router();
  const requireAuth = createRequireAuth(security);
  let service: MembersService | undefined;
  const controller = createMembersController(
    () => (service ??= new MembersService(getPrismaClient())),
    mailer,
  );
  const read = requireBusiness('header', 'users.read');
  const manage = requireBusiness('header', 'users.manage');

  users.use(disableAuthCaching, requireAuth);
  users.get('/', read, controller.list);
  users.post(
    '/invitations',
    rejectUnexpectedQuery,
    manage,
    validateBody(inviteMemberSchema),
    controller.invite,
  );
  users.post(
    '/invitations/email',
    rejectUnexpectedQuery,
    manage,
    createAuthRateLimiter(config, 20, 'email-membership-invitation'),
    validateBody(inviteMemberSchema),
    controller.inviteByEmail,
  );
  users.post(
    '/invitations/accept',
    rejectUnexpectedQuery,
    createAuthRateLimiter(config, 20, 'accept-membership-invitation'),
    validateBody(acceptInvitationSchema),
    controller.accept,
  );
  users.patch(
    '/:id',
    rejectUnexpectedQuery,
    manage,
    validateBody(updateMemberSchema),
    controller.update,
  );

  roles.use(disableAuthCaching, requireAuth);
  roles.get('/', rejectUnexpectedQuery, read, controller.listRoles);
  return { users, roles };
}
