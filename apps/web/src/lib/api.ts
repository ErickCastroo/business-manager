import { z } from 'zod';

const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(
  /\/+$/,
  '',
);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const errorEnvelope = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export const envelope = <T extends z.ZodType>(data: T) => z.object({ data });

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      0,
      'CONNECTION_FAILED',
      'No pudimos conectar con el servidor. Intenta de nuevo.',
    );
  }

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = errorEnvelope.safeParse(payload);
    throw new ApiError(
      response.status,
      parsed.data?.error.code ?? 'REQUEST_FAILED',
      response.status >= 500
        ? 'El servidor no pudo completar la solicitud. Intenta de nuevo.'
        : (parsed.data?.error.message ?? 'No pudimos completar la solicitud.'),
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success)
    throw new ApiError(0, 'INVALID_RESPONSE', 'La respuesta del servidor no es válida.');
  return parsed.data;
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Ocurrió un error. Intenta de nuevo.';
}
