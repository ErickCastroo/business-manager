import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { AccountLayout, FormAlert } from '@/features/auth/components/account-layout';
import { useSession } from '@/features/auth/session-context';
import { invitationContinuation, invitationDestination } from '@/features/members/invitation-link';
import { apiErrorMessage } from '@/lib/api';

export function SessionGate({
  access,
  children,
}: {
  access: 'guest' | 'account' | 'business';
  children?: ReactElement;
}) {
  const { error, profile, retry } = useSession();
  const { pathname, search, hash } = useLocation();
  if (error) {
    return (
      <AccountLayout
        title="Sesión no disponible"
        description="Vuelve a consultar el estado de tu sesión."
      >
        <div className="mt-5 space-y-4">
          <FormAlert message={apiErrorMessage(error)} />
          <Button onClick={retry}>Reintentar</Button>
        </div>
      </AccountLayout>
    );
  }
  if (profile === undefined) {
    return (
      <div
        className="grid min-h-svh place-items-center text-sm text-muted-foreground"
        role="status"
      >
        Comprobando sesión…
      </div>
    );
  }
  if (access === 'guest' && profile) {
    if (search === invitationContinuation) {
      return <Navigate replace to={invitationDestination('/invitacion', hash)} />;
    }
    return <Navigate replace to={profile.memberships.length ? '/dashboard' : '/onboarding'} />;
  }
  if (access !== 'guest' && profile === null) {
    return (
      <Navigate
        replace
        to={pathname === '/invitacion' ? invitationDestination('/login', hash) : '/login'}
      />
    );
  }
  if (access === 'business' && profile?.memberships.length === 0) {
    return <Navigate replace to="/onboarding" />;
  }
  return children ?? <Outlet />;
}
