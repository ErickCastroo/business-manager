import {
  emailInvitationDataSchema,
  invitationDataSchema,
  memberDataSchema,
  memberRoleSchema,
  type AcceptInvitationInput,
  type InviteMemberInput,
  type UpdateMemberInput,
} from '@business-manager/contracts';
import { z } from 'zod';

import type { SessionClient } from '@/features/auth/api/session';
import { envelope } from '@/lib/api';

const usersPageSchema = z.object({
  data: z.array(memberDataSchema),
  meta: z.object({
    page: z.int().positive(),
    pageSize: z.int().positive(),
    total: z.int().nonnegative(),
    totalPages: z.int().nonnegative(),
  }),
});

export type MemberRole = z.infer<typeof memberRoleSchema>;

export function listMembers(
  client: SessionClient,
  businessId: string,
  page: number,
  size: number,
  signal: AbortSignal,
) {
  return client.request(`/users?page=${page}&pageSize=${size}`, usersPageSchema, {
    signal,
    headers: { 'X-Business-Id': businessId },
  });
}

export function listRoles(client: SessionClient, businessId: string, signal: AbortSignal) {
  return client.request('/roles', envelope(z.array(memberRoleSchema)), {
    signal,
    headers: { 'X-Business-Id': businessId },
  });
}

export function issueInvitation(
  client: SessionClient,
  businessId: string,
  input: InviteMemberInput,
) {
  return client.request('/users/invitations', envelope(invitationDataSchema), {
    method: 'POST',
    headers: { 'X-Business-Id': businessId },
    body: JSON.stringify(input),
  });
}

export function emailInvitation(
  client: SessionClient,
  businessId: string,
  input: InviteMemberInput,
) {
  return client.request('/users/invitations/email', envelope(emailInvitationDataSchema), {
    method: 'POST',
    headers: { 'X-Business-Id': businessId },
    body: JSON.stringify(input),
  });
}

export function updateMembership(
  client: SessionClient,
  businessId: string,
  memberId: string,
  input: UpdateMemberInput,
) {
  return client.request(`/users/${memberId}`, envelope(memberDataSchema), {
    method: 'PATCH',
    headers: { 'X-Business-Id': businessId },
    body: JSON.stringify(input),
  });
}

export function acceptInvitation(client: SessionClient, input: AcceptInvitationInput) {
  return client.request('/users/invitations/accept', envelope(memberDataSchema), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
