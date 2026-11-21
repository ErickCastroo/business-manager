import { useState } from 'react';

import { useSession } from '@/features/auth/session-context';
import { apiErrorMessage } from '@/lib/api';

export function useSignOut() {
  const { signOut } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    setPending(true);
    setError(undefined);
    try {
      await signOut();
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return { pending, error, submit };
}
