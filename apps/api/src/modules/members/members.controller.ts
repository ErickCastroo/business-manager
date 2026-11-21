import type {
  AcceptInvitationInput,
  InviteMemberInput,
  UpdateMemberInput,
} from '@business-manager/contracts';
import type { RequestHandler } from 'express';

import { createSuccessResponse } from '../../shared/http/api-response.js';
import { getAuthenticatedUserId } from '../auth/auth-context.js';
import { getBusinessContext } from '../tenancy/business-context.js';
import { metadata, paginated, parsePage, resourceId } from '../tenancy/tenant.controller.js';
import type { InvitationMailer } from './invitation-mailer.js';
import type { MembersService } from './members.service.js';

export function createMembersController(
  service: () => MembersService,
  mailer: InvitationMailer | null,
) {
  const list: RequestHandler = async (request, response) => {
    const page = parsePage(request);
    const result = await service().list(getBusinessContext(request), page);
    response.json(paginated(response, result, page));
  };
  const listRoles: RequestHandler = async (request, response) => {
    const data = await service().listRoles(getBusinessContext(request));
    response.json(createSuccessResponse(response, data));
  };
  const invite: RequestHandler = async (request, response) => {
    const data = await service().invite(
      getBusinessContext(request),
      request.body as InviteMemberInput,
      metadata(request, response),
    );
    response.status(201).json(createSuccessResponse(response, data));
  };
  const accept: RequestHandler = async (request, response) => {
    const { invitationCode } = request.body as AcceptInvitationInput;
    const data = await service().accept(
      getAuthenticatedUserId(request),
      invitationCode,
      metadata(request, response),
    );
    response.status(201).json(createSuccessResponse(response, data));
  };
  const inviteByEmail: RequestHandler = async (request, response) => {
    const data = await service().inviteByEmail(
      getBusinessContext(request),
      request.body as InviteMemberInput,
      metadata(request, response),
      mailer,
    );
    response.status(201).json(createSuccessResponse(response, data));
  };
  const update: RequestHandler = async (request, response) => {
    const data = await service().update(
      getBusinessContext(request),
      resourceId(request),
      request.body as UpdateMemberInput,
      metadata(request, response),
    );
    response.json(createSuccessResponse(response, data));
  };
  return { list, listRoles, invite, inviteByEmail, accept, update };
}
