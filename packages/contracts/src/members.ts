import { z } from 'zod';

import { tenantIdSchema } from './tenancy.js';

export const memberBranchIdsSchema = z
  .array(tenantIdSchema)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, 'Selecciona cada sucursal una sola vez.');

export const inviteMemberSchema = z.strictObject({
  email: z.email().max(200),
  roleId: tenantIdSchema,
  branchIds: memberBranchIdsSchema,
});

const invitationCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const acceptInvitationSchema = z.strictObject({ invitationCode: invitationCodeSchema });
export const invitationDataSchema = z.strictObject({
  invitationCode: invitationCodeSchema,
  expiresAt: z.iso.datetime(),
});

export const emailInvitationDataSchema = z.strictObject({
  sent: z.literal(true),
  expiresAt: z.iso.datetime(),
});

export const updateMemberSchema = z
  .strictObject({ roleId: tenantIdSchema, branchIds: memberBranchIdsSchema, isActive: z.boolean() })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Envía al menos un campo.');

const roleSummarySchema = z.strictObject({
  id: tenantIdSchema,
  code: z.string(),
  name: z.string(),
});

export const memberRoleSchema = roleSummarySchema.extend({
  permissionCodes: z.array(z.string()),
});

export const memberDataSchema = z.strictObject({
  id: tenantIdSchema,
  businessId: tenantIdSchema,
  email: z.email(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  role: roleSummarySchema,
  branchIds: z.array(tenantIdSchema),
  isOwner: z.boolean(),
  isActive: z.boolean(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type MemberData = z.infer<typeof memberDataSchema>;
