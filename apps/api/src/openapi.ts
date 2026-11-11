import {
  authSessionDataSchema,
  loginRequestSchema,
  logoutDataSchema,
  meDataSchema,
  refreshDataSchema,
  registerRequestSchema,
} from '@business-manager/contracts';
import { z } from 'zod';

const requestIdSchema = z.string();
const successEnvelope = <T extends z.ZodType>(schema: T) =>
  z.object({
    data: schema,
    meta: z.object({ requestId: requestIdSchema }),
  });
const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    message: z.string(),
    requestId: requestIdSchema,
  }),
});

function toOpenApiSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _jsonSchemaDialect, ...openApiSchema } = z.toJSONSchema(schema);

  return openApiSchema;
}

const registerRequest = toOpenApiSchema(registerRequestSchema);
const loginRequest = toOpenApiSchema(loginRequestSchema);
const authSessionResponse = toOpenApiSchema(successEnvelope(authSessionDataSchema));
const refreshResponse = toOpenApiSchema(successEnvelope(refreshDataSchema));
const logoutResponse = toOpenApiSchema(successEnvelope(logoutDataSchema));
const meResponse = toOpenApiSchema(successEnvelope(meDataSchema));
const errorResponse = toOpenApiSchema(errorResponseSchema);

function documentedError(description: string) {
  return {
    content: {
      'application/json': {
        schema: errorResponse,
      },
    },
    description,
  };
}

export function createOpenApiDocument() {
  return {
    components: {
      securitySchemes: {
        bearerAuth: {
          bearerFormat: 'JWT',
          scheme: 'bearer',
          type: 'http',
        },
        refreshCookie: {
          in: 'cookie',
          name: 'business_manager_refresh',
          type: 'apiKey',
        },
      },
    },
    info: {
      description: 'API REST v1 de Business Manager.',
      title: 'Business Manager API',
      version: '0.1.0',
    },
    openapi: '3.1.0',
    paths: {
      '/api/v1/auth/login': {
        post: {
          requestBody: {
            content: {
              'application/json': { schema: loginRequest },
            },
            required: true,
          },
          responses: {
            200: {
              content: { 'application/json': { schema: authSessionResponse } },
              description: 'Sesión iniciada; el refresh token se entrega en cookie HttpOnly.',
            },
            400: documentedError('Datos inválidos.'),
            401: documentedError('Credenciales incorrectas.'),
            403: documentedError('Cuenta deshabilitada.'),
            429: documentedError('Límite de intentos excedido.'),
          },
          summary: 'Iniciar sesión',
          tags: ['Auth'],
        },
      },
      '/api/v1/auth/logout': {
        post: {
          responses: {
            200: {
              content: { 'application/json': { schema: logoutResponse } },
              description: 'Sesión revocada de forma idempotente.',
            },
          },
          security: [{ refreshCookie: [] }],
          summary: 'Cerrar sesión',
          tags: ['Auth'],
        },
      },
      '/api/v1/auth/me': {
        get: {
          responses: {
            200: {
              content: { 'application/json': { schema: meResponse } },
              description: 'Identidad global y membresías activas del usuario.',
            },
            401: documentedError('Access token ausente, inválido o expirado.'),
          },
          security: [{ bearerAuth: [] }],
          summary: 'Consultar el usuario autenticado',
          tags: ['Auth'],
        },
      },
      '/api/v1/auth/refresh': {
        post: {
          responses: {
            200: {
              content: { 'application/json': { schema: refreshResponse } },
              description: 'Refresh token rotado y nuevo access token emitido.',
            },
            401: documentedError('Refresh token ausente, inválido, expirado o reutilizado.'),
            403: documentedError('Cuenta deshabilitada.'),
            429: documentedError('Límite de intentos excedido.'),
          },
          security: [{ refreshCookie: [] }],
          summary: 'Rotar la sesión',
          tags: ['Auth'],
        },
      },
      '/api/v1/auth/register': {
        post: {
          requestBody: {
            content: {
              'application/json': { schema: registerRequest },
            },
            required: true,
          },
          responses: {
            201: {
              content: { 'application/json': { schema: authSessionResponse } },
              description: 'Cuenta creada; el refresh token se entrega en cookie HttpOnly.',
            },
            400: documentedError('Datos de registro inválidos.'),
            409: documentedError('El correo ya está registrado.'),
            429: documentedError('Límite de intentos excedido.'),
          },
          summary: 'Registrar una cuenta global de usuario',
          tags: ['Auth'],
        },
      },
    },
    servers: [{ url: 'http://localhost:4000' }],
  } as const;
}
