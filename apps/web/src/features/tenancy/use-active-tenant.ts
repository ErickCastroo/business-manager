import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'react-router';

import { useSession } from '@/features/auth/session-context';
import { listBranches } from '@/features/tenancy/api/tenancy';

export function useActiveTenant() {
  const { client, profile } = useSession();
  const location = useLocation();
  const [businessId, selectBusiness] = useState<string | undefined>(() => {
    const requested: unknown = location.state?.businessId;
    return typeof requested === 'string' ? requested : undefined;
  });
  const [branchChoice, setBranchChoice] = useState<{ businessId: string; branchId: string }>();
  const memberships = profile?.memberships ?? [];
  const membership =
    memberships.find(({ business }) => business.id === businessId) ?? memberships[0];
  const activeId = membership?.business.id;
  const query = useQuery({
    queryKey: ['tenant', profile?.user.id, activeId, 'branches'],
    enabled: activeId !== undefined,
    retry: false,
    queryFn: ({ signal }) => (activeId === undefined ? [] : listBranches(client, activeId, signal)),
  });
  const branches = query.isError ? [] : (query.data ?? []);
  const preferred = branchChoice?.businessId === activeId ? branchChoice?.branchId : undefined;
  const branch =
    branches.find(({ id }) => id === preferred) ??
    branches.find(({ isMain }) => isMain) ??
    branches[0];

  return {
    membership,
    memberships,
    branches,
    branch,
    branchError: query.error,
    branchesLoading: query.isPending,
    retryBranches: () => {
      void query.refetch();
    },
    changeBusiness: (id: string) => {
      if (!memberships.some(({ business }) => business.id === id) || id === activeId) return;
      selectBusiness(id);
      setBranchChoice(undefined);
    },
    changeBranch: (branchId: string) => {
      if (activeId !== undefined && branches.some(({ id }) => id === branchId)) {
        setBranchChoice({ businessId: activeId, branchId });
      }
    },
  };
}

export type ActiveTenant = ReturnType<typeof useActiveTenant>;
