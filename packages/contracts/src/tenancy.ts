import { z } from 'zod';

export const tenantIdSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine((id) => id.length < 19 || id <= '9223372036854775807');

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => {
    if (!/^[A-Za-z_][A-Za-z0-9_+/-]*$/.test(value)) return false;
    try {
      new Intl.DateTimeFormat('es-MX', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Usa una zona horaria IANA válida.');

const businessNameSchema = z.string().trim().min(1).max(150);
const currencySchema = z.enum(['MXN', 'USD']);
const branchFields = {
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,20}$/),
  name: z.string().trim().min(1).max(120),
  timezone: timezoneSchema,
};

export const createBusinessSchema = z.strictObject({
  name: businessNameSchema,
  baseCurrencyCode: currencySchema,
  timezone: timezoneSchema,
  mainBranch: z.strictObject(branchFields).partial({ timezone: true }),
});

export const updateBusinessSchema = z
  .strictObject({ name: businessNameSchema, timezone: timezoneSchema })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Envía al menos un campo.');

export const createBranchSchema = z.strictObject(branchFields).partial({ timezone: true });

export const updateBranchSchema = z
  .strictObject(branchFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Envía al menos un campo.');

export const businessDataSchema = z.strictObject({
  id: tenantIdSchema,
  name: businessNameSchema,
  baseCurrencyCode: z.string().length(3),
  timezone: z.string(),
});

export const branchDataSchema = z.strictObject({
  id: tenantIdSchema,
  businessId: tenantIdSchema,
  code: z.string(),
  name: z.string(),
  timezone: z.string(),
  isMain: z.boolean(),
});

export const onboardingDataSchema = z.strictObject({
  business: businessDataSchema,
  mainBranch: branchDataSchema,
  businessUserId: tenantIdSchema,
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type BusinessData = z.infer<typeof businessDataSchema>;
export type BranchData = z.infer<typeof branchDataSchema>;
export type OnboardingData = z.infer<typeof onboardingDataSchema>;
