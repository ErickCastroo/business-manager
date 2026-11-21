import { lazy } from 'react';

export const MembersPage = lazy(async () => {
  const module = await import('@/features/members/pages/members-page');
  return { default: module.MembersPage };
});

export const AcceptInvitationPage = lazy(async () => {
  const module = await import('@/features/members/pages/accept-invitation-page');
  return { default: module.AcceptInvitationPage };
});

export const LoginPage = lazy(async () => {
  const module = await import('@/features/auth/pages/login-page');
  return { default: module.LoginPage };
});

export const RegisterPage = lazy(async () => {
  const module = await import('@/features/auth/pages/register-page');
  return { default: module.RegisterPage };
});

export const OnboardingPage = lazy(async () => {
  const module = await import('@/features/tenancy/pages/onboarding-page');
  return { default: module.OnboardingPage };
});

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
