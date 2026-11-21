import {
  branchDataSchema,
  onboardingDataSchema,
  type BranchData,
  type CreateBusinessInput,
} from '@business-manager/contracts';
import { z } from 'zod';

import type { SessionClient } from '@/features/auth/api/session';
import { envelope } from '@/lib/api';

const branchListSchema = z.object({
  data: z.array(branchDataSchema),
  meta: z.object({ totalPages: z.int().nonnegative() }),
});

export function createBusiness(client: SessionClient, input: CreateBusinessInput) {
  return client.request('/businesses', envelope(onboardingDataSchema), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listBranches(client: SessionClient, businessId: string, signal: AbortSignal) {
  const branches: BranchData[] = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const result = await client.request(`/branches?page=${page}&pageSize=100`, branchListSchema, {
      headers: { 'X-Business-Id': businessId },
      signal,
    });
    totalPages = result.meta.totalPages;
    branches.push(...result.data.filter((branch) => branch.businessId === businessId));
  }
  return branches;
}
