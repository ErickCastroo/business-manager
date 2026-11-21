import type { LoginRequest, MeData, RegisterRequest } from '@business-manager/contracts';
import { createContext, useContext } from 'react';

import type { SessionClient } from '@/features/auth/api/session';

export const profileKey = ['auth', 'profile'] as const;

type SessionContextValue = {
  client: SessionClient;
  profile: MeData | null | undefined;
  error: Error | null;
  retry: () => void;
  signIn: (input: LoginRequest) => Promise<void>;
  registerAccount: (input: RegisterRequest) => Promise<void>;
  signOut: () => Promise<void>;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (context === null) throw new Error('SessionProvider is required.');
  return context;
}
