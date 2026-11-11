# Business Manager

Monorepo del MVP de Business Manager, preparado con npm workspaces.

## Requisitos

- Node.js 24 LTS
- npm 11 o posterior

## Inicio rápido

```bash
npm install
```

En PowerShell, genera una clave JWT local segura sin mostrarla en consola:

```powershell
& .\scripts\configure-local-auth.ps1
```

Después inicia ambos proyectos:

```bash
npm run dev
```

La aplicación web queda disponible en `http://localhost:5173` y la API en
`http://localhost:4000`. El endpoint de comprobación de la API es
`GET http://localhost:4000/health`.

## Scripts de la raíz

- `npm run audit`: falla si npm detecta vulnerabilidades altas o críticas.
- `npm run dev`: inicia web y API en modo de desarrollo.
- `npm run build`: compila contratos, API y web.
- `npm run typecheck`: verifica TypeScript estricto en todos los proyectos.
- `npm test`: ejecuta las pruebas configuradas en los workspaces.
- `npm run lint`: ejecuta ESLint en todo el monorepo.
- `npm run lint:fix`: corrige automáticamente los problemas de lint que sean seguros.
- `npm run format`: aplica Prettier a los archivos mantenidos por el proyecto.
- `npm run format:check`: comprueba el formato sin modificar archivos.

## API y observabilidad

Todas las peticiones reciben un identificador en el header `X-Request-Id`. Si el
cliente envía un identificador válido se conserva; en caso contrario, la API genera
un UUID seguro. Los errores usan códigos estables y nunca exponen el stack al cliente.

Pino registra el identificador, método, ruta, código HTTP y duración. Los headers de
autorización, cookies, contraseñas y tokens están redactados en los logs.

Para ejecutar únicamente las pruebas de la API:

```bash
npm test -w @business-manager/api
```

## Autenticación

La Tarea 005 implementa `register`, `login`, `refresh`, `logout` y `me` bajo
`/api/v1/auth`. Las contraseñas usan Argon2id; los access tokens son JWT cortos y
los refresh tokens son aleatorios, rotativos y se guardan hasheados. El navegador
recibe el refresh token exclusivamente mediante una cookie `HttpOnly`.

Consulta [docs/API.md](docs/API.md) para conocer contratos, errores, seguridad y
comandos de prueba. En desarrollo también están disponibles:

- Swagger UI: `http://localhost:4000/docs`
- OpenAPI JSON: `http://localhost:4000/openapi.json`

## Base de datos

El API utiliza Prisma ORM 7.10.1 con Microsoft SQL Server y el adaptador oficial
`@prisma/adapter-mssql`. La Tarea 004 incorpora exclusivamente el modelo inicial de
seguridad y multiempresa, una migración SQL Server y un seed idempotente de MXN,
USD y permisos.

Consulta [docs/DATABASE.md](docs/DATABASE.md) para conocer el esquema, las garantías
de tenant isolation y los comandos de migración y seed.

En el entorno local con SQL Server Express y el modo mixto ya habilitado:

```powershell
& .\scripts\configure-local-sqlserver.ps1
npm run prisma:validate -w @business-manager/api
npm run prisma:deploy -w @business-manager/api
npm run prisma:seed -w @business-manager/api
```

El script crea de forma idempotente la base `BusinessManager`, configura un login
local exclusivo —sin usar `sa`— y guarda su contraseña aleatoria únicamente en el
archivo `.env` ignorado por Git.

## Interfaz web

La aplicación web incluye la base visual administrativa de Business Manager:

- AppShell responsive con barra lateral plegable y menú móvil.
- Header con breadcrumbs, contexto de empresa y sucursal y accesos de usuario.
- Dashboard inicial sin datos ficticios, con estados vacíos y accesos rápidos.
- Rutas preparadas para Ventas, Inventario, Compras, Finanzas, Personal,
  Reportes y Administración.
- Tailwind CSS y componentes shadcn/ui configurados con variables de tema.
- React Router para navegación y TanStack Query como proveedor de server state.

Para ejecutar únicamente las pruebas de la interfaz:

```bash
npm test -w @business-manager/web
```

## Estructura

```text
apps/
  api/                 Express 5 + TypeScript + ESM
  web/                 React + TypeScript + Vite
packages/
  contracts/           Contratos compartidos
  tsconfig/             Configuraciones TypeScript compartidas
docs/
  API.md                Autenticación, contratos HTTP y OpenAPI
  DATABASE.md           Configuración, migraciones y seed de SQL Server
  PRODUCT_SPEC.md       Fuente principal de verdad del producto
```

El alcance actual llega hasta la Tarea 005: autenticación global del usuario. La
interfaz todavía no consume los endpoints de auth y el onboarding de negocio y
sucursal pertenece a la Fase 2. Productos, inventario y reglas financieras siguen
fuera del alcance actual.
