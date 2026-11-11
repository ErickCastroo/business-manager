import { Suspense, type ReactElement } from 'react';
import { Navigate, type RouteObject } from 'react-router';

import { allNavigationItems } from '@/app/navigation';
import { DashboardPage, ModulePlaceholderPage, NotFoundPage } from '@/app/route-components';
import { AppShell } from '@/components/layout/app-shell';

export type RouteHandle = {
  breadcrumb: string;
};

function withRouteFallback(element: ReactElement) {
  return (
    <Suspense
      fallback={
        <div
          aria-live="polite"
          className="grid min-h-72 place-items-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500"
          role="status"
        >
          Cargando vista…
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

const moduleRoutes: RouteObject[] = allNavigationItems
  .filter((item) => item.href !== '/dashboard')
  .map((item) => ({
    path: item.href.slice(1),
    element: withRouteFallback(<ModulePlaceholderPage item={item} />),
    handle: {
      breadcrumb: item.label,
    } satisfies RouteHandle,
  }));

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate replace to="/dashboard" />,
      },
      {
        path: 'dashboard',
        element: withRouteFallback(<DashboardPage />),
        handle: {
          breadcrumb: 'Dashboard',
        } satisfies RouteHandle,
      },
      ...moduleRoutes,
      {
        path: '*',
        element: withRouteFallback(<NotFoundPage />),
        handle: {
          breadcrumb: 'Página no encontrada',
        } satisfies RouteHandle,
      },
    ],
  },
];
