import { acceptInvitationSchema } from '@business-manager/contracts';

export const invitationContinuation = '?continuar=invitacion';

export function readInvitationCode(hash: string): string | undefined {
  const [code, ...duplicates] = new URLSearchParams(hash.slice(1)).getAll('codigo');
  if (duplicates.length > 0) return undefined;
  return acceptInvitationSchema.safeParse({ invitationCode: code }).data?.invitationCode;
}

export function invitationDestination(
  path: '/login' | '/registro' | '/invitacion',
  hash: string,
): string {
  const code = readInvitationCode(hash);
  const continuation = path === '/invitacion' ? '' : invitationContinuation;
  return `${path}${continuation}${code ? `#codigo=${code}` : ''}`;
}
