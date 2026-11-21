import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { envelope } from '@/lib/api';
import { SessionClient, SessionExpired } from '@/features/auth/api/session';

const user = {
  id: '1',
  firstName: 'Alicia',
  lastName: null,
  email: 'alicia@example.test',
  phone: null,
  createdAt: '2026-11-18T12:00:00.000Z',
};
const token = (accessToken: string) => ({ accessToken, tokenType: 'Bearer', expiresIn: 900 });
const response = (data: unknown) => Response.json({ data });
const expired = () =>
  Response.json(
    { error: { code: 'AUTH_TOKEN_INVALID', message: 'Sesión expirada.' } },
    { status: 401 },
  );
const resource = envelope(z.string());

afterEach(() => vi.unstubAllGlobals());

describe('session client', () => {
  it('shares a single refresh across concurrent requests and retries with the new token', async () => {
    let refreshes = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit) => {
        const { pathname } = new URL(input);
        const auth = new Headers(options.headers).get('Authorization');
        if (pathname.endsWith('/login')) return response({ token: token('initial'), user });
        if (pathname.endsWith('/refresh')) {
          refreshes++;
          return response({ token: token('fresh') });
        }
        if (auth !== 'Bearer fresh') return expired();
        if (pathname.endsWith('/me')) return response({ user, memberships: [] });
        return response('accesible');
      }),
    );
    const client = new SessionClient(vi.fn());
    await client.open('/auth/login', { email: user.email, password: 'TestPassword7' });

    await expect(
      Promise.all([
        client.request('/branch-one', resource),
        client.request('/branch-two', resource),
      ]),
    ).resolves.toEqual([{ data: 'accesible' }, { data: 'accesible' }]);
    expect(refreshes).toBe(1);
  });

  it('clears the active profile if the refresh cookie belongs to a different account', async () => {
    const onExpired = vi.fn();
    const fetchMock = vi.fn(async (input: string) => {
      const { pathname } = new URL(input);
      if (pathname.endsWith('/login')) return response({ token: token('initial'), user });
      if (pathname.endsWith('/refresh')) return response({ token: token('other') });
      if (pathname.endsWith('/me'))
        return response({ user: { ...user, id: '2' }, memberships: [] });
      return expired();
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new SessionClient(onExpired);
    await client.open('/auth/login', { email: user.email, password: 'TestPassword7' });
    await expect(client.request('/branches', resource)).rejects.toBeInstanceOf(SessionExpired);
    expect(onExpired).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/branches'))).toHaveLength(1);
  });
});
