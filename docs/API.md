# API de Business Manager

## Estado actual

La Tarea 005 implementa la autenticación global de usuarios. El prefijo de la API
es `/api/v1` y todos los endpoints de autenticación usan respuestas con `data`,
`meta.requestId` y códigos de error estables.

Esta tarea no crea negocios ni sucursales. Una cuenta recién registrada devuelve
`memberships: []` en `GET /auth/me` hasta que el onboarding de la Fase 2 asocie al
usuario con un negocio.

En desarrollo, la documentación interactiva se publica en:

- `http://localhost:4000/docs`
- `http://localhost:4000/openapi.json`

Swagger no se publica automáticamente cuando `NODE_ENV=production`.

## Preparación local

La API rechaza secretos JWT cortos o de ejemplo. Para crear o conservar de forma
idempotente un secreto local fuerte:

```powershell
& .\scripts\configure-local-auth.ps1
```

El script escribe el secreto únicamente en `.env`, no lo imprime y no lo agrega a
Git. Las variables relacionadas son:

```env
JWT_ACCESS_SECRET=CHANGE_ME_WITH_AT_LEAST_32_RANDOM_CHARACTERS
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_DAYS=30
CORS_ORIGINS=http://localhost:5173
```

`ACCESS_TOKEN_TTL` admite segundos, minutos u horas (`900s`, `15m`, `1h`) y no
puede superar 24 horas. `REFRESH_TOKEN_DAYS` debe estar entre 1 y 90.

## Modelo de sesión

### Access token

- JWT `HS256` firmado con `jose`.
- Duración predeterminada: 15 minutos.
- Incluye `sub` con el `userId`, `iss`, `aud`, `iat`, `exp`, `jti` y
  `tokenUse: "access"`.
- No contiene contraseñas, permisos ni contexto de negocio.
- Se devuelve en el body y el cliente web debe conservarlo en memoria.
- Se envía como `Authorization: Bearer <access-token>`.

### Refresh token

- Valor aleatorio de 48 bytes codificado como Base64URL.
- Sólo se entrega mediante la cookie `business_manager_refresh`.
- La cookie es `HttpOnly`, `SameSite=Lax`, host-only y usa el path
  `/api/v1/auth`.
- En producción también es `Secure`.
- La base guarda únicamente el SHA-256 del token.
- Cada refresh revoca el token anterior y emite uno nuevo.
- Reutilizar un token ya rotado revoca todas las sesiones activas de ese usuario.
- Logout es idempotente y revoca la sesión reconocida.

El refresh token nunca debe copiarse a `localStorage`, `sessionStorage` ni al body
de una respuesta.

## Endpoints

### `POST /api/v1/auth/register`

Crea únicamente la identidad global y abre una sesión.

```json
{
  "email": "duena@example.com",
  "password": "UnaClaveSegura7",
  "firstName": "Alicia",
  "lastName": "Pérez",
  "phone": "+52 614 123 4567"
}
```

Reglas de contraseña:

- Entre 12 y 128 caracteres.
- Al menos una mayúscula.
- Al menos una minúscula.
- Al menos un número.

Responde `201`, entrega un access token y establece la cookie HttpOnly. Un correo
duplicado responde `409 EMAIL_ALREADY_REGISTERED`.

### `POST /api/v1/auth/login`

```json
{
  "email": "duena@example.com",
  "password": "UnaClaveSegura7"
}
```

Responde `200`, entrega un access token y establece una nueva cookie de refresh.
Correo inexistente y contraseña incorrecta comparten el error genérico
`401 AUTH_INVALID_CREDENTIALS` para reducir enumeración de cuentas.

### `POST /api/v1/auth/refresh`

No recibe token en el body. Lee la cookie HttpOnly, la rota y responde con un nuevo
access token. Errores posibles:

- `AUTH_REFRESH_MISSING`.
- `AUTH_REFRESH_INVALID`.
- `AUTH_REFRESH_EXPIRED`.
- `AUTH_REFRESH_REUSED`.
- `ACCOUNT_DISABLED`.

Los errores eliminan la cookie del navegador.

### `POST /api/v1/auth/logout`

Revoca el refresh token de la cookie, elimina la cookie y responde:

```json
{
  "data": {
    "loggedOut": true
  },
  "meta": {
    "requestId": "..."
  }
}
```

Si la cookie no existe o no tiene un formato válido, el resultado sigue siendo
exitoso para no revelar el estado interno de la sesión.

### `GET /api/v1/auth/me`

Requiere:

```http
Authorization: Bearer <access-token>
```

Devuelve la identidad global y sólo las membresías activas del usuario. Los IDs
`BIGINT` se serializan como strings para evitar pérdida de precisión en JavaScript.

## Formato de éxito

```json
{
  "data": {
    "token": {
      "accessToken": "...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  },
  "meta": {
    "requestId": "..."
  }
}
```

## Formato de error

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "El correo o la contraseña no son correctos.",
    "requestId": "..."
  }
}
```

La validación Zod puede agregar `details.issues`, pero nunca incluye el valor de la
contraseña enviada.

## Límites y protección HTTP

- Register: 5 intentos por IP cada 15 minutos.
- Login: 10 intentos por IP cada 15 minutos.
- Refresh: 20 intentos por IP cada 15 minutos.
- Headers estándar `RateLimit` habilitados.
- CORS usa la allowlist de `CORS_ORIGINS` y permite credenciales sólo a esos
  orígenes.
- No se admite `*` en `CORS_ORIGINS`.
- Helmet protege las respuestas.
- Bodies JSON limitados a 100 KB.
- Respuestas de autenticación usan `Cache-Control: no-store`.

El almacenamiento en memoria de `express-rate-limit` es apropiado para una sola
instancia del MVP. Antes de escalar horizontalmente deberá sustituirse por un store
compartido.

## Prueba manual en PowerShell

Con la API ejecutándose en `http://localhost:4000`:

```powershell
$webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$registerBody = @{
  email = 'duena@example.com'
  password = 'UnaClaveSegura7'
  firstName = 'Alicia'
} | ConvertTo-Json

$registration = Invoke-RestMethod `
  -Uri 'http://localhost:4000/api/v1/auth/register' `
  -Method Post `
  -ContentType 'application/json' `
  -Body $registerBody `
  -WebSession $webSession

$accessToken = $registration.data.token.accessToken

Invoke-RestMethod `
  -Uri 'http://localhost:4000/api/v1/auth/me' `
  -Headers @{ Authorization = "Bearer $accessToken" } `
  -WebSession $webSession

Invoke-RestMethod `
  -Uri 'http://localhost:4000/api/v1/auth/refresh' `
  -Method Post `
  -WebSession $webSession

Invoke-RestMethod `
  -Uri 'http://localhost:4000/api/v1/auth/logout' `
  -Method Post `
  -WebSession $webSession
```

Usar un correo de prueba único. El registro no crea todavía el negocio ni la
sucursal; ese flujo pertenece a la Fase 2.

## Prueba de integración con SQL Server

La prueba crea dos usuarios con correos aleatorios, valida los cinco flujos contra
SQL Server y elimina usuarios y tokens al terminar:

```powershell
$env:RUN_DATABASE_INTEGRATION = 'true'
npm test -w @business-manager/api -- --run tests/auth-database.integration.test.ts
Remove-Item Env:RUN_DATABASE_INTEGRATION
```
