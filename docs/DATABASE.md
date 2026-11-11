# Base de datos de Business Manager

## Alcance actual

La Fase 0, Tarea 004 configura Prisma ORM 7.10.1 exclusivamente con Microsoft SQL
Server. En esta tarea existen únicamente las tablas de monedas, usuarios, empresas,
sucursales, roles, permisos, membresías, acceso por sucursal, refresh tokens y
auditoría.

Productos, inventario, compras, ventas y movimientos financieros todavía no forman
parte del esquema.

## Tecnología y conexión

- Proveedor Prisma: `sqlserver`.
- Base soportada: Microsoft SQL Server 2017 o posterior.
- Driver de ejecución: `node-mssql` mediante `@prisma/adapter-mssql`.
- Esquema SQL: `dbo`.
- Prisma Client: generado como TypeScript ESM en `apps/api/src/generated/prisma`.

La CLI usa `DATABASE_URL` desde el archivo `.env` de la raíz. El adaptador de
ejecución recibe la misma URL, por lo que migraciones y aplicación no mantienen dos
configuraciones de conexión diferentes.

Ejemplo local (la contraseña real sólo vive en `.env`, que está ignorado por Git):

```env
DATABASE_URL="sqlserver://localhost:1433;database=BusinessManager;schema=dbo;user=business_manager_app;password={UNA_CLAVE_LOCAL};encrypt=true;trustServerCertificate=true"
```

Los caracteres especiales de usuario o contraseña deben escaparse con llaves según
la sintaxis de conexión de SQL Server. Nunca se debe guardar una contraseña real en
el repositorio.

## Preparación local de SQL Server Express

El entorno local verificado usa `LAMALEDUCADA\SQLEXPRESS` y la aplicación se conecta
mediante `tcp:localhost,1433`. Prisma usa el driver `node-mssql`, por lo que la
conexión de ejecución necesita TCP y un inicio de sesión SQL; la autenticación
integrada de Windows no se transmite mediante este adaptador.

Antes de ejecutar el script de preparación, la instancia debe cumplir estos
prerrequisitos administrativos:

1. Habilitar el protocolo TCP/IP y asignar el puerto fijo `1433`.
2. Habilitar el modo mixto de autenticación de SQL Server.
3. Reiniciar el servicio `MSSQL$SQLEXPRESS`.

Después, desde PowerShell y con un usuario de Windows que sea administrador de la
instancia:

```powershell
& .\scripts\configure-local-sqlserver.ps1
npm run prisma:validate -w @business-manager/api
npm run prisma:deploy -w @business-manager/api
npm run prisma:seed -w @business-manager/api
```

El script es idempotente: crea la base `BusinessManager` si no existe, crea o
actualiza el login `business_manager_app`, lo limita a `db_owner` dentro de esa base
y escribe una contraseña aleatoria en el `.env` ignorado. No muestra la contraseña
en la consola, no usa `sa` y no concede roles de servidor. `db_owner` se utiliza
sólo para desarrollo local porque Prisma necesita aplicar migraciones; en producción
deben separarse las credenciales de migración y las de ejecución.

El script no crea reglas de firewall ni restringe las interfaces de escucha. Si el
equipo se conecta a redes no confiables, SQL Server debe limitarse a la interfaz
local o proteger el puerto `1433` con el firewall antes de considerarlo endurecido.

## Tablas de la migración inicial

| Tabla              | Responsabilidad                                          |
| ------------------ | -------------------------------------------------------- |
| `Currencies`       | Catálogo global de monedas; seed inicial MXN y USD.      |
| `Users`            | Identidad global y hash de contraseña.                   |
| `Businesses`       | Tenant y configuración base de moneda, timezone y stock. |
| `Branches`         | Sucursales pertenecientes a un negocio.                  |
| `Roles`            | Roles aislados por negocio.                              |
| `Permissions`      | Catálogo global de permisos.                             |
| `RolePermissions`  | Asignación explícita de permisos a roles.                |
| `BusinessUsers`    | Membresía de un usuario en un negocio y su rol.          |
| `UserBranchAccess` | Sucursales que puede usar una membresía.                 |
| `RefreshTokens`    | Hash, vencimiento, revocación y cadena de rotación.      |
| `AuditLogs`        | Trazabilidad inmutable por negocio, usuario y sucursal.  |

## Aislamiento multiempresa

La base protege relaciones críticas además de las validaciones que se incorporarán
en los servicios:

- `Roles` y `Branches` usan claves alternativas `(BusinessId, Id)`.
- `BusinessUsers` relaciona el rol mediante `(BusinessId, RoleId)`, impidiendo usar
  un rol de otro negocio.
- `UserBranchAccess` incluye `BusinessId` y relaciona tanto la membresía como la
  sucursal mediante claves compuestas. Una membresía no puede recibir acceso a una
  sucursal de otro tenant.
- `AuditLogs` usa relaciones compuestas opcionales para impedir asociar actores o
  sucursales de un negocio diferente.
- Las claves foráneas usan `NO ACTION`; no hay borrados en cascada que puedan borrar
  membresías, tokens o auditoría accidentalmente.

Estas restricciones no sustituyen la regla de aplicación: toda consulta tenant
debe filtrar por el `businessId` obtenido del contexto autenticado.

## Migración

La migración inicial está en:

```text
apps/api/prisma/migrations/20261104223000_initial_security/migration.sql
```

El script SQL usa una transacción con `TRY/CATCH`, `COMMIT` y `ROLLBACK`. En el
entorno local, la base y el login se preparan con el script anterior. Después se
valida y aplica la migración:

```powershell
npm run prisma:validate -w @business-manager/api
npm run prisma:deploy -w @business-manager/api
```

Durante desarrollo, las migraciones futuras se crean con:

```powershell
npm run prisma:migrate -w @business-manager/api -- --name nombre_descriptivo
```

No usar `prisma db push` en producción y no modificar una migración que ya haya sido
aplicada en un ambiente compartido.

## Seed

El seed contiene sólo datos globales de esta tarea:

- MXN.
- USD.
- Los 36 permisos definidos en la especificación del producto.

Todos los registros se crean con `upsert` dentro de una transacción, por lo que el
comando es idempotente:

```powershell
npm run prisma:seed -w @business-manager/api
```

El seed no crea usuarios, contraseñas, negocios demo ni datos operativos.

## Comandos de mantenimiento

```powershell
npm run prisma:format -w @business-manager/api
npm run prisma:validate -w @business-manager/api
npm run prisma:generate -w @business-manager/api
npm run prisma:deploy -w @business-manager/api
npm run prisma:seed -w @business-manager/api
```

La generación de Prisma Client también se ejecuta antes de `dev`, `build`,
`typecheck` y `test`, y desde el `postinstall` de la raíz después de `npm install`.
El directorio generado se excluye de Git, ESLint y Prettier.
