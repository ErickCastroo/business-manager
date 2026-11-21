import type { ReactNode } from 'react';

export function PermissionGuard({ allowed, children }: { allowed: boolean; children: ReactNode }) {
  return allowed ? children : null;
}
