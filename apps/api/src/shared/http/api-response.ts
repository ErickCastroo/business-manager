import type { Response } from 'express';

import { REQUEST_ID_HEADER } from '../../lib/request-id.js';

export type ApiSuccessResponse<T> = {
  data: T;
  meta: {
    requestId: string;
  };
};

export function getResponseRequestId(response: Response): string {
  const requestId = response.getHeader(REQUEST_ID_HEADER);

  return typeof requestId === 'string' ? requestId : 'unknown';
}

export function createSuccessResponse<T>(response: Response, data: T): ApiSuccessResponse<T> {
  return {
    data,
    meta: {
      requestId: getResponseRequestId(response),
    },
  };
}
