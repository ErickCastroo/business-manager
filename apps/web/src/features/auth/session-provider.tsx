import type { LoginRequest, RegisterRequest } from '@business-manager/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { SessionClient, SessionExpired } from '@/features/auth/api/session';
import { profileKey, SessionContext } from '@/features/auth/session-context';

export function SessionProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [client] = useState(
    () =>
      new SessionClient(() => {
        cache.removeQueries({ queryKey: ['tenant'] });
        cache.setQueryData(profileKey, null);
      }),
  );
  const profile = useQuery({
    queryKey: profileKey,
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        return await client.profile(signal);
      } catch (error) {
        if (error instanceof SessionExpired) return null;
        throw error;
      }
    },
  });

  async function open(
    path: '/auth/login' | '/auth/register',
    input: LoginRequest | RegisterRequest,
  ) {
    await client.open(path, input);
    await cache.cancelQueries({ queryKey: profileKey });
    cache.removeQueries({ queryKey: ['tenant'] });
    await cache.resetQueries({ queryKey: profileKey });
  }

  async function signOut() {
    await client.close();
    await cache.cancelQueries({ queryKey: profileKey });
    cache.removeQueries({ queryKey: ['tenant'] });
    cache.setQueryData(profileKey, null);
  }

  return (
    <SessionContext.Provider
      value={{
        client,
        profile: profile.data,
        error: profile.error,
        retry: () => {
          void profile.refetch();
        },
        signIn: (input) => open('/auth/login', input),
        registerAccount: (input) => open('/auth/register', input),
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
