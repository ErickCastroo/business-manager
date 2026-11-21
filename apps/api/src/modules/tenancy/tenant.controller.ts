import {
  tenantIdSchema,
  type CreateBranchInput,
  type CreateBusinessInput,
  type UpdateBranchInput,
  type UpdateBusinessInput,
} from '@business-manager/contracts';
import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../shared/errors/app-error.js';
import { createSuccessResponse, getResponseRequestId } from '../../shared/http/api-response.js';
import { getAuthenticatedUserId } from '../auth/auth-context.js';
import { getBusinessContext } from './business-context.js';
import type { PageInput, TenantService } from './tenant.service.js';

const pageNumber = (max: number) =>
  z
    .string()
    .regex(/^[1-9][0-9]{0,6}$/)
    .transform(Number)
    .pipe(z.number().max(max));
const pageSchema = z.strictObject({
  page: pageNumber(1_000_000).default(1),
  pageSize: pageNumber(100).default(25),
});
const emptyQuery = z.strictObject({});
const resourceParamsSchema = z.strictObject({ id: tenantIdSchema });

function parse<T>(schema: z.ZodType<T>, input: unknown, field: string): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  throw new AppError({
    code: 'INVALID_INPUT',
    message: 'Los parámetros enviados no son válidos.',
    statusCode: 400,
    details: { field },
  });
}

export const rejectUnexpectedQuery: RequestHandler = (request, _response, next) => {
  parse(emptyQuery, request.query, 'query');
  next();
};

export function selectedBusinessId(request: Request, source: 'path' | 'header'): bigint {
  if (source === 'path') return resourceId(request);
  const value = request.get('x-business-id');
  if (value === undefined) {
    throw new AppError({
      code: 'BUSINESS_SELECTION_REQUIRED',
      message: 'Selecciona un negocio para continuar.',
      statusCode: 400,
    });
  }
  return BigInt(parse(tenantIdSchema, value, 'X-Business-Id'));
}

export function resourceId(request: Request): bigint {
  return BigInt(parse(resourceParamsSchema, request.params, 'params.id').id);
}

export function metadata(request: Request, response: Response) {
  return { requestId: getResponseRequestId(response), ipAddress: request.ip ?? null };
}

export function paginated<T>(
  response: Response,
  { data, total }: { data: T[]; total: number },
  page: PageInput,
) {
  const envelope = createSuccessResponse(response, data);
  return {
    data,
    meta: { ...envelope.meta, ...page, total, totalPages: Math.ceil(total / page.pageSize) },
  };
}

export function parsePage(request: Request): PageInput {
  return parse(pageSchema, request.query, 'query');
}

export function createTenantController(getService: () => TenantService) {
  const createBusiness: RequestHandler = async (request, response) => {
    const data = await getService().createBusiness(
      getAuthenticatedUserId(request),
      request.body as CreateBusinessInput,
      metadata(request, response),
    );
    response.status(201).json(createSuccessResponse(response, data));
  };
  const listBusinesses: RequestHandler = async (request, response) => {
    const page = parsePage(request);
    const result = await getService().listBusinesses(getAuthenticatedUserId(request), page);
    response.json(paginated(response, result, page));
  };
  const getBusiness: RequestHandler = async (request, response) => {
    const data = await getService().getBusiness(getBusinessContext(request));
    response.json(createSuccessResponse(response, data));
  };
  const updateBusiness: RequestHandler = async (request, response) => {
    const data = await getService().updateBusiness(
      getBusinessContext(request),
      request.body as UpdateBusinessInput,
      metadata(request, response),
    );
    response.json(createSuccessResponse(response, data));
  };
  const listBranches: RequestHandler = async (request, response) => {
    const page = parsePage(request);
    const result = await getService().listBranches(getBusinessContext(request), page);
    response.json(paginated(response, result, page));
  };
  const getBranch: RequestHandler = async (request, response) => {
    const data = await getService().getBranch(getBusinessContext(request), resourceId(request));
    response.json(createSuccessResponse(response, data));
  };
  const createBranch: RequestHandler = async (request, response) => {
    const data = await getService().createBranch(
      getBusinessContext(request),
      request.body as CreateBranchInput,
      metadata(request, response),
    );
    response.status(201).json(createSuccessResponse(response, data));
  };
  const updateBranch: RequestHandler = async (request, response) => {
    const data = await getService().updateBranch(
      getBusinessContext(request),
      resourceId(request),
      request.body as UpdateBranchInput,
      metadata(request, response),
    );
    response.json(createSuccessResponse(response, data));
  };

  return {
    createBusiness,
    listBusinesses,
    getBusiness,
    updateBusiness,
    listBranches,
    getBranch,
    createBranch,
    updateBranch,
  };
}
