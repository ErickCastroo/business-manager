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
- `npm run bruno:setup`: prepara idempotentemente el usuario técnico local de Bruno.
- `npm run bruno:test`: ejecuta la colección Bruno sin repetir el registro inicial.
- `npm run bruno:tenancy`: prueba las consultas de negocio y sucursal del usuario local.
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

## Colección Bruno

La carpeta `bruno/` contiene una colección versionada para probar la API real sin
guardar tokens ni secretos en Git. Incluye health, OpenAPI y el flujo completo de
autenticación: registro de preparación, login, `me`, refresh, rotación de sesión,
logout y rechazo del refresh después del logout.

Con la API local ejecutándose, prepara una sola vez el usuario técnico local:

```bash
npm run bruno:setup
```

Después puedes ejecutar repetidamente la colección principal:

```bash
npm run bruno:test
```

También puedes abrir directamente la carpeta `bruno/` desde Bruno y seleccionar
el ambiente `local`. Consulta [bruno/README.md](bruno/README.md) para conocer el
orden de las peticiones, las credenciales locales deliberadamente públicas y las
reglas para agregar módulos futuros.

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
bruno/                  Colección ejecutable para probar la API local
docs/
  API.md                Autenticación, contratos HTTP y OpenAPI
  DATABASE.md           Configuración, migraciones y seed de SQL Server
  PRODUCT_SPEC.md       Fuente principal de verdad del producto
```

La web permite iniciar sesión, registrar una cuenta y crear el primer negocio
con su sucursal principal. El encabezado del panel muestra el rol y permite
cambiar entre los negocios y sucursales accesibles para la cuenta.

Con SQL Server preparado y los catálogos iniciales cargados, ejecuta `npm run dev`
desde la raíz y abre `http://localhost:5173`. Usa **Crear cuenta** para probar el
flujo completo, o inicia sesión con una cuenta local ya registrada.

Vite lee `VITE_API_URL` desde el entorno del monorepo. Por defecto se conecta
a `http://localhost:4000/api/v1`. Usa el mismo nombre de host para la API y
la web en desarrollo, y agrega el origen de la web a `CORS_ORIGINS` cuando
cambies el puerto. En despliegue se puede usar `VITE_API_URL=/api/v1` si el
proxy publica ambas aplicaciones bajo el mismo origen.

El token de acceso vive en memoria, y la cookie `HttpOnly` permite recuperar la
sesión al recargar. La selección de negocio y sucursal vive en el panel. Al
cambiar de negocio, la web vuelve a consultar las sucursales disponibles para
ese contexto.

La Tarea 008 incorpora las rutas de miembros, roles e invitaciones. Para
probarlas, aplica la migración de SQL Server con
`npm run prisma:deploy -w @business-manager/api` y usa Swagger o la sección
`Members` de Bruno. El paso a paso está en [docs/API.md](docs/API.md).

Desde **Administración → Usuarios y roles**, el propietario puede elegir
el rol y las sucursales y pulsar **Enviar invitación**. Si el correo aún no tiene
cuenta, el enlace abre el registro y después muestra **Aceptar invitación**. Si
ya tiene cuenta, la persona inicia sesión si hace falta y luego confirma el acceso.
Debe usar el correo invitado. El enlace vence en 48 horas y se consume al confirmar.
Mientras el correo no esté configurado, **Generar enlace** permite copiarlo y
compartirlo en privado. Este enlace usa la dirección de la web abierta en el
navegador. Si la dirección es `localhost`, úsalo para probar en ese mismo equipo.

Para habilitar el envío, completa en el `.env` de la raíz `SMTP_HOST`,
`SMTP_PORT`, `SMTP_FROM`, `SMTP_USER` y `SMTP_PASSWORD` según tu remitente.
Usa `INVITATION_WEB_URL` con la dirección HTTPS de la web que pueda abrir el
destinatario. Si el servidor usa un relay sin autenticación, deja juntos vacíos
`SMTP_USER` y `SMTP_PASSWORD`. El puerto 465 usa TLS implícito y los demás
requieren STARTTLS fuera de localhost. Reinicia la API al cambiar el `.env`.

Para una prueba solo en tu PC, apunta a un servidor de captura SMTP en
`127.0.0.1` y a `INVITATION_WEB_URL=http://localhost:5173`. Usa exclusivamente
direcciones de prueba y abre el correo desde la bandeja local del capturador.
