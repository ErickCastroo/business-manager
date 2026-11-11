import { lazy } from 'react';

export const DashboardPage = lazy(async () => {
  const module = await import('@/features/dashboard/pages/dashboard-page');
  return { default: module.DashboardPage };
});

export const ModulePlaceholderPage = lazy(async () => {
  const module = await import('@/pages/module-placeholder-page');
  return { default: module.ModulePlaceholderPage };
});

export const NotFoundPage = lazy(async () => {
  const module = await import('@/pages/not-found-page');
  return { default: module.NotFoundPage };
});
