# Business Manager
## Especificación maestra del producto, arquitectura y plan de implementación
**Versión:** 1.0  
**Fecha de referencia tecnológica:** 2 de noviembre de 2026  
**Estado:** MVP definido para implementación  
**Marca:** Business Manager es un nombre provisional; la marca final se definirá después.

---

## 1. Propósito del documento

Este documento es la fuente principal de verdad para construir el MVP de una plataforma SaaS de administración financiera y operativa para pequeños negocios. Está escrito para que un desarrollador humano o un agente de programación como Codex pueda implementar el producto por etapas sin tener que reinterpretar el alcance en cada tarea.

La plataforma debe permitir que un negocio pequeño controle ventas, inventario por sucursal, ingresos, egresos, cuentas por cobrar, cuentas por pagar, proveedores, clientes, pagos a empleados, usuarios y permisos desde una sola aplicación.

El producto no pretende ser, en su MVP, un sistema contable fiscal completo ni un sustituto de un ERP empresarial grande. El objetivo es ser mucho más sencillo de usar que un ERP tradicional, pero más estructurado y confiable que llevar el negocio en Excel, libretas o conversaciones de WhatsApp.

### 1.1 Objetivos de negocio

- Permitir que un dueño conozca cuánto vende, cuánto gasta, cuánto tiene por cobrar y cuánto tiene por pagar.
- Permitir que empleados registren operaciones sin tener acceso a información que no les corresponde.
- Mantener inventario separado por sucursal y almacén.
- Permitir operaciones en MXN y USD.
- Mantener trazabilidad de cambios sensibles.
- Poder vender el sistema como suscripción mensual a diferentes negocios usando una sola plataforma multiempresa.
- Mantener el costo técnico inicial bajo.
- Construir una base que pueda crecer a cientos de negocios sin reescribir el núcleo del sistema.

### 1.2 Público objetivo inicial

El producto será genérico para pequeños negocios, pero las primeras pruebas comerciales deben enfocarse en giros que normalmente administran parte de su operación con Excel, libretas o WhatsApp:

- Tiendas de abarrotes.
- Papelerías.
- Ferreterías.
- Refaccionarias.
- Tiendas de ropa.
- Distribuidores pequeños.
- Negocios familiares.
- Prestadores de servicios que también manejan productos o consumibles.

### 1.3 Fuera de alcance del MVP

No implementar en la primera versión:

- CFDI, timbrado SAT o contabilidad fiscal.
- Cálculo formal de nómina, ISR, IMSS o prestaciones.
- Contabilidad por partida doble.
- Comercio electrónico.
- Integraciones bancarias automáticas.
- Conciliación bancaria.
- Integraciones con WhatsApp Business API.
- IA para predicciones.
- Aplicación nativa Android/iOS.
- Operación offline con sincronización de ventas.
- Facturación electrónica.
- Contabilidad multi-país.

El sistema sí podrá registrar impuestos como datos de una operación, pero no deberá presentarse como software fiscal.

---

## 2. Decisiones tecnológicas definitivas

### 2.1 Stack principal

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Componentes | shadcn/ui |
| Tablas ERP | TanStack Table |
| Estado del servidor | TanStack Query |
| Formularios | React Hook Form + Zod |
| Router | React Router |
| Backend | Node.js + TypeScript + Express 5 |
| ORM | Prisma ORM 7 |
| Driver SQL Server | @prisma/adapter-mssql / node-mssql |
| Base de datos | Microsoft SQL Server |
| Validación API | Zod |
| Autenticación | JWT de acceso + refresh token rotativo |
| Hash de contraseña | Argon2id |
| Logging | Pino |
| Pruebas unitarias | Vitest |
| Pruebas API | Vitest + Supertest |
| E2E | Playwright |
| API docs | OpenAPI + Swagger UI |
| Monorepo | npm workspaces |

### 2.2 Versión de Node

Usar Node.js 24 LTS como versión objetivo del proyecto. No usar versiones EOL. El archivo `.nvmrc` debe fijar la major elegida para que todos los entornos trabajen con la misma versión.

### 2.3 Decisión sobre Prisma y SQL Server

Usar Prisma ORM 7 para este proyecto porque esa línea mantiene soporte para Microsoft SQL Server. No actualizar automáticamente a una major de Prisma que no soporte SQL Server. Cualquier actualización de Prisma debe revisar primero la matriz oficial de bases de datos soportadas.

### 2.4 Decisión sobre aplicación móvil

El MVP móvil será una PWA responsive construida con el mismo proyecto React + Vite. Debe ser instalable en teléfonos y tener una experiencia táctil adecuada, pero no debe prometer funcionamiento offline para registrar operaciones.

Una aplicación nativa con React Native + Expo se evaluará después de validar el producto con clientes reales. La API y el paquete de contratos se diseñarán de forma que una futura app Expo pueda reutilizarlos.

---

## 3. Principios de arquitectura

### 3.1 Monolito modular

No usar microservicios en el MVP. El backend será una sola aplicación Express organizada por módulos de negocio.

Ventajas:

- Menos infraestructura.
- Menos despliegues.
- Transacciones financieras e inventario más sencillas.
- Menos duplicación de contratos.
- Adecuado para un equipo de una o pocas personas.
- Fácil de dividir en servicios en el futuro si el volumen lo requiere.

### 3.2 Arquitectura multiempresa

La plataforma será multi-tenant por fila. Todos los datos operativos pertenecen a un `businessId`.

Regla obligatoria:

> El backend nunca debe confiar en un `businessId` enviado por el frontend para determinar a qué negocio pertenece la operación.

El negocio activo se obtiene del contexto autenticado y de la membresía del usuario. Toda consulta a datos de negocio debe estar filtrada por `businessId`.

### 3.3 Multisucursal

Un negocio puede tener una o más sucursales. El usuario puede tener acceso a todas o solo a determinadas sucursales.

Las operaciones de ventas, compras, inventario y caja deben registrar la sucursal responsable.

### 3.4 Multimoneda

El negocio tendrá una moneda base, inicialmente MXN o USD. Las operaciones pueden realizarse en MXN o USD.

Cada operación monetaria deberá conservar:

- Moneda original.
- Importe original.
- Tipo de cambio usado.
- Importe equivalente en moneda base.

Nunca recalcular una operación histórica usando el tipo de cambio actual.

### 3.5 Dinero y precisión

No hacer cálculos financieros importantes con `number` y punto flotante binario sin control.

Reglas:

- SQL Server: `DECIMAL(19,4)` para importes que requieran precisión extendida.
- Totales finales de cobro: redondear a dos decimales según moneda.
- Cantidades de inventario: `DECIMAL(18,3)`.
- Tipo de cambio: `DECIMAL(18,8)`.
- Backend: usar `Prisma.Decimal` o una librería decimal cuando se hagan cálculos de importes.
- API: serializar importes financieros de manera consistente. La implementación recomendada es enviarlos como strings decimales en DTOs sensibles y formatearlos en frontend.

### 3.6 Fechas

- Base de datos y API: almacenar timestamps en UTC.
- Cada negocio/sucursal tendrá timezone.
- La interfaz convierte UTC a hora local.
- Para fechas de negocio sin hora, usar `DATE`.
- Para fechas de transacción, usar `DATETIME2`.

### 3.7 Registros financieros no se borran

Una venta completada, compra recibida, pago o movimiento financiero no debe eliminarse físicamente.

Las correcciones se hacen con:

- cancelación,
- reverso,
- nueva operación compensatoria,
- auditoría.

---

## 4. Arquitectura del repositorio

Usar un monorepo con npm workspaces:

```text
business-manager/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  ├─ components/
│  │  │  ├─ features/
│  │  │  ├─ hooks/
│  │  │  ├─ lib/
│  │  │  ├─ routes/
│  │  │  ├─ styles/
│  │  │  └─ main.tsx
│  │  ├─ public/
│  │  ├─ vite.config.ts
│  │  └─ package.json
│  │
│  └─ api/
│     ├─ src/
│     │  ├─ app.ts
│     │  ├─ server.ts
│     │  ├─ config/
│     │  ├─ lib/
│     │  ├─ middleware/
│     │  ├─ modules/
│     │  ├─ shared/
│     │  └─ types/
│     ├─ prisma/
│     │  ├─ schema.prisma
│     │  ├─ migrations/
│     │  └─ seed.ts
│     ├─ tests/
│     └─ package.json
│
├─ packages/
│  ├─ contracts/
│  │  ├─ src/
│  │  │  ├─ schemas/
│  │  │  ├─ enums/
│  │  │  ├─ dto/
│  │  │  └─ index.ts
│  │  └─ package.json
│  └─ tsconfig/
│
├─ docs/
│  ├─ PRODUCT_SPEC.md
│  ├─ DATABASE.md
│  └─ API.md
├─ AGENTS.md
├─ package.json
├─ .nvmrc
├─ .env.example
└─ README.md
```

### 4.1 Organización del backend por feature

Cada módulo debe contener lo necesario para su caso de uso. No crear capas abstractas solo por patrón.

Ejemplo:

```text
modules/
└─ sales/
   ├─ sales.routes.ts
   ├─ sales.controller.ts
   ├─ sales.service.ts
   ├─ sales.schemas.ts
   ├─ sales.queries.ts
   ├─ sales.types.ts
   └─ sales.test.ts
```

Responsabilidades:

- `routes`: URL, middlewares y controller.
- `controller`: HTTP solamente. Obtiene input y devuelve output.
- `service`: reglas de negocio y transacciones.
- `queries`: consultas complejas reutilizables cuando sean necesarias.
- `schemas`: Zod de request/query params.
- `types`: tipos internos del módulo.
- `test`: pruebas unitarias o de integración cercanas al módulo.

No crear un repositorio genérico CRUD para todas las tablas. Prisma ya cumple la función de acceso a datos; crear repositorios únicamente si un módulo realmente necesita abstraer consultas complejas.

---

## 5. Paquetes NPM recomendados

### 5.1 Frontend: dependencias principales

```bash
npm install react-router \
  @tanstack/react-query \
  @tanstack/react-table \
  react-hook-form \
  @hookform/resolvers \
  zod \
  lucide-react \
  recharts \
  sonner \
  date-fns \
  react-number-format
```

Para UI:

```bash
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init
```

Agregar inicialmente estos componentes shadcn:

```bash
npx shadcn@latest add \
  button input label card badge \
  dialog alert-dialog dropdown-menu \
  select checkbox switch tabs \
  table pagination sheet separator \
  tooltip popover calendar command \
  form textarea skeleton sonner
```

### 5.2 ¿Por qué shadcn/ui?

- Es gratuito y open source.
- El código de los componentes se agrega al repositorio.
- Codex puede leer y modificar directamente los componentes.
- Se puede dar una apariencia ERP sin pelear con estilos cerrados.
- Funciona bien con Tailwind.
- Puede combinarse con TanStack Table para tablas con filtros, ordenamiento, selección, paginación y columnas configurables.

### 5.3 Backend: dependencias principales

```bash
npm install express@5 \
  cors \
  helmet \
  express-rate-limit \
  cookie-parser \
  zod \
  argon2 \
  jose \
  pino \
  pino-http \
  dotenv \
  @prisma/client@7 \
  @prisma/adapter-mssql \
  mssql \
  @asteasolutions/zod-to-openapi \
  swagger-ui-express
```

Dependencias de desarrollo:

```bash
npm install -D typescript tsx \
  @types/node \
  @types/express \
  @types/cors \
  @types/cookie-parser \
  @types/mssql \
  @types/swagger-ui-express \
  prisma@7 \
  vitest \
  supertest \
  @types/supertest \
  pino-pretty
```

### 5.4 Testing frontend

```bash
npm install -D vitest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom
```

E2E desde la raíz:

```bash
npm init playwright@latest
```

### 5.5 Paquetes que no instalar de inicio

Evitar dependencias innecesarias.

- Redux: no se necesita para el MVP.
- Axios: usar `fetch` con un wrapper central salvo que aparezca una necesidad real.
- Moment.js: usar `date-fns` y APIs nativas.
- Lodash completo: preferir funciones nativas o imports específicos.
- Librerías pesadas de grid comerciales: TanStack Table cubre el MVP.
- RabbitMQ/Kafka: no se necesita.
- Redis: no se necesita en la primera versión; evaluar cuando existan jobs, sesiones masivas o caching real.
- NestJS: se eligió Express para mantener el backend más directo.

### 5.6 Paquetes opcionales para fases posteriores

- `vite-plugin-pwa`: instalación PWA y service worker.
- `exceljs`: exportaciones Excel.
- `papaparse`: importación/exportación CSV.
- `multer`: subida de comprobantes si se almacenan archivos en la API.
- `node-cron` o un job runner: recordatorios programados.
- `zustand`: solo si aparece estado global de UI complejo.
- `@tanstack/react-virtual`: tablas extremadamente grandes.
- Expo + React Native: app nativa futura.

---

## 6. Diseño visual: ERP administrativo

La interfaz debe sentirse profesional, densa y clara, no como una landing page de startup.

### 6.1 Layout desktop

- Sidebar izquierda fija o colapsable.
- Header superior con negocio, sucursal activa, usuario y notificaciones.
- Contenido principal con breadcrumb.
- Filtros en la parte superior de cada listado.
- Tablas ocupando el ancho disponible.
- Acciones principales arriba a la derecha.
- Acciones secundarias en menú contextual por fila.
- Totales y resumen visibles en pantallas financieras.

### 6.2 Layout móvil

- Header compacto.
- Sidebar como `Sheet`.
- Acciones principales grandes.
- Tablas deben cambiar a tarjetas o permitir scroll horizontal cuando sea necesario.
- POS simplificado y usable con táctil.
- No intentar mostrar 12 columnas en una pantalla de teléfono.

### 6.3 Convenciones visuales

- Verde: pagado/completado/entrada positiva.
- Amarillo: pendiente/parcial.
- Rojo: vencido/cancelado/error.
- Azul o neutral: información y acciones primarias.
- No depender únicamente del color; usar texto e iconos.
- Montos alineados a la derecha.
- Fechas con formato local.
- Estados con `Badge`.
- Acciones destructivas requieren confirmación.

### 6.4 Componentes reutilizables propios

Crear sobre shadcn:

```text
<AppShell />
<PageHeader />
<BusinessSwitcher />
<BranchSwitcher />
<DataTable />
<DataTableToolbar />
<Money />
<CurrencyInput />
<DateRangePicker />
<StatusBadge />
<ConfirmActionDialog />
<EmptyState />
<ErrorState />
<LoadingTable />
<PermissionGuard />
<MetricCard />
<AuditTrail />
```

---

## 7. Navegación principal

```text
Dashboard

Ventas
├─ Nueva venta
├─ Historial de ventas
├─ Clientes
└─ Cuentas por cobrar

Inventario
├─ Productos
├─ Existencias
├─ Movimientos
└─ Transferencias

Compras
├─ Nueva compra
├─ Historial
├─ Proveedores
└─ Cuentas por pagar

Finanzas
├─ Resumen
├─ Ingresos y egresos
├─ Cuentas financieras
└─ Transferencias

Personal
├─ Empleados
└─ Pagos a empleados

Reportes
├─ Ventas
├─ Inventario
├─ Cuentas por cobrar
├─ Cuentas por pagar
├─ Flujo
└─ Gastos

Administración
├─ Sucursales
├─ Usuarios
├─ Roles y permisos
├─ Métodos de pago
└─ Configuración
```

---

## 8. Módulos del MVP

## 8.1 Autenticación y onboarding

### Funciones

- Registro de cuenta.
- Login.
- Logout.
- Refresh de sesión.
- Recuperación de contraseña se puede dejar para una iteración posterior del MVP si retrasa el inicio.
- Crear primer negocio.
- Crear sucursal principal.
- Seleccionar moneda base.
- Configurar timezone.
- Crear almacén principal.
- Crear cuenta de efectivo inicial.
- Invitar usuarios.
- Seleccionar negocio cuando el usuario pertenezca a más de uno.

### Flujo de onboarding

1. Usuario crea cuenta.
2. Verifica datos básicos.
3. Crea negocio.
4. Define moneda base.
5. Crea sucursal principal.
6. El sistema crea almacén predeterminado.
7. El sistema crea métodos de pago base.
8. El sistema crea roles base.
9. El sistema crea categorías financieras base.
10. Usuario llega al dashboard.

---

## 8.2 Dashboard

### KPIs

- Ventas de hoy.
- Ventas del mes.
- Cobrado del mes.
- Egresos del mes.
- Cuentas por cobrar abiertas.
- Cuentas por pagar abiertas.
- Productos con stock bajo.
- Valor estimado del inventario.
- Margen bruto estimado.

### Gráficas

- Ventas últimos 30 días.
- Ingresos vs egresos.
- Gastos por categoría.
- Top productos vendidos.
- Cuentas próximas a vencer.

### Reglas

No llamar “utilidad neta” a un cálculo que no incluya todos los elementos contables. Para el MVP usar “margen bruto estimado” cuando se base en precio de venta menos costo capturado.

---

## 8.3 Productos

### Funciones

- Crear producto.
- Editar producto.
- Activar/desactivar.
- SKU.
- Código de barras.
- Categoría.
- Unidad de medida.
- Descripción.
- Controlar o no inventario.
- Precios de venta por moneda.
- Stock mínimo.
- Visualizar existencias por sucursal/almacén.

### Reglas

- SKU único por negocio.
- Código de barras opcional.
- Un producto inactivo no puede agregarse a nuevas ventas.
- No borrar productos que tengan movimientos.
- El precio de venta actual no debe modificar ventas históricas.

---

## 8.4 Inventario

### Funciones

- Existencias por almacén.
- Entrada manual.
- Salida manual.
- Ajuste positivo.
- Ajuste negativo.
- Historial de movimientos.
- Transferencia entre almacenes/sucursales.
- Alerta de stock bajo.

### Reglas

- Nunca editar directamente una existencia.
- Todo cambio genera `InventoryMovement`.
- Venta completada genera salida.
- Compra recibida genera entrada.
- Cancelación genera movimiento inverso.
- Transferencia genera salida en origen y entrada en destino.
- Por defecto no permitir stock negativo.
- Si en el futuro se permite, debe ser configuración explícita del negocio.

### Transferencias

Estados:

```text
DRAFT
IN_TRANSIT
RECEIVED
CANCELLED
```

En MVP se puede simplificar a `DRAFT`, `COMPLETED`, `CANCELLED` si no se requiere recepción parcial.

---

## 8.5 Ventas

### Funciones

- Crear venta.
- Seleccionar sucursal y almacén.
- Buscar productos.
- Agregar cantidades.
- Modificar precio solo con permiso.
- Aplicar descuento.
- Seleccionar cliente opcional.
- Elegir moneda.
- Aplicar tipo de cambio.
- Registrar pago total, parcial o venta a crédito.
- Seleccionar cuenta financiera y método de pago.
- Ver historial.
- Ver detalle.
- Cancelar con permiso.
- Imprimir/descargar comprobante interno en una fase posterior.

### Flujo de venta completada

Dentro de una sola transacción de base de datos:

1. Validar usuario, negocio y sucursal.
2. Validar productos activos.
3. Validar precios y cantidades.
4. Validar stock.
5. Crear `Sale`.
6. Crear `SaleItems`.
7. Crear salidas de inventario.
8. Actualizar balances de inventario.
9. Si hay cobro, crear `Payment`.
10. Crear `FinancialTransaction` de ingreso.
11. Si queda saldo, crear `Receivable`.
12. Registrar auditoría.
13. Confirmar transacción.

Si cualquier paso falla, revertir todo.

### Estados

```text
DRAFT
COMPLETED
CANCELLED
```

### Estado de pago

```text
UNPAID
PARTIAL
PAID
```

---

## 8.6 Clientes y cuentas por cobrar

### Funciones

- Alta/edición de cliente.
- Historial de compras.
- Saldo actual.
- Crédito disponible opcional.
- Cuentas pendientes.
- Abonos parciales.
- Fecha de vencimiento.
- Antigüedad de saldos.
- Marcar cuenta como cancelada únicamente mediante flujo autorizado.

### Reporte de antigüedad

Buckets recomendados:

- Vigente.
- 1-7 días vencida.
- 8-30 días.
- 31-60 días.
- Más de 60 días.

---

## 8.7 Compras

### Funciones

- Registrar compra de mercancía.
- Proveedor.
- Moneda.
- Tipo de cambio.
- Almacén de recepción.
- Productos y cantidades.
- Costo unitario.
- Compra pagada, parcial o a crédito.
- Historial.
- Cancelación.

### Flujo de compra recibida

1. Crear compra.
2. Crear detalle.
3. Generar entradas de inventario.
4. Actualizar costo promedio base si se usa promedio.
5. Si se paga, crear pago de salida.
6. Crear movimiento financiero.
7. Si queda saldo, crear `Payable`.
8. Auditoría.

---

## 8.8 Proveedores y cuentas por pagar

### Funciones

- Alta/edición de proveedor.
- Contacto.
- Historial de compras.
- Saldo pendiente.
- Abonos.
- Vencimientos.
- Reporte de cuentas por pagar.

El saldo abierto de una cuenta por pagar debe reducirse en la misma transacción donde se aplica el pago.

---

## 8.9 Finanzas

### Cuentas financieras

Ejemplos:

- Caja principal MXN.
- Caja USD.
- BBVA MXN.
- Cuenta de efectivo sucursal 2.

Cada cuenta tiene una sola moneda.

### Movimientos

- Ingreso.
- Egreso.
- Transferencia entrada.
- Transferencia salida.
- Ajuste autorizado.
- Reverso.

### Funciones

- Registrar ingreso manual.
- Registrar egreso manual.
- Categorizar.
- Transferir entre cuentas.
- Consultar movimientos.
- Filtrar por fecha, sucursal, moneda, categoría.
- Ver saldo calculado.

### Regla importante

Una venta cobrada genera el movimiento financiero automáticamente. El usuario no debe volver a registrar ese mismo ingreso manualmente.

Lo mismo aplica para compras pagadas y pagos a empleados.

---

## 8.10 Empleados y pagos

El MVP no calculará nómina fiscal.

### Funciones

- Registrar empleado.
- Sucursal principal.
- Frecuencia de pago.
- Sueldo de referencia.
- Moneda.
- Registrar sueldo pagado.
- Registrar anticipo.
- Registrar bono.
- Registrar descuento manual.
- Historial de pagos.

Tipos:

```text
SALARY
ADVANCE
BONUS
OTHER
```

Todo pago que salga de una cuenta financiera debe generar un `Payment` y un `FinancialTransaction`.

---

## 8.11 Usuarios, roles y permisos

### Roles iniciales

- OWNER
- ADMIN
- CASHIER
- INVENTORY
- FINANCE

El dueño puede crear roles personalizados en una fase posterior; para el MVP es aceptable permitir edición de permisos de roles existentes o roles personalizados básicos.

### Permisos sugeridos

```text
business.read
business.settings.manage

branches.read
branches.manage

users.read
users.manage

products.read
products.manage

inventory.read
inventory.adjust
inventory.transfer

sales.read
sales.create
sales.change_price
sales.discount
sales.cancel

customers.read
customers.manage

receivables.read
receivables.collect

purchases.read
purchases.create
purchases.cancel

suppliers.read
suppliers.manage

payables.read
payables.pay

finance.read
finance.transaction.create
finance.transfer
finance.adjust

employees.read
employees.manage
employees.pay

reports.read
audit.read
```

### Acceso por sucursal

Un usuario puede tener acceso a:

- todas las sucursales,
- una sucursal,
- varias sucursales.

El frontend puede ocultar elementos, pero el backend es quien debe hacer cumplir el permiso.

---

## 8.12 Reportes del MVP

- Ventas por rango de fechas.
- Ventas por sucursal.
- Ventas por producto.
- Ventas por usuario.
- Margen bruto estimado.
- Existencias actuales.
- Movimientos de inventario.
- Productos con stock bajo.
- Valor estimado del inventario.
- Cuentas por cobrar.
- Antigüedad de cuentas por cobrar.
- Cuentas por pagar.
- Antigüedad de cuentas por pagar.
- Ingresos y egresos.
- Gastos por categoría.
- Flujo por cuenta financiera.
- Pagos a empleados.

La primera versión puede mostrar reportes en pantalla y exportar CSV. Excel avanzado puede agregarse después.

---

## 9. Modelo relacional SQL Server

El modelo siguiente es la definición lógica del MVP. Prisma deberá reflejar estas entidades y relaciones.

### 9.1 Reglas globales del esquema

- PK internas: `BIGINT IDENTITY`.
- Tablas de tenant: siempre incluyen `BusinessId`.
- FKs compuestas o validaciones de aplicación deben impedir relacionar registros de negocios diferentes.
- Nombres de tablas en plural.
- Timestamps: `CreatedAt`, `UpdatedAt`.
- Catálogos operativos usan `IsActive`.
- Documentos financieros usan `Status`; no se borran.
- Usar índices con `BusinessId` al inicio de la clave en tablas grandes.
- Crear índices específicos para los filtros del ERP.
- Mantener restricciones `CHECK` para estados y cantidades cuando sea práctico.

### 9.2 Seguridad y tenancy

#### Users

```text
UserId BIGINT PK IDENTITY
Email NVARCHAR(200) UNIQUE NOT NULL
PasswordHash NVARCHAR(500) NOT NULL
FirstName NVARCHAR(100) NOT NULL
LastName NVARCHAR(100) NULL
Phone NVARCHAR(30) NULL
Status TINYINT NOT NULL
EmailVerifiedAt DATETIME2 NULL
LastLoginAt DATETIME2 NULL
CreatedAt DATETIME2 NOT NULL
UpdatedAt DATETIME2 NULL
```

#### Businesses

```text
BusinessId BIGINT PK IDENTITY
Name NVARCHAR(150) NOT NULL
LegalName NVARCHAR(200) NULL
TaxId NVARCHAR(30) NULL
Email NVARCHAR(200) NULL
Phone NVARCHAR(30) NULL
BaseCurrencyCode CHAR(3) FK Currencies
Timezone NVARCHAR(80) NOT NULL
AllowNegativeStock BIT NOT NULL DEFAULT 0
Status TINYINT NOT NULL
CreatedAt DATETIME2 NOT NULL
UpdatedAt DATETIME2 NULL
```

#### Branches

```text
BranchId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
Code NVARCHAR(20) NOT NULL
Name NVARCHAR(120) NOT NULL
Phone NVARCHAR(30) NULL
AddressLine1 NVARCHAR(200) NULL
AddressLine2 NVARCHAR(200) NULL
City NVARCHAR(100) NULL
State NVARCHAR(100) NULL
CountryCode CHAR(2) NOT NULL DEFAULT 'MX'
PostalCode NVARCHAR(15) NULL
Timezone NVARCHAR(80) NOT NULL
IsMain BIT NOT NULL
IsActive BIT NOT NULL
CreatedAt DATETIME2 NOT NULL
UpdatedAt DATETIME2 NULL
UNIQUE(BusinessId, Code)
```

#### Roles

```text
RoleId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
Code NVARCHAR(50) NOT NULL
Name NVARCHAR(80) NOT NULL
Description NVARCHAR(250) NULL
IsSystem BIT NOT NULL
IsActive BIT NOT NULL
UNIQUE(BusinessId, Code)
```

#### Permissions

```text
PermissionId INT PK IDENTITY
Code NVARCHAR(100) UNIQUE NOT NULL
Description NVARCHAR(250) NOT NULL
```

#### RolePermissions

```text
RoleId BIGINT FK Roles
PermissionId INT FK Permissions
PRIMARY KEY(RoleId, PermissionId)
```

#### BusinessUsers

```text
BusinessUserId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
UserId BIGINT FK Users
RoleId BIGINT FK Roles
IsOwner BIT NOT NULL
IsActive BIT NOT NULL
JoinedAt DATETIME2 NOT NULL
UNIQUE(BusinessId, UserId)
```

#### UserBranchAccess

```text
BusinessUserId BIGINT FK BusinessUsers
BranchId BIGINT FK Branches
PRIMARY KEY(BusinessUserId, BranchId)
```

#### RefreshTokens

```text
RefreshTokenId BIGINT PK IDENTITY
UserId BIGINT FK Users
TokenHash CHAR(64) NOT NULL
ExpiresAt DATETIME2 NOT NULL
RevokedAt DATETIME2 NULL
ReplacedByTokenId BIGINT NULL
UserAgent NVARCHAR(500) NULL
IpAddress NVARCHAR(45) NULL
CreatedAt DATETIME2 NOT NULL
```

#### IdempotencyKeys

```text
IdempotencyKeyId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
UserId BIGINT FK Users
IdempotencyKey NVARCHAR(100) NOT NULL
Route NVARCHAR(200) NOT NULL
RequestHash CHAR(64) NOT NULL
ResponseStatus INT NULL
ResponseBody NVARCHAR(MAX) NULL
ExpiresAt DATETIME2 NOT NULL
CreatedAt DATETIME2 NOT NULL
UNIQUE(BusinessId, UserId, IdempotencyKey)
```

#### AuditLogs

```text
AuditLogId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BusinessUserId BIGINT NULL FK BusinessUsers
BranchId BIGINT NULL FK Branches
Action NVARCHAR(40) NOT NULL
EntityType NVARCHAR(80) NOT NULL
EntityId NVARCHAR(80) NOT NULL
BeforeJson NVARCHAR(MAX) NULL
AfterJson NVARCHAR(MAX) NULL
RequestId NVARCHAR(80) NULL
IpAddress NVARCHAR(45) NULL
CreatedAt DATETIME2 NOT NULL
```

### 9.3 Catálogos

#### Currencies

```text
CurrencyCode CHAR(3) PK
Name NVARCHAR(50) NOT NULL
Symbol NVARCHAR(10) NOT NULL
DecimalPlaces TINYINT NOT NULL
IsActive BIT NOT NULL
```

Seed obligatorio: MXN, USD.

#### ExchangeRates

```text
ExchangeRateId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
FromCurrencyCode CHAR(3) FK Currencies
ToCurrencyCode CHAR(3) FK Currencies
Rate DECIMAL(18,8) NOT NULL
EffectiveAt DATETIME2 NOT NULL
Source NVARCHAR(80) NULL
CreatedAt DATETIME2 NOT NULL
```

#### PaymentMethods

```text
PaymentMethodId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
Code NVARCHAR(30) NOT NULL
Name NVARCHAR(80) NOT NULL
IsCash BIT NOT NULL
IsActive BIT NOT NULL
UNIQUE(BusinessId, Code)
```

Seeds por negocio: CASH, CARD, TRANSFER, OTHER.

#### NumberSequences

```text
NumberSequenceId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BranchId BIGINT NULL FK Branches
DocumentType NVARCHAR(30) NOT NULL
Prefix NVARCHAR(20) NOT NULL
NextValue BIGINT NOT NULL
Padding TINYINT NOT NULL
UNIQUE(BusinessId, BranchId, DocumentType)
```

Tipos: SALE, PURCHASE, RECEIVABLE, PAYABLE, TRANSFER.

### 9.4 Productos e inventario

#### ProductCategories

```text
ProductCategoryId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
ParentCategoryId BIGINT NULL FK ProductCategories
Name NVARCHAR(100) NOT NULL
IsActive BIT NOT NULL
UNIQUE(BusinessId, Name)
```

#### UnitsOfMeasure

```text
UnitId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
Code NVARCHAR(20) NOT NULL
Name NVARCHAR(50) NOT NULL
DecimalPlaces TINYINT NOT NULL DEFAULT 0
IsActive BIT NOT NULL
UNIQUE(BusinessId, Code)
```

#### Products

```text
ProductId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
CategoryId BIGINT NULL FK ProductCategories
UnitId BIGINT FK UnitsOfMeasure
Sku NVARCHAR(50) NOT NULL
Barcode NVARCHAR(80) NULL
Name NVARCHAR(150) NOT NULL
Description NVARCHAR(500) NULL
TrackInventory BIT NOT NULL
MinimumStockDefault DECIMAL(18,3) NOT NULL DEFAULT 0
IsActive BIT NOT NULL
CreatedAt DATETIME2 NOT NULL
UpdatedAt DATETIME2 NULL
UNIQUE(BusinessId, Sku)
```

Crear índice no único para `(BusinessId, Barcode)` y validar duplicados según política del negocio.

#### ProductPrices

```text
ProductPriceId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
ProductId BIGINT FK Products
CurrencyCode CHAR(3) FK Currencies
SalePrice DECIMAL(19,4) NOT NULL
UpdatedAt DATETIME2 NOT NULL
UNIQUE(BusinessId, ProductId, CurrencyCode)
```

#### Warehouses

```text
WarehouseId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BranchId BIGINT FK Branches
Code NVARCHAR(20) NOT NULL
Name NVARCHAR(100) NOT NULL
IsDefault BIT NOT NULL
IsActive BIT NOT NULL
UNIQUE(BusinessId, BranchId, Code)
```

#### InventoryBalances

```text
InventoryBalanceId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
WarehouseId BIGINT FK Warehouses
ProductId BIGINT FK Products
Quantity DECIMAL(18,3) NOT NULL
AverageCostBase DECIMAL(19,4) NOT NULL DEFAULT 0
UpdatedAt DATETIME2 NOT NULL
UNIQUE(BusinessId, WarehouseId, ProductId)
```

#### InventoryMovements

```text
InventoryMovementId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BranchId BIGINT FK Branches
WarehouseId BIGINT FK Warehouses
ProductId BIGINT FK Products
MovementType NVARCHAR(30) NOT NULL
Quantity DECIMAL(18,3) NOT NULL
UnitCostBase DECIMAL(19,4) NULL
OriginalUnitCost DECIMAL(19,4) NULL
CurrencyCode CHAR(3) NULL
ExchangeRate DECIMAL(18,8) NULL
ReferenceType NVARCHAR(30) NULL
ReferenceId BIGINT NULL
Notes NVARCHAR(300) NULL
CreatedByBusinessUserId BIGINT FK BusinessUsers
CreatedAt DATETIME2 NOT NULL
```

MovementType:

```text
PURCHASE_IN
SALE_OUT
ADJUSTMENT_IN
ADJUSTMENT_OUT
TRANSFER_OUT
TRANSFER_IN
SALE_REVERSAL_IN
PURCHASE_REVERSAL_OUT
```

#### InventoryTransfers

```text
InventoryTransferId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
TransferNumber NVARCHAR(30) NOT NULL
SourceWarehouseId BIGINT FK Warehouses
DestinationWarehouseId BIGINT FK Warehouses
Status NVARCHAR(20) NOT NULL
Notes NVARCHAR(300) NULL
CreatedByBusinessUserId BIGINT FK BusinessUsers
CreatedAt DATETIME2 NOT NULL
CompletedAt DATETIME2 NULL
CancelledAt DATETIME2 NULL
UNIQUE(BusinessId, TransferNumber)
```

#### InventoryTransferItems

```text
InventoryTransferItemId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
InventoryTransferId BIGINT FK InventoryTransfers
ProductId BIGINT FK Products
Quantity DECIMAL(18,3) NOT NULL
```

### 9.5 Clientes, proveedores y empleados

#### Customers

```text
CustomerId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
Code NVARCHAR(30) NULL
Name NVARCHAR(150) NOT NULL
Phone NVARCHAR(30) NULL
Email NVARCHAR(200) NULL
TaxId NVARCHAR(30) NULL
CreditLimit DECIMAL(19,2) NULL
Notes NVARCHAR(500) NULL
IsActive BIT NOT NULL
CreatedAt DATETIME2 NOT NULL
UpdatedAt DATETIME2 NULL
```

#### Suppliers

```text
SupplierId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
Code NVARCHAR(30) NULL
Name NVARCHAR(150) NOT NULL
ContactName NVARCHAR(150) NULL
Phone NVARCHAR(30) NULL
Email NVARCHAR(200) NULL
TaxId NVARCHAR(30) NULL
Notes NVARCHAR(500) NULL
IsActive BIT NOT NULL
CreatedAt DATETIME2 NOT NULL
UpdatedAt DATETIME2 NULL
```

#### Employees

```text
EmployeeId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BranchId BIGINT NULL FK Branches
Code NVARCHAR(30) NULL
FullName NVARCHAR(150) NOT NULL
Phone NVARCHAR(30) NULL
HireDate DATE NULL
PayFrequency NVARCHAR(20) NULL
DefaultSalary DECIMAL(19,2) NULL
SalaryCurrencyCode CHAR(3) NULL FK Currencies
IsActive BIT NOT NULL
CreatedAt DATETIME2 NOT NULL
UpdatedAt DATETIME2 NULL
```

### 9.6 Ventas y cuentas por cobrar

#### Sales

```text
SaleId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BranchId BIGINT FK Branches
WarehouseId BIGINT FK Warehouses
CustomerId BIGINT NULL FK Customers
SaleNumber NVARCHAR(30) NOT NULL
Status NVARCHAR(20) NOT NULL
PaymentStatus NVARCHAR(20) NOT NULL
SaleDate DATETIME2 NOT NULL
CurrencyCode CHAR(3) FK Currencies
ExchangeRate DECIMAL(18,8) NOT NULL
Subtotal DECIMAL(19,2) NOT NULL
DiscountAmount DECIMAL(19,2) NOT NULL
TaxAmount DECIMAL(19,2) NOT NULL
Total DECIMAL(19,2) NOT NULL
Notes NVARCHAR(500) NULL
CreatedByBusinessUserId BIGINT FK BusinessUsers
CreatedAt DATETIME2 NOT NULL
CompletedAt DATETIME2 NULL
CancelledAt DATETIME2 NULL
UNIQUE(BusinessId, SaleNumber)
```

#### SaleItems

```text
SaleItemId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
SaleId BIGINT FK Sales
ProductId BIGINT FK Products
DescriptionSnapshot NVARCHAR(150) NOT NULL
Quantity DECIMAL(18,3) NOT NULL
UnitPrice DECIMAL(19,4) NOT NULL
UnitCostBaseSnapshot DECIMAL(19,4) NOT NULL
DiscountAmount DECIMAL(19,2) NOT NULL
TaxRate DECIMAL(9,4) NOT NULL DEFAULT 0
TaxAmount DECIMAL(19,2) NOT NULL
LineTotal DECIMAL(19,2) NOT NULL
```

#### Receivables

```text
ReceivableId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BranchId BIGINT FK Branches
CustomerId BIGINT FK Customers
SaleId BIGINT NULL FK Sales
ReceivableNumber NVARCHAR(30) NOT NULL
CurrencyCode CHAR(3) FK Currencies
ExchangeRate DECIMAL(18,8) NOT NULL
OriginalAmount DECIMAL(19,2) NOT NULL
OpenAmount DECIMAL(19,2) NOT NULL
DueDate DATE NULL
Status NVARCHAR(20) NOT NULL
CreatedAt DATETIME2 NOT NULL
ClosedAt DATETIME2 NULL
UNIQUE(BusinessId, ReceivableNumber)
```

### 9.7 Compras y cuentas por pagar

#### Purchases

```text
PurchaseId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BranchId BIGINT FK Branches
WarehouseId BIGINT FK Warehouses
SupplierId BIGINT FK Suppliers
PurchaseNumber NVARCHAR(30) NOT NULL
Status NVARCHAR(20) NOT NULL
PaymentStatus NVARCHAR(20) NOT NULL
PurchaseDate DATETIME2 NOT NULL
CurrencyCode CHAR(3) FK Currencies
ExchangeRate DECIMAL(18,8) NOT NULL
Subtotal DECIMAL(19,2) NOT NULL
DiscountAmount DECIMAL(19,2) NOT NULL
TaxAmount DECIMAL(19,2) NOT NULL
Total DECIMAL(19,2) NOT NULL
Notes NVARCHAR(500) NULL
CreatedByBusinessUserId BIGINT FK BusinessUsers
CreatedAt DATETIME2 NOT NULL
CompletedAt DATETIME2 NULL
CancelledAt DATETIME2 NULL
UNIQUE(BusinessId, PurchaseNumber)
```

#### PurchaseItems

```text
PurchaseItemId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
PurchaseId BIGINT FK Purchases
ProductId BIGINT FK Products
Quantity DECIMAL(18,3) NOT NULL
UnitCost DECIMAL(19,4) NOT NULL
DiscountAmount DECIMAL(19,2) NOT NULL
TaxRate DECIMAL(9,4) NOT NULL DEFAULT 0
TaxAmount DECIMAL(19,2) NOT NULL
LineTotal DECIMAL(19,2) NOT NULL
```

#### Payables

```text
PayableId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BranchId BIGINT FK Branches
SupplierId BIGINT FK Suppliers
PurchaseId BIGINT NULL FK Purchases
PayableNumber NVARCHAR(30) NOT NULL
CurrencyCode CHAR(3) FK Currencies
ExchangeRate DECIMAL(18,8) NOT NULL
OriginalAmount DECIMAL(19,2) NOT NULL
OpenAmount DECIMAL(19,2) NOT NULL
DueDate DATE NULL
Status NVARCHAR(20) NOT NULL
CreatedAt DATETIME2 NOT NULL
ClosedAt DATETIME2 NULL
UNIQUE(BusinessId, PayableNumber)
```

### 9.8 Finanzas y pagos

#### FinancialAccounts

```text
FinancialAccountId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BranchId BIGINT NULL FK Branches
Name NVARCHAR(100) NOT NULL
AccountType NVARCHAR(20) NOT NULL
CurrencyCode CHAR(3) FK Currencies
OpeningBalance DECIMAL(19,2) NOT NULL DEFAULT 0
IsActive BIT NOT NULL
CreatedAt DATETIME2 NOT NULL
```

AccountType:

```text
CASH
BANK
OTHER
```

#### FinancialCategories

```text
FinancialCategoryId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
ParentCategoryId BIGINT NULL FK FinancialCategories
CategoryType NVARCHAR(20) NOT NULL
Name NVARCHAR(100) NOT NULL
IsActive BIT NOT NULL
UNIQUE(BusinessId, CategoryType, Name)
```

CategoryType: `INCOME`, `EXPENSE`.

#### Payments

```text
PaymentId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BranchId BIGINT NULL FK Branches
FinancialAccountId BIGINT FK FinancialAccounts
PaymentMethodId BIGINT FK PaymentMethods
Direction NVARCHAR(10) NOT NULL
CustomerId BIGINT NULL FK Customers
SupplierId BIGINT NULL FK Suppliers
EmployeeId BIGINT NULL FK Employees
PaymentDate DATETIME2 NOT NULL
Amount DECIMAL(19,2) NOT NULL
CurrencyCode CHAR(3) FK Currencies
ExchangeRate DECIMAL(18,8) NOT NULL
BaseAmount DECIMAL(19,2) NOT NULL
Reference NVARCHAR(100) NULL
Notes NVARCHAR(300) NULL
Status NVARCHAR(20) NOT NULL
ReversalOfPaymentId BIGINT NULL FK Payments
CreatedByBusinessUserId BIGINT FK BusinessUsers
CreatedAt DATETIME2 NOT NULL
```

Direction: `IN`, `OUT`.

Status: `POSTED`, `REVERSED`.

Aplicar un `CHECK` para evitar múltiples contrapartes simultáneas cuando sea posible.

#### ReceivablePaymentApplications

```text
ReceivablePaymentApplicationId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
ReceivableId BIGINT FK Receivables
PaymentId BIGINT FK Payments
AppliedAmount DECIMAL(19,2) NOT NULL
CreatedAt DATETIME2 NOT NULL
UNIQUE(ReceivableId, PaymentId)
```

#### PayablePaymentApplications

```text
PayablePaymentApplicationId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
PayableId BIGINT FK Payables
PaymentId BIGINT FK Payments
AppliedAmount DECIMAL(19,2) NOT NULL
CreatedAt DATETIME2 NOT NULL
UNIQUE(PayableId, PaymentId)
```

#### EmployeePayments

```text
EmployeePaymentId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
EmployeeId BIGINT FK Employees
PaymentId BIGINT FK Payments
PaymentType NVARCHAR(20) NOT NULL
PeriodStart DATE NULL
PeriodEnd DATE NULL
GrossAmount DECIMAL(19,2) NOT NULL
Deductions DECIMAL(19,2) NOT NULL
NetAmount DECIMAL(19,2) NOT NULL
Notes NVARCHAR(300) NULL
CreatedAt DATETIME2 NOT NULL
```

#### FinancialTransactions

```text
FinancialTransactionId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
BranchId BIGINT NULL FK Branches
FinancialAccountId BIGINT FK FinancialAccounts
FinancialCategoryId BIGINT NULL FK FinancialCategories
TransactionType NVARCHAR(30) NOT NULL
TransactionDate DATETIME2 NOT NULL
Amount DECIMAL(19,2) NOT NULL
CurrencyCode CHAR(3) FK Currencies
ExchangeRate DECIMAL(18,8) NOT NULL
BaseAmount DECIMAL(19,2) NOT NULL
Description NVARCHAR(300) NOT NULL
ReferenceType NVARCHAR(30) NULL
ReferenceId BIGINT NULL
ReversalOfTransactionId BIGINT NULL FK FinancialTransactions
CreatedByBusinessUserId BIGINT FK BusinessUsers
CreatedAt DATETIME2 NOT NULL
```

TransactionType:

```text
INCOME
EXPENSE
TRANSFER_IN
TRANSFER_OUT
ADJUSTMENT
REVERSAL
```

#### FinancialTransfers

```text
FinancialTransferId BIGINT PK IDENTITY
BusinessId BIGINT FK Businesses
FromFinancialAccountId BIGINT FK FinancialAccounts
ToFinancialAccountId BIGINT FK FinancialAccounts
FromAmount DECIMAL(19,2) NOT NULL
FromCurrencyCode CHAR(3) FK Currencies
ToAmount DECIMAL(19,2) NOT NULL
ToCurrencyCode CHAR(3) FK Currencies
ExchangeRate DECIMAL(18,8) NOT NULL
TransferDate DATETIME2 NOT NULL
Notes NVARCHAR(300) NULL
CreatedByBusinessUserId BIGINT FK BusinessUsers
CreatedAt DATETIME2 NOT NULL
```

Genera exactamente dos `FinancialTransactions`: `TRANSFER_OUT` y `TRANSFER_IN`.

---

## 10. Índices obligatorios

Como mínimo:

```text
Users(Email) UNIQUE

Branches(BusinessId, Code) UNIQUE
BusinessUsers(BusinessId, UserId) UNIQUE

Products(BusinessId, Sku) UNIQUE
Products(BusinessId, Name)
Products(BusinessId, Barcode)

InventoryBalances(BusinessId, WarehouseId, ProductId) UNIQUE
InventoryMovements(BusinessId, WarehouseId, ProductId, CreatedAt DESC)

Sales(BusinessId, BranchId, SaleDate DESC)
Sales(BusinessId, CustomerId, SaleDate DESC)
Sales(BusinessId, SaleNumber) UNIQUE

Receivables(BusinessId, Status, DueDate)
Receivables(BusinessId, CustomerId, Status)

Purchases(BusinessId, BranchId, PurchaseDate DESC)
Purchases(BusinessId, SupplierId, PurchaseDate DESC)
Purchases(BusinessId, PurchaseNumber) UNIQUE

Payables(BusinessId, Status, DueDate)
Payables(BusinessId, SupplierId, Status)

FinancialTransactions(BusinessId, FinancialAccountId, TransactionDate DESC)
FinancialTransactions(BusinessId, FinancialCategoryId, TransactionDate DESC)

Payments(BusinessId, PaymentDate DESC)

AuditLogs(BusinessId, CreatedAt DESC)
```

Todos los índices deben revisarse con planes reales antes de sobreoptimizar.

---

## 11. API REST v1

Prefijo:

```text
/api/v1
```

### 11.1 Formato de respuesta

Éxito:

```json
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Lista paginada:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 350,
    "totalPages": 14,
    "requestId": "..."
  }
}
```

Error:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "No hay existencias suficientes.",
    "details": {},
    "requestId": "..."
  }
}
```

### 11.2 Auth

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
```

### 11.3 Negocio y sucursales

```text
GET    /businesses
POST   /businesses
GET    /businesses/:id
PATCH  /businesses/:id

GET    /branches
POST   /branches
GET    /branches/:id
PATCH  /branches/:id
```

### 11.4 Usuarios

```text
GET    /users
POST   /users/invitations
PATCH  /users/:businessUserId
GET    /roles
PATCH  /roles/:id
```

### 11.5 Productos

```text
GET    /products
POST   /products
GET    /products/:id
PATCH  /products/:id
GET    /products/:id/stock
GET    /product-categories
POST   /product-categories
```

### 11.6 Inventario

```text
GET    /inventory/balances
GET    /inventory/movements
POST   /inventory/adjustments
GET    /inventory/transfers
POST   /inventory/transfers
POST   /inventory/transfers/:id/complete
POST   /inventory/transfers/:id/cancel
```

### 11.7 Ventas

```text
GET    /sales
POST   /sales
GET    /sales/:id
POST   /sales/:id/complete
POST   /sales/:id/cancel
```

Para simplificar el MVP también se puede permitir crear una venta directamente en estado completado mediante `POST /sales` con una propiedad `complete: true`, pero internamente el service debe mantener una sola implementación de “postear venta”.

### 11.8 Clientes y cobranza

```text
GET    /customers
POST   /customers
GET    /customers/:id
PATCH  /customers/:id

GET    /receivables
GET    /receivables/:id
POST   /receivables/:id/payments
```

### 11.9 Compras y proveedores

```text
GET    /purchases
POST   /purchases
GET    /purchases/:id
POST   /purchases/:id/complete
POST   /purchases/:id/cancel

GET    /suppliers
POST   /suppliers
GET    /suppliers/:id
PATCH  /suppliers/:id

GET    /payables
GET    /payables/:id
POST   /payables/:id/payments
```

### 11.10 Finanzas

```text
GET    /finance/accounts
POST   /finance/accounts
PATCH  /finance/accounts/:id

GET    /finance/transactions
POST   /finance/income
POST   /finance/expenses
POST   /finance/transfers

GET    /finance/categories
POST   /finance/categories
```

### 11.11 Empleados

```text
GET    /employees
POST   /employees
GET    /employees/:id
PATCH  /employees/:id
GET    /employees/:id/payments
POST   /employees/:id/payments
```

### 11.12 Dashboard y reportes

```text
GET /dashboard/summary
GET /dashboard/sales-trend
GET /dashboard/expense-breakdown
GET /dashboard/low-stock

GET /reports/sales
GET /reports/inventory
GET /reports/receivables
GET /reports/payables
GET /reports/cash-flow
GET /reports/expenses
```

---

## 12. Convenciones HTTP y validación

- `GET`: consulta.
- `POST`: creación o acción de negocio.
- `PATCH`: modificación parcial.
- No usar `DELETE` para documentos financieros.
- Query params se validan con Zod.
- Body se valida con Zod.
- Params se validan con Zod.
- Tamaño máximo de página: 100.
- Página predeterminada: 1.
- Page size predeterminado: 25.
- Ordenamiento permitido mediante allowlist; nunca concatenar columnas arbitrarias provenientes del cliente.
- Filtros de texto deben estar limitados y saneados.
- Todas las rutas privadas requieren auth.
- Todas las rutas de tenant requieren business context.
- Rutas de sucursal requieren branch access.

---

## 13. Autenticación y seguridad

### 13.1 Contraseñas

- Hash Argon2id.
- Nunca registrar contraseña en logs.
- Nunca devolver hash.
- Aplicar política mínima razonable de contraseña.

### 13.2 Tokens

Access token:

- JWT firmado.
- Vida corta, por ejemplo 10-15 minutos.
- Contiene `userId`, no permisos completos.
- El contexto del negocio se valida contra DB/cache cuando sea necesario.

Refresh token:

- Aleatorio criptográficamente.
- Rotativo.
- Guardar únicamente hash en DB.
- En web: cookie `HttpOnly`, `Secure` en producción y `SameSite=Lax`.
- Al hacer refresh, revocar token anterior y crear uno nuevo.
- Logout revoca refresh token.

### 13.3 Web

- No guardar refresh token en `localStorage`.
- Access token preferentemente en memoria.
- Aplicar CORS con allowlist.
- Helmet.
- Rate limit en login, register y refresh.
- Request ID en cada petición.
- No mostrar stack traces en producción.

### 13.4 Multi-tenant

Crear middleware `businessContext`.

El middleware:

1. Obtiene usuario autenticado.
2. Obtiene negocio activo desde un header/control seguro o selección de sesión.
3. Valida membresía.
4. Construye `req.context`.
5. Los servicios reciben el `businessId` únicamente desde `req.context`.

Ejemplo:

```ts
type RequestContext = {
  requestId: string
  userId: bigint
  businessUserId: bigint
  businessId: bigint
  branchIds: bigint[]
  roleId: bigint
}
```

Nunca:

```ts
const businessId = req.body.businessId
```

para determinar ownership.

### 13.5 Idempotencia

Requerir header `Idempotency-Key` en operaciones sensibles:

- completar venta,
- registrar cobro,
- completar compra,
- registrar pago,
- transferencia financiera.

Si se repite la misma key con el mismo request, devolver la respuesta original. Si se reutiliza con contenido distinto, devolver conflicto.

---

## 14. Transacciones críticas

Estas operaciones deben ejecutarse en una transacción SQL.

### Completar venta

- Lock/validar inventario.
- Crear/actualizar venta.
- Crear items.
- Crear movimientos.
- Actualizar balances.
- Crear pago y movimiento financiero.
- Crear cuenta por cobrar cuando corresponda.
- Audit.

### Cancelar venta

- Verificar estado.
- Crear reversos de inventario.
- Revertir pagos o impedir cancelación si hay aplicaciones que requieren tratamiento manual.
- Cerrar/cancelar receivable.
- Marcar venta cancelada.
- Audit.

### Completar compra

- Compra.
- Items.
- Inventario.
- Costos.
- Pago.
- Payable.
- Finanzas.
- Audit.

### Aplicar pago a cuenta

- Validar saldo abierto.
- Validar moneda.
- Crear pago.
- Crear aplicación.
- Reducir open amount.
- Cambiar estado a PARTIAL/PAID.
- Crear financial transaction.
- Audit.

### Transferir inventario

- Validar origen != destino.
- Validar stock.
- Salida origen.
- Entrada destino.
- Actualizar ambos balances.
- Completar transferencia.
- Audit.

---

## 15. Estrategia de costo de inventario

Para el MVP usar costo promedio ponderado en moneda base.

Al recibir compra:

```text
nuevoCostoPromedio =
((stockAnterior * costoPromedioAnterior) + (cantidadEntrada * costoEntradaBase))
/
(stockAnterior + cantidadEntrada)
```

Una venta captura `UnitCostBaseSnapshot` del costo promedio al momento de vender. Esto permite estimar margen bruto histórico aunque después cambie el costo del producto.

No recalcular costo histórico de una venta.

Casos de stock 0 deben manejar división de manera segura.

---

## 16. Diseño del frontend por feature

Ejemplo de estructura:

```text
features/
├─ auth/
├─ dashboard/
├─ products/
├─ inventory/
├─ sales/
├─ customers/
├─ receivables/
├─ purchases/
├─ suppliers/
├─ payables/
├─ finance/
├─ employees/
├─ users/
└─ settings/
```

Cada feature puede tener:

```text
api/
components/
hooks/
pages/
schemas/
types/
```

### 16.1 Server state

TanStack Query maneja:

- fetching,
- cache,
- mutations,
- invalidación,
- estados loading/error,
- reintentos controlados.

No duplicar datos del servidor en Zustand/Context.

### 16.2 Estado global de UI

Usar React Context o estado local para:

- negocio activo,
- sucursal activa,
- preferencias de interfaz.

Solo introducir Zustand si aparece una necesidad real, por ejemplo un borrador POS muy complejo compartido entre rutas.

### 16.3 Formularios

React Hook Form + Zod.

Patrón:

```text
Zod schema
→ zodResolver
→ React Hook Form
→ componente shadcn Form/Input
→ mutation de TanStack Query
```

Los esquemas compartibles deben vivir en `packages/contracts`.

---

## 17. Pantallas necesarias

### Autenticación

- Login.
- Registro.
- Selección de negocio.
- Onboarding.

### Dashboard

- Dashboard principal.
- Selector de periodo/sucursal.

### Productos

- Listado.
- Alta/edición.
- Detalle.
- Existencias por sucursal.

### Inventario

- Existencias.
- Movimientos.
- Ajuste.
- Transferencia.

### Ventas

- POS/Nueva venta.
- Listado.
- Detalle.
- Cancelación.

### Clientes/Cobranza

- Listado clientes.
- Detalle cliente.
- Cuentas por cobrar.
- Registrar cobro.

### Compras

- Nueva compra.
- Listado.
- Detalle.

### Proveedores/Pagos

- Proveedores.
- Detalle proveedor.
- Cuentas por pagar.
- Registrar pago.

### Finanzas

- Cuentas.
- Movimientos.
- Nuevo ingreso.
- Nuevo egreso.
- Transferencia.

### Personal

- Empleados.
- Historial de pagos.
- Registrar pago/anticipo.

### Administración

- Sucursales.
- Usuarios.
- Roles.
- Métodos de pago.
- Configuración.

---

## 18. Reglas de UX importantes

- Confirmación antes de cancelar documentos.
- No usar modal para formularios muy grandes; usar página.
- Guardar filtros de tablas en URL cuando sea útil.
- Enter y teclado deben funcionar bien en POS.
- Mostrar loading skeleton.
- Mostrar error con acción de reintento.
- Deshabilitar doble submit.
- Mostrar resultado de cada operación con toast.
- Cuando haya deuda, mostrar monto pendiente de forma visible.
- Cuando se cambie moneda, mostrar tipo de cambio.
- Si una acción cambia inventario o dinero, indicar el efecto antes de confirmar.
- Formularios financieros deben mostrar resumen final antes de guardar.
- En móvil priorizar acciones de uso diario, no configuración.

---

## 19. PWA

Agregar en una fase avanzada del MVP:

- Manifest.
- Iconos.
- Instalación.
- Cache del app shell.
- Cache de assets estáticos.

No cachear de forma agresiva respuestas financieras.

No permitir nuevas ventas offline en el MVP. Si no hay conexión:

```text
“Sin conexión. Consulta disponible limitada. No se pueden registrar operaciones hasta recuperar conexión.”
```

---

## 20. Variables de entorno

### API `.env.example`

```env
NODE_ENV=development
PORT=4000

DATABASE_URL="sqlserver://localhost:1433;database=BusinessManager;user=sa;password={CHANGE_ME};encrypt=true;trustServerCertificate=true"

CORS_ORIGINS=http://localhost:5173

JWT_ACCESS_SECRET=change-me
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_DAYS=30

LOG_LEVEL=debug
```

### Web `.env.example`

```env
VITE_API_URL=http://localhost:4000/api/v1
VITE_APP_NAME=Business Manager
```

Nunca commitear secretos reales.

---

## 21. Scripts recomendados

### Raíz

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev -w apps/api\" \"npm run dev -w apps/web\"",
    "build": "npm run build -w apps/api && npm run build -w apps/web",
    "test": "npm run test -ws --if-present",
    "lint": "npm run lint -ws --if-present"
  }
}
```

Instalar en raíz:

```bash
npm install -D concurrently prettier
```

### API

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:seed": "tsx prisma/seed.ts"
  }
}
```

---

## 22. Logging y observabilidad

Pino debe registrar:

- requestId,
- método,
- ruta,
- status code,
- duración,
- userId cuando exista,
- businessId cuando exista.

No registrar:

- contraseñas,
- tokens completos,
- headers de autorización,
- datos bancarios sensibles.

Errores de negocio usan códigos conocidos; errores inesperados se registran con stack en servidor.

---

## 23. OpenAPI

Generar OpenAPI a partir de los esquemas Zod de la API cuando sea posible.

Exponer en desarrollo:

```text
/docs
/openapi.json
```

Deshabilitar o proteger Swagger en producción si se considera necesario.

Cada endpoint debe documentar:

- permisos,
- request,
- response,
- errores de negocio,
- paginación,
- ejemplos.

---

## 24. Testing

### 24.1 Backend unit/integration

Prioridad alta:

- tenant isolation,
- permisos,
- cálculos de totales,
- stock insuficiente,
- costo promedio,
- venta completa,
- cancelación,
- cobro parcial,
- pago parcial,
- transferencia de inventario,
- transferencia financiera,
- idempotencia,
- refresh token rotation.

### 24.2 Frontend

Probar:

- formularios,
- validación,
- filtros,
- permisos visuales,
- POS,
- estados loading/error,
- money formatting.

### 24.3 E2E con Playwright

Flujos críticos:

1. Registrar negocio.
2. Crear producto.
3. Registrar compra para tener stock.
4. Realizar venta de contado.
5. Verificar inventario.
6. Realizar venta a crédito.
7. Cobrar parcialmente.
8. Pagar proveedor.
9. Ver dashboard.
10. Verificar aislamiento entre dos negocios.

El caso 10 es obligatorio antes de aceptar pilotos.

---

## 25. Seed de desarrollo

Crear `prisma/seed.ts` con:

- MXN.
- USD.
- permisos.
- negocio demo.
- sucursal demo.
- roles.
- usuario owner demo.
- almacén.
- cuentas financieras MXN/USD.
- métodos de pago.
- categorías.
- 10 productos.
- 3 clientes.
- 3 proveedores.

Nunca usar credenciales demo en producción.

---

## 26. Estrategia de migraciones

- Toda modificación de DB va mediante Prisma Migrate.
- No editar una migración ya aplicada en ambientes compartidos.
- No usar `prisma db push` en producción.
- Datos seed globales deben ser idempotentes.
- Antes de cambios destructivos, crear migración de transición.
- Tomar backup antes de migrations de producción.

---

## 27. Roadmap de implementación

El roadmap está diseñado para que Codex trabaje en tareas pequeñas, verificables y con commits independientes.

### Fase 0 - Bootstrap

Objetivo: repositorio ejecutable.

- Crear npm workspaces.
- Crear Vite React TypeScript.
- Crear Express TypeScript.
- Configurar ESLint/Prettier.
- Configurar shared contracts.
- Health endpoint.
- Configurar variables de entorno.
- Configurar logger.
- Configurar pruebas básicas.

**Criterio de aceptación:** `npm run dev` levanta web y API; `/health` responde.

### Fase 1 - Base de datos y autenticación

- Prisma 7 + SQL Server.
- Modelo inicial de seguridad.
- Migración.
- Seed de permisos.
- Register/login/logout/refresh.
- Argon2id.
- Refresh token rotation.
- Auth middleware.
- Request context.

**Criterio:** dos usuarios pueden autenticarse y tokens revocados dejan de funcionar.

### Fase 2 - Multiempresa y sucursales

- Businesses.
- Branches.
- BusinessUsers.
- Roles.
- UserBranchAccess.
- Onboarding.
- Selectores negocio/sucursal.

**Criterio:** un usuario del negocio A no puede leer un ID válido del negocio B.

### Fase 3 - Base de UI ERP

- shadcn/ui.
- AppShell.
- Sidebar.
- Header.
- React Router.
- TanStack Query.
- DataTable.
- Money.
- CurrencyInput.
- Error handling global.

**Criterio:** navegación desktop/móvil funcional.

### Fase 4 - Productos e inventario

- Categorías.
- Unidades.
- Productos.
- ProductPrices.
- Warehouses.
- Balances.
- Ajustes.
- Movimientos.
- Transferencias.

**Criterio:** todo cambio de stock deja movimiento y no puede quedar negativo por defecto.

### Fase 5 - Compras

- Suppliers.
- Purchase/PurchaseItems.
- Recepción.
- Inventario.
- Pagos.
- Payables.

**Criterio:** compra a crédito aumenta inventario y genera deuda sin duplicar egreso.

### Fase 6 - Ventas

- Customers.
- POS.
- Sale/SaleItems.
- Stock.
- Payments.
- Receivables.
- Cancelaciones.

**Criterio:** venta de contado descuenta stock y genera ingreso; venta a crédito genera receivable.

### Fase 7 - Finanzas

- FinancialAccounts.
- Categories.
- Income/Expense.
- Transfers.
- Listado.
- Saldos.

**Criterio:** saldo de cuenta coincide con opening balance + movimientos posteados.

### Fase 8 - Cobranza y pagos

- Receivable applications.
- Payable applications.
- Pago parcial.
- Estados.
- Aging.

**Criterio:** no es posible aplicar más que el saldo abierto.

### Fase 9 - Empleados

- Employee CRUD.
- Salary reference.
- Advances.
- Payments.

**Criterio:** pago a empleado crea salida financiera con trazabilidad.

### Fase 10 - Dashboard y reportes

- KPIs.
- Trends.
- Top products.
- Low stock.
- AR/AP.
- Cash flow.

**Criterio:** métricas responden a filtro de sucursal y periodo.

### Fase 11 - PWA y hardening

- Manifest.
- Installability.
- Security review.
- Rate limiting.
- Idempotency.
- Audit.
- E2E.
- Performance.

### Fase 12 - Piloto

- Crear 3 negocios demo/piloto.
- Recopilar feedback.
- Registrar bugs.
- Congelar features nuevas durante corrección.
- Decidir qué debe entrar a versión 1.1.

---

## 28. Definition of Done por tarea

Una tarea no se considera terminada hasta que:

- Compila TypeScript sin errores.
- No introduce `any` injustificado.
- Tiene validación de entrada.
- Tiene control de permisos si aplica.
- Filtra por tenant.
- Tiene manejo de errores.
- Tiene pruebas para reglas importantes.
- Actualiza OpenAPI si cambia la API.
- Actualiza documentación si cambia comportamiento.
- `npm run lint` pasa.
- `npm test` pasa.
- No deja secretos.
- No deja `console.log` temporales.
- No usa TODO para ocultar funcionalidad incompleta crítica.

---

## 29. Reglas de programación para Codex

### Debe hacer

- Leer `AGENTS.md` y `docs/PRODUCT_SPEC.md` antes de cambiar código.
- Entender la fase actual.
- Hacer cambios pequeños.
- Reutilizar contratos compartidos.
- Validar todo input externo.
- Mantener separación multiempresa.
- Escribir migraciones.
- Ejecutar tests relevantes.
- Explicar al finalizar qué cambió y cómo probarlo.

### No debe hacer

- Inventar módulos fuera del alcance.
- Actualizar major versions sin necesidad.
- Cambiar SQL Server por otra DB.
- Reescribir arquitectura sin justificarlo.
- Confiar en IDs de negocio del cliente.
- Desactivar seguridad para “hacer que funcione”.
- Hacer `catch {}` vacío.
- Usar `any` como solución rápida.
- Eliminar datos financieros.
- Crear movimientos financieros duplicados.
- Calcular dinero con floats descuidados.
- Implementar todo el roadmap en una sola tarea.

---

## 30. Prompt maestro para iniciar Codex

Usar este prompt después de colocar este documento y `AGENTS.md` en el repositorio:

```text
Lee AGENTS.md y docs/PRODUCT_SPEC.md completos antes de modificar archivos.

Estamos construyendo Business Manager, un SaaS multiempresa para pequeños negocios.
Stack obligatorio:
- React + TypeScript + Vite
- Tailwind + shadcn/ui
- Node.js + TypeScript + Express 5
- Prisma ORM 7
- Microsoft SQL Server
- npm workspaces

Trabaja únicamente en la fase que te indique. Antes de programar:
1. Resume el objetivo.
2. Identifica archivos que crearás/modificarás.
3. Identifica riesgos de seguridad, tenant e integridad financiera.
4. Implementa.
5. Ejecuta lint, typecheck y pruebas relevantes.
6. Corrige fallos.
7. Resume cambios y deja comandos exactos para probar.

No avances a la siguiente fase por tu cuenta.
No cambies el stack.
No uses businessId enviado por el cliente como fuente de autorización.
Las operaciones de inventario/dinero deben ser transaccionales.
```

---

## 31. Primeras tareas exactas para Codex

### Tarea 001 - Crear monorepo

```text
Implementa Fase 0, Tarea 001.

Crea el monorepo con npm workspaces:
- apps/web
- apps/api
- packages/contracts
- packages/tsconfig

apps/web debe ser React + TypeScript + Vite.
apps/api debe ser Express 5 + TypeScript usando ESM.
Configura scripts root para dev/build/test/lint.
Agrega .nvmrc para Node 24.
Agrega .env.example.
No agregues todavía Prisma ni autenticación.

Criterios:
- npm install desde raíz funciona.
- npm run dev levanta ambos proyectos.
- web muestra una página básica.
- api GET /health devuelve 200 con { status: "ok" }.
- TypeScript strict.
```

### Tarea 002 - Calidad base

```text
Configura ESLint, Prettier, Vitest y estructura de errores.
Agrega requestId y Pino al API.
Agrega un test para /health.
No agregues features de negocio.
```

### Tarea 003 - UI base

```text
En apps/web configura Tailwind y shadcn/ui.
Agrega React Router y TanStack Query.
Crea AppShell administrativo:
- sidebar responsive,
- header,
- breadcrumb,
- placeholder de Dashboard.

Usa componentes shadcn.
No implementes todavía datos reales.
```

### Tarea 004 - Prisma/SQL Server

```text
Configura Prisma ORM 7 con SQL Server usando el conector soportado.
Implementa únicamente tablas:
Currencies, Users, Businesses, Branches, Roles, Permissions,
RolePermissions, BusinessUsers, UserBranchAccess, RefreshTokens, AuditLogs.

Genera migración inicial y seed de MXN/USD y permisos.
No implementes productos todavía.
```

### Tarea 005 - Auth

```text
Implementa register, login, refresh, logout y me.
Argon2id para passwords.
jose para JWT.
Refresh tokens rotativos y hasheados en DB.
Cookie HttpOnly para refresh en web.
Rate limit en login/register/refresh.
Agrega tests.
```

Después continuar en el orden del roadmap.

---

## 32. Criterios de aceptación del MVP completo

El MVP está listo para piloto solamente cuando un negocio puede:

1. Crear su cuenta y negocio.
2. Crear dos sucursales.
3. Crear usuarios con permisos diferentes.
4. Crear productos y precios MXN/USD.
5. Registrar existencias.
6. Transferir inventario.
7. Registrar compra de contado.
8. Registrar compra a crédito.
9. Pagar parcialmente un proveedor.
10. Registrar venta de contado.
11. Registrar venta a crédito.
12. Cobrar parcialmente un cliente.
13. Registrar ingreso y egreso manual.
14. Transferir dinero entre cuentas.
15. Registrar pago a empleado.
16. Consultar dashboard.
17. Consultar reportes básicos.
18. Usarlo correctamente desde móvil.
19. Instalarlo como PWA.
20. Mantener aislamiento total entre negocios.

Además:

- No hay stock negativo accidental.
- No hay doble registro por doble click.
- No hay pagos aplicados por encima del saldo.
- No hay acceso cruzado entre tenants.
- Cancelaciones dejan trazabilidad.
- Tests E2E críticos pasan.

---

## 33. Post-MVP / versión 1.1+

Priorizar según feedback real:

- Archivos/comprobantes.
- Excel avanzado.
- PDF de comprobantes.
- Recordatorios.
- Importación de productos por CSV.
- Escáner de códigos.
- Devoluciones formales.
- Caja y turnos.
- Cotizaciones.
- Órdenes.
- Gastos recurrentes.
- Dashboard configurable.
- Roles personalizados avanzados.
- Suscripción y cobro automático del SaaS.
- Soporte multi-empresa más avanzado.
- Notificaciones push.
- React Native + Expo.
- Integraciones.
- CFDI solo si se decide entrar al ámbito fiscal.

---

## 34. Estrategia comercial y de producto

No desarrollar durante meses antes de enseñar el producto.

Orden recomendado:

1. Construir hasta ventas, compras e inventario.
2. Preparar negocio demo.
3. Mostrarlo a 3-5 pequeños negocios.
4. Observar qué entienden sin explicación.
5. Registrar objeciones.
6. Terminar finanzas/reportes según feedback.
7. Conseguir primeros pilotos.
8. Cobrar después del periodo de prueba.
9. Priorizar funcionalidades que varios clientes pidan, no solicitudes aisladas.

La primera ventaja competitiva no será tener más funciones que un ERP. Será que el sistema sea fácil de usar, esté enfocado en pequeños negocios y les dé claridad de su dinero sin obligarlos a aprender contabilidad.

---

## 35. Referencias tecnológicas verificadas

Consultadas el 2 de noviembre de 2026.

- Vite: https://vite.dev/guide/
- Node releases: https://nodejs.org/en/about/previous-releases
- Express 5: https://expressjs.com/en/api/
- Prisma SQL Server v7: https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/sql-server
- Prisma 7: https://www.prisma.io/docs/orm/v7
- shadcn/ui Vite: https://ui.shadcn.com/docs/installation/vite
- TanStack Query: https://tanstack.com/query/latest
- TanStack Table: https://tanstack.com/table/latest/docs/overview
- React Hook Form: https://react-hook-form.com/get-started
- Zod: https://zod.dev/
- React Router: https://reactrouter.com/home
- Vitest: https://vitest.dev/guide/
- Playwright: https://playwright.dev/docs/intro

---

## 36. Decisión final

La primera versión debe optimizar tres cosas por encima de todo:

1. Integridad de dinero e inventario.
2. Aislamiento y seguridad multiempresa.
3. Facilidad de uso.

Si una mejora visual, optimización técnica o feature nueva entra en conflicto con alguno de estos tres puntos, se pospone.
