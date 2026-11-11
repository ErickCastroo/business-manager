import type { ErrorRequestHandler } from 'express';

import { logger } from '../lib/logger.js';
import { AppError, type ErrorDetails } from '../shared/errors/app-error.js';
import { getResponseRequestId } from '../shared/http/api-response.js';

type ApiErrorResponse = {
  error: {
    code: string;
    details?: ErrorDetails;
    message: string;
    requestId: string;
  };
};

function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  details?: ErrorDetails,
): ApiErrorResponse {
  return {
    error: {
      code,
      ...(details === undefined ? {} : { details }),
      message,
      requestId,
    },
  };
}

function hasErrorType(error: unknown, type: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as { type?: unknown }).type === type
  );
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = getResponseRequestId(response);

  if (hasErrorType(error, 'entity.parse.failed')) {
    response
      .status(400)
      .json(createErrorResponse('INVALID_JSON', 'El cuerpo JSON no es válido.', requestId));
    return;
  }

  if (hasErrorType(error, 'entity.too.large')) {
    response
      .status(413)
      .json(
        createErrorResponse(
          'REQUEST_BODY_TOO_LARGE',
          'El cuerpo de la petición excede el límite permitido.',
          requestId,
        ),
      );
    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(
        {
          err: error,
          method: request.method,
          path: request.originalUrl,
          requestId,
        },
        'Operational request error',
      );
    }

    response
      .status(error.statusCode)
      .json(createErrorResponse(error.code, error.message, requestId, error.details));
    return;
  }

  logger.error(
    {
      err: error,
      method: request.method,
      path: request.originalUrl,
      requestId,
    },
    'Unhandled request error',
  );

  response
    .status(500)
    .json(createErrorResponse('INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado.', requestId));
};
