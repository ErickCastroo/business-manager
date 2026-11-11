import type { RequestHandler } from 'express';

import { AppError } from '../shared/errors/app-error.js';

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(
    new AppError({
      code: 'ROUTE_NOT_FOUND',
      message: 'La ruta solicitada no existe.',
      statusCode: 404,
    }),
  );
};
