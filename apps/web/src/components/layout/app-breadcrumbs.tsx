import { Home } from 'lucide-react';
import { Link, useMatches } from 'react-router';

import type { RouteHandle } from '@/app/router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

function hasRouteHandle(handle: unknown): handle is RouteHandle {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    'breadcrumb' in handle &&
    typeof handle.breadcrumb === 'string'
  );
}

export function AppBreadcrumbs() {
  const matches = useMatches();
  const crumbs = matches.flatMap((match) =>
    hasRouteHandle(match.handle)
      ? [{ label: match.handle.breadcrumb, pathname: match.pathname }]
      : [],
  );

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap text-xs sm:text-sm">
        <BreadcrumbItem className="hidden sm:inline-flex">
          <BreadcrumbLink asChild>
            <Link className="inline-flex items-center gap-1.5" to="/dashboard">
              <Home aria-hidden="true" className="size-3.5" />
              Inicio
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.length > 0 && <BreadcrumbSeparator className="hidden sm:list-item" />}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate font-medium">
            {crumbs.at(-1)?.label ?? 'Dashboard'}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
