import request, { type Response as SupertestResponse } from 'supertest';
import { describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { REQUEST_ID_HEADER } from '../src/lib/request-id.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRequestId(response: SupertestResponse): string {
  const requestId: unknown = response.headers[REQUEST_ID_HEADER];

  if (typeof requestId !== 'string') {
    throw new Error('The response did not include a valid X-Request-Id header.');
  }

  return requestId;
}

describe('GET /health', () => {
  it('returns the service status and a generated request ID', async () => {
    const response = await request(app).get('/health');
    const requestId = getRequestId(response);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(requestId).toMatch(UUID_PATTERN);
  });

  it('preserves a safe request ID supplied by the caller', async () => {
    const suppliedRequestId = 'health-check-001';
    const response = await request(app).get('/health').set(REQUEST_ID_HEADER, suppliedRequestId);

    expect(response.status).toBe(200);
    expect(getRequestId(response)).toBe(suppliedRequestId);
  });

  it('replaces an unsafe request ID supplied by the caller', async () => {
    const unsafeRequestId = 'request id with spaces';
    const response = await request(app).get('/health').set(REQUEST_ID_HEADER, unsafeRequestId);
    const requestId = getRequestId(response);

    expect(response.status).toBe(200);
    expect(requestId).not.toBe(unsafeRequestId);
    expect(requestId).toMatch(UUID_PATTERN);
  });
});

describe('API error handling', () => {
  it('returns a stable error code and the same response request ID', async () => {
    const response = await request(app).get('/route-that-does-not-exist');
    const requestId = getRequestId(response);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'La ruta solicitada no existe.',
        requestId,
      },
    });
  });
});
