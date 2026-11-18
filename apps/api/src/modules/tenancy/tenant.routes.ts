import {
  createBranchSchema,
  createBusinessSchema,
  updateBranchSchema,
  updateBusinessSchema,
} from '@business-manager/contracts';
import { Router, type RequestHandler } from 'express';

import { getPrismaClient } from '../../lib/prisma.js';
import { validateBody } from '../../middleware/validate-body.js';
import { getAuthenticatedUserId } from '../auth/auth-context.js';
import type { AuthSecurity } from '../auth/auth-security.js';
import { createRequireAuth } from '../auth/auth.middleware.js';
import { disableAuthCaching } from '../auth/auth.routes.js';
import { resolveBusinessContext, setBusinessContext } from './business-context.js';
import type { PermissionCode } from './tenant-catalog.js';
import {
  createTenantController,
  rejectUnexpectedQuery,
  selectedBusinessId,
} from './tenant.controller.js';
import { TenantService } from './tenant.service.js';

function requireBusiness(source: 'path' | 'header', permission: PermissionCode): RequestHandler {
  return async (request, _response, next) => {
    const businessId = selectedBusinessId(request, source);
    const context = await resolveBusinessContext(
      getPrismaClient(),
      getAuthenticatedUserId(request),
      businessId,
      permission,
    );
    setBusinessContext(request, context);
    next();
  };
}

export function createTenantRouters(security: AuthSecurity) {
  const businesses = Router();
  const branches = Router();
  const requireAuth = createRequireAuth(security);
  let service: TenantService | undefined;
  const controller = createTenantController(
    () => (service ??= new TenantService(getPrismaClient())),
  );

  businesses.use(disableAuthCaching, requireAuth);
  businesses.get('/', controller.listBusinesses);
  businesses.post(
    '/',
    rejectUnexpectedQuery,
    validateBody(createBusinessSchema),
    controller.createBusiness,
  );
  businesses.get(
    '/:id',
    rejectUnexpectedQuery,
    requireBusiness('path', 'business.read'),
    controller.getBusiness,
  );
  businesses.patch(
    '/:id',
    rejectUnexpectedQuery,
    requireBusiness('path', 'business.settings.manage'),
    validateBody(updateBusinessSchema),
    controller.updateBusiness,
  );

  branches.use(disableAuthCaching, requireAuth);
  branches.get('/', requireBusiness('header', 'branches.read'), controller.listBranches);
  branches.get(
    '/:id',
    rejectUnexpectedQuery,
    requireBusiness('header', 'branches.read'),
    controller.getBranch,
  );
  branches.post(
    '/',
    rejectUnexpectedQuery,
    requireBusiness('header', 'branches.manage'),
    validateBody(createBranchSchema),
    controller.createBranch,
  );
  branches.patch(
    '/:id',
    rejectUnexpectedQuery,
    requireBusiness('header', 'branches.manage'),
    validateBody(updateBranchSchema),
    controller.updateBranch,
  );

  return { businesses, branches };
}
