import {
  acceptInvitationSchema,
  authSessionDataSchema,
  branchDataSchema,
  businessDataSchema,
  createBranchSchema,
  createBusinessSchema,
  emailInvitationDataSchema,
  invitationDataSchema,
  inviteMemberSchema,
  loginRequestSchema,
  logoutDataSchema,
  meDataSchema,
  memberDataSchema,
  memberRoleSchema,
  onboardingDataSchema,
  refreshDataSchema,
  registerRequestSchema,
  tenantIdSchema,
  updateBranchSchema,
  updateBusinessSchema,
  updateMemberSchema,
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

function jsonContent(schema: z.ZodType) {
  return { 'application/json': { schema: toOpenApiSchema(schema) } };
}

function tenantOperation(options: {
  summary: string;
  tag: string;
  data: z.ZodType;
  body?: z.ZodType;
  permission?: string;
  id?: boolean;
  businessHeader?: boolean;
  paginated?: boolean;
  created?: boolean;
  conflict?: string;
  notFound?: string;
  description?: string;
  rateLimited?: boolean;
  emailDelivery?: boolean;
  onboarding?: boolean;
}) {
  const envelope = options.paginated
    ? z.object({
        data: z.array(options.data),
        meta: z.object({
          requestId: requestIdSchema,
          page: z.int().positive(),
          pageSize: z.int().positive(),
          total: z.int().nonnegative(),
          totalPages: z.int().nonnegative(),
        }),
      })
    : successEnvelope(options.data);
  const idSchema = toOpenApiSchema(tenantIdSchema);

  return {
    summary: options.summary,
    description:
      options.description ??
      (options.permission ? `Permiso requerido: ${options.permission}.` : undefined),
    tags: [options.tag],
    security: [{ bearerAuth: [] }],
    parameters: [
      ...(options.id ? [{ in: 'path', name: 'id', required: true, schema: idSchema }] : []),
      ...(options.businessHeader
        ? [{ in: 'header', name: 'X-Business-Id', required: true, schema: idSchema }]
        : []),
      ...(options.paginated
        ? [
            {
              in: 'query',
              name: 'page',
              schema: { type: 'integer', minimum: 1, maximum: 1_000_000, default: 1 },
            },
            {
              in: 'query',
              name: 'pageSize',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
            },
          ]
        : []),
    ],
    ...(options.body && { requestBody: { content: jsonContent(options.body), required: true } }),
    responses: {
      [options.created ? 201 : 200]: {
        content: jsonContent(envelope),
        description: options.summary,
      },
      400: documentedError('Datos, parámetros o selección de negocio inválidos.'),
      401: documentedError('Access token ausente, inválido o expirado.'),
      403: documentedError('Permiso insuficiente o cuenta deshabilitada.'),
      ...((options.permission || options.notFound) && {
        404: documentedError(options.notFound ?? 'El negocio o la sucursal no está disponible.'),
      }),
      ...(options.conflict && {
        409: documentedError(options.conflict),
      }),
      ...(options.rateLimited && { 429: documentedError('Límite de intentos excedido.') }),
      ...(options.emailDelivery && {
        502: documentedError('El servidor SMTP no confirmó el envío.'),
        503: documentedError('El envío por correo no está configurado.'),
      }),
      ...(options.onboarding && {
        503: documentedError('Catálogo inicial de monedas o permisos no disponible.'),
      }),
    },
  };
}

const businesses = { tag: 'Businesses', data: businessDataSchema };
const branches = { tag: 'Branches', data: branchDataSchema, businessHeader: true };

const tenantPaths = {
  '/api/v1/businesses': {
    get: tenantOperation({
      ...businesses,
      summary: 'Listar negocios de la cuenta',
      paginated: true,
    }),
    post: tenantOperation({
      ...businesses,
      summary: 'Crear negocio y sucursal principal',
      data: onboardingDataSchema,
      body: createBusinessSchema,
      created: true,
      onboarding: true,
    }),
  },
  '/api/v1/businesses/{id}': {
    get: tenantOperation({
      ...businesses,
      summary: 'Consultar negocio',
      id: true,
      permission: 'business.read',
    }),
    patch: tenantOperation({
      ...businesses,
      summary: 'Actualizar nombre o zona horaria del negocio',
      id: true,
      permission: 'business.settings.manage',
      body: updateBusinessSchema,
    }),
  },
  '/api/v1/branches': {
    get: tenantOperation({
      ...branches,
      summary: 'Listar sucursales accesibles',
      paginated: true,
      permission: 'branches.read',
    }),
    post: tenantOperation({
      ...branches,
      summary: 'Crear sucursal adicional',
      permission: 'branches.manage',
      body: createBranchSchema,
      created: true,
      conflict: 'El código de sucursal ya existe en este negocio.',
    }),
  },
  '/api/v1/branches/{id}': {
    get: tenantOperation({
      ...branches,
      summary: 'Consultar sucursal',
      id: true,
      permission: 'branches.read',
    }),
    patch: tenantOperation({
      ...branches,
      summary: 'Actualizar sucursal',
      id: true,
      permission: 'branches.manage',
      body: updateBranchSchema,
      conflict: 'El código de sucursal ya existe en este negocio.',
    }),
  },
};

const memberPaths = {
  '/api/v1/users': {
    get: tenantOperation({
      tag: 'Users',
      data: memberDataSchema,
      summary: 'Listar membresías del negocio',
      businessHeader: true,
      permission: 'users.read',
      paginated: true,
    }),
  },
  '/api/v1/users/{id}': {
    patch: tenantOperation({
      tag: 'Users',
      data: memberDataSchema,
      summary: 'Actualizar una membresía',
      businessHeader: true,
      permission: 'users.manage',
      id: true,
      body: updateMemberSchema,
      description:
        'Requiere ser propietario y tener users.manage. El ID es de la membresía. branchIds reemplaza las asignaciones al enviarse.',
      notFound: 'La membresía no está disponible en el negocio seleccionado.',
    }),
  },
  '/api/v1/users/invitations': {
    post: tenantOperation({
      tag: 'Users',
      data: invitationDataSchema,
      summary: 'Emitir código de invitación',
      businessHeader: true,
      permission: 'users.manage',
      body: inviteMemberSchema,
      created: true,
      description:
        'Requiere ser propietario y tener users.manage. El código privado vence a las 48 horas. Una nueva emisión invalida el código anterior.',
      conflict: 'La cuenta ya tiene una membresía en este negocio.',
    }),
  },
  '/api/v1/users/invitations/email': {
    post: tenantOperation({
      tag: 'Users',
      data: emailInvitationDataSchema,
      summary: 'Enviar invitación por correo',
      businessHeader: true,
      permission: 'users.manage',
      body: inviteMemberSchema,
      created: true,
      rateLimited: true,
      emailDelivery: true,
      description:
        'Requiere propietario. El enlace lleva a registro si el correo aún no tiene cuenta. La API responde cuando SMTP acepta el mensaje.',
      conflict: 'La cuenta ya tiene una membresía en este negocio.',
    }),
  },
  '/api/v1/users/invitations/accept': {
    post: tenantOperation({
      tag: 'Users',
      data: memberDataSchema,
      summary: 'Aceptar una invitación',
      body: acceptInvitationSchema,
      created: true,
      rateLimited: true,
      description:
        'Requiere la sesión de la cuenta con el correo invitado. La invitación determina el negocio, el rol y las sucursales.',
      notFound: 'La invitación no está disponible para esta cuenta.',
      conflict: 'La cuenta ya tiene una membresía en este negocio.',
    }),
  },
  '/api/v1/roles': {
    get: tenantOperation({
      tag: 'Users',
      data: z.array(memberRoleSchema),
      summary: 'Listar roles activos y permisos',
      businessHeader: true,
      permission: 'users.read',
    }),
  },
};

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
      ...tenantPaths,
      ...memberPaths,
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
