import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

export function resolveRequestId(headerValue: string | string[] | undefined): string {
  if (typeof headerValue === 'string' && REQUEST_ID_PATTERN.test(headerValue)) {
    return headerValue;
  }

  return randomUUID();
}
