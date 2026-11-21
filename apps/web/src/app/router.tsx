import { Suspense, type ReactElement } from 'react';
import { Navigate, type RouteObject } from 'react-router';

import { allNavigationItems } from '@/app/navigation';
import {
  AcceptInvitationPage,
  DashboardPage,
  LoginPage,
  MembersPage,
  ModulePlaceholderPage,
  NotFoundPage,
  OnboardingPage,
  RegisterPage,
} from '@/app/route-components';
import { AppShell } from '@/components/layout/app-shell';
import { SessionGate } from '@/features/auth/components/session-gate';

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
  .filter((item) => item.href !== '/dashboard' && item.href !== '/administration')
  .map((item) => ({
    path: item.href.slice(1),
    element: withRouteFallback(<ModulePlaceholderPage item={item} />),
    handle: {
      breadcrumb: item.label,
    } satisfies RouteHandle,
  }));

export const appRoutes: RouteObject[] = [
  {
    path: '/login',
    element: <SessionGate access="guest">{withRouteFallback(<LoginPage />)}</SessionGate>,
  },
  {
    path: '/registro',
    element: <SessionGate access="guest">{withRouteFallback(<RegisterPage />)}</SessionGate>,
  },
  {
    path: '/onboarding',
    element: <SessionGate access="account">{withRouteFallback(<OnboardingPage />)}</SessionGate>,
  },
  {
    path: '/invitacion',
    element: (
      <SessionGate access="account">{withRouteFallback(<AcceptInvitationPage />)}</SessionGate>
    ),
  },
  {
    path: '/',
    element: (
      <SessionGate access="business">
        <AppShell />
      </SessionGate>
    ),
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
      {
        path: 'administration',
        element: withRouteFallback(<MembersPage />),
        handle: { breadcrumb: 'Administración' } satisfies RouteHandle,
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
