import {
  authSessionDataSchema,
  logoutDataSchema,
  meDataSchema,
  refreshDataSchema,
  type LoginRequest,
  type RegisterRequest,
} from '@business-manager/contracts';
import type { z } from 'zod';

import { ApiError, apiRequest, envelope } from '@/lib/api';

export class SessionExpired extends Error {}

const profileSchema = envelope(meDataSchema);

export class SessionClient {
  #accessToken: string | undefined;
  #userId: string | undefined;
  #revision = 0;
  #refresh: Promise<string> | undefined;
  #pending = Promise.resolve();

  constructor(private readonly onExpired: () => void) {}

  // Refresh tokens rotate. Serialize requests that change the cookie, including across
  // tabs when Web Locks is available, and share a single refresh within this client.
  #withCookie<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#pending.then(() =>
      navigator.locks === undefined
        ? operation()
        : navigator.locks.request('business-manager-session', operation),
    );
    this.#pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  #clear() {
    this.#revision++;
    this.#accessToken = undefined;
    this.#userId = undefined;
    this.#refresh = undefined;
  }

  #expire(revision: number): never {
    if (revision === this.#revision) {
      const hadSession = this.#userId !== undefined;
      this.#clear();
      if (hadSession) this.onExpired();
    }
    throw new SessionExpired();
  }

  async open(path: '/auth/login' | '/auth/register', credentials: LoginRequest | RegisterRequest) {
    await this.#withCookie(async () => {
      const { data } = await apiRequest(path, envelope(authSessionDataSchema), {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      this.#clear();
      this.#accessToken = data.token.accessToken;
      this.#userId = data.user.id;
    });
  }

  async close() {
    await this.#withCookie(async () => {
      await apiRequest('/auth/logout', envelope(logoutDataSchema), { method: 'POST' });
      this.#clear();
    });
  }

  async profile(signal: AbortSignal) {
    const { data } = await this.request('/auth/me', profileSchema, { signal });
    this.#userId = data.user.id;
    return data;
  }

  #rotate(revision: number, usedToken: string | undefined) {
    if (revision !== this.#revision) throw new SessionExpired();
    if (this.#accessToken !== undefined && this.#accessToken !== usedToken)
      return this.#accessToken;

    this.#refresh ??= this.#withCookie(async () => {
      if (revision !== this.#revision) throw new SessionExpired();
      try {
        const { data } = await apiRequest('/auth/refresh', envelope(refreshDataSchema), {
          method: 'POST',
        });
        const token = data.token.accessToken;
        // Another tab may have signed into a different account while this tab was open.
        if (this.#userId !== undefined) {
          const profile = await this.#authorized('/auth/me', profileSchema, {}, token);
          if (profile.data.user.id !== this.#userId) throw new SessionExpired();
        }
        this.#accessToken = token;
        return token;
      } catch (error) {
        if (
          error instanceof SessionExpired ||
          (error instanceof ApiError && (error.status === 401 || error.code === 'ACCOUNT_DISABLED'))
        ) {
          this.#expire(revision);
        }
        throw error;
      }
    }).finally(() => {
      if (revision === this.#revision) this.#refresh = undefined;
    });
    return this.#refresh;
  }

  #authorized<T>(path: string, schema: z.ZodType<T>, options: RequestInit, token: string) {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return apiRequest(path, schema, { ...options, headers });
  }

  async request<T>(path: string, schema: z.ZodType<T>, options: RequestInit = {}): Promise<T> {
    const revision = this.#revision;
    const send = async (token: string) => {
      options.signal?.throwIfAborted();
      if (revision !== this.#revision) throw new SessionExpired();
      const result = await this.#authorized(path, schema, options, token);
      if (revision !== this.#revision) throw new SessionExpired();
      return result;
    };

    const token = this.#accessToken ?? (await this.#rotate(revision, undefined));
    try {
      return await send(token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
    try {
      return await send(await this.#rotate(revision, token));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) this.#expire(revision);
      throw error;
    }
  }
}
