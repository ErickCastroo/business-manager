import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { getHttpConfig, type HttpConfig } from './config/http.js';
import { errorHandler } from './middleware/error-handler.js';
import { httpLogger } from './middleware/http-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { createAuthRouter, type AuthRouterOptions } from './modules/auth/auth.routes.js';
import { createOpenApiDocument } from './openapi.js';
import { AppError } from './shared/errors/app-error.js';

const removeContentSecurityPolicy: RequestHandler = (_request, response, next) => {
  response.removeHeader('Content-Security-Policy');
  next();
};

export type AppOptions = Readonly<{
  auth?: AuthRouterOptions;
  exposeApiDocs?: boolean;
  http?: HttpConfig;
}>;

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();
  const httpConfig = options.http ?? getHttpConfig();
  const exposeApiDocs = options.exposeApiDocs ?? !httpConfig.isProduction;

  app.disable('x-powered-by');
  app.use(httpLogger);
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (origin === undefined || httpConfig.allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(
          new AppError({
            code: 'CORS_ORIGIN_DENIED',
            message: 'El origen de la petición no está permitido.',
            statusCode: 403,
          }),
        );
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  if (exposeApiDocs) {
    const openApiDocument = createOpenApiDocument();
    app.get('/openapi.json', (_request, response) => {
      response.status(200).json(openApiDocument);
    });
    app.use(
      '/docs',
      removeContentSecurityPolicy,
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument),
    );
  }

  app.use('/api/v1/auth', createAuthRouter(options.auth));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
