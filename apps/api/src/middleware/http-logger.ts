import type { IncomingMessage, ServerResponse } from 'node:http';

import { pinoHttp } from 'pino-http';

import { logger } from '../lib/logger.js';
import { REQUEST_ID_HEADER, resolveRequestId } from '../lib/request-id.js';

export const httpLogger = pinoHttp({
  customLogLevel(_request, response, error) {
    if (error !== undefined || response.statusCode >= 500) {
      return 'error';
    }

    if (response.statusCode >= 400) {
      return 'warn';
    }

    return 'info';
  },
  customProps(request) {
    return {
      requestId: request.id,
    };
  },
  genReqId(request, response) {
    const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER]);
    response.setHeader(REQUEST_ID_HEADER, requestId);

    return requestId;
  },
  logger,
  serializers: {
    req(request: IncomingMessage) {
      return {
        id: request.id,
        method: request.method,
        remoteAddress: request.socket.remoteAddress,
        url: request.url,
      };
    },
    res(response: ServerResponse) {
      return {
        statusCode: response.statusCode,
      };
    },
  },
  wrapSerializers: false,
});
