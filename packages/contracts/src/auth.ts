import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .min(1, 'El correo es obligatorio.')
  .max(200, 'El correo no puede exceder 200 caracteres.')
  .email('Ingresa un correo electrónico válido.');

const passwordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres.')
  .max(128, 'La contraseña no puede exceder 128 caracteres.')
  .regex(/[a-z]/, 'La contraseña debe incluir una letra minúscula.')
  .regex(/[A-Z]/, 'La contraseña debe incluir una letra mayúscula.')
  .regex(/[0-9]/, 'La contraseña debe incluir un número.');

const optionalTrimmedString = (maximumLength: number, message: string) =>
  z.string().trim().min(1, message).max(maximumLength).optional();

export const registerRequestSchema = z
  .object({
    email: emailSchema,
    firstName: z
      .string()
      .trim()
      .min(1, 'El nombre es obligatorio.')
      .max(100, 'El nombre no puede exceder 100 caracteres.'),
    lastName: optionalTrimmedString(100, 'El apellido no puede estar vacío.'),
    password: passwordSchema,
    phone: optionalTrimmedString(30, 'El teléfono no puede estar vacío.'),
  })
  .strict();

export const loginRequestSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'La contraseña es obligatoria.').max(128),
  })
  .strict();

export const authUserSchema = z
  .object({
    createdAt: z.string().datetime(),
    email: z.string().email(),
    firstName: z.string(),
    id: z.string().regex(/^[1-9][0-9]*$/),
    lastName: z.string().nullable(),
    phone: z.string().nullable(),
  })
  .strict();

export const authTokenSchema = z
  .object({
    accessToken: z.string(),
    expiresIn: z.number().int().positive(),
    tokenType: z.literal('Bearer'),
  })
  .strict();

export const authSessionDataSchema = z
  .object({
    token: authTokenSchema,
    user: authUserSchema,
  })
  .strict();

export const businessMembershipSchema = z
  .object({
    branchIds: z.array(z.string().regex(/^[1-9][0-9]*$/)),
    business: z
      .object({
        baseCurrencyCode: z.string().length(3),
        id: z.string().regex(/^[1-9][0-9]*$/),
        name: z.string(),
        timezone: z.string(),
      })
      .strict(),
    businessUserId: z.string().regex(/^[1-9][0-9]*$/),
    isOwner: z.boolean(),
    role: z
      .object({
        code: z.string(),
        id: z.string().regex(/^[1-9][0-9]*$/),
        name: z.string(),
      })
      .strict(),
  })
  .strict();

export const meDataSchema = z
  .object({
    memberships: z.array(businessMembershipSchema),
    user: authUserSchema,
  })
  .strict();

export const refreshDataSchema = z
  .object({
    token: authTokenSchema,
  })
  .strict();

export const logoutDataSchema = z
  .object({
    loggedOut: z.literal(true),
  })
  .strict();

export type AuthSessionData = z.infer<typeof authSessionDataSchema>;
export type AuthToken = z.infer<typeof authTokenSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type BusinessMembership = z.infer<typeof businessMembershipSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LogoutData = z.infer<typeof logoutDataSchema>;
export type MeData = z.infer<typeof meDataSchema>;
export type RefreshData = z.infer<typeof refreshDataSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
