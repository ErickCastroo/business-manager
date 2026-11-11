# AGENTS.md — Business Manager

## Contexto obligatorio

Este repositorio implementa Business Manager, un SaaS multiempresa para pequeños negocios.

Antes de modificar código, lee `docs/PRODUCT_SPEC.md` completo y trabaja únicamente en la fase/tarea solicitada.

## Stack bloqueado

- Node.js 24 LTS
- npm workspaces
- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui
- Router: React Router
- Server state: TanStack Query
- Tablas: TanStack Table
- Formularios: React Hook Form + Zod
- Backend: Node.js + TypeScript + Express 5
- ORM: Prisma ORM 7
- DB: Microsoft SQL Server
- Tests: Vitest, Supertest, Playwright

No cambies este stack sin una instrucción explícita.

## Reglas críticas

1. `businessId` de autorización nunca viene del body/query del cliente. Se obtiene del contexto autenticado.
2. Toda consulta tenant debe filtrar por `businessId`.
3. Toda operación con sucursal debe validar acceso a la sucursal.
4. Dinero e inventario se modifican dentro de transacciones.
5. Documentos financieros posteados no se borran: se cancelan o revierten.
6. No permitir stock negativo salvo configuración explícita.
7. No usar `any` salvo razón documentada.
8. Validar body, params y query con Zod.
9. No registrar secrets, passwords o tokens.
10. No duplicar server state en stores globales.
11. Prisma major debe permanecer en v7 mientras SQL Server sea la DB y una major posterior no tenga soporte confirmado.
12. No avanzar a otra fase por iniciativa propia.

## Convenciones backend

- Route -> Controller -> Service -> Prisma.
- Controller solo maneja HTTP.
- Service contiene reglas de negocio.
- Prisma no se usa directamente desde el frontend ni desde controllers complejos.
- Errores de negocio usan códigos estables.
- Todas las respuestas incluyen requestId.
- Usar Pino; no `console.log` en código final.
- TypeScript `strict: true`.
- Fechas/timestamps en UTC.
- Para importes usar Prisma.Decimal/aritmética decimal; no floats descuidados.

## Convenciones frontend

- Features por dominio.
- TanStack Query para datos remotos.
- React Hook Form + Zod para formularios.
- shadcn/ui como base visual.
- TanStack Table para tablas.
- Componentes sensibles a permiso deben usar `PermissionGuard`, pero el backend sigue siendo autoridad.
- Diseño administrativo ERP, responsive.
- En móvil simplificar tablas cuando sea necesario.

## Checklist antes de terminar una tarea

- Ejecutar typecheck.
- Ejecutar lint.
- Ejecutar tests relevantes.
- Revisar tenant isolation.
- Revisar permisos.
- Revisar transacciones si hay dinero/inventario.
- Actualizar OpenAPI si cambia API.
- Actualizar docs si cambia comportamiento.
- Resumir archivos modificados.
- Dar comandos exactos para probar.

## Forma de responder al terminar

1. Qué se implementó.
2. Archivos principales.
3. Decisiones importantes.
4. Pruebas ejecutadas y resultado.
5. Comandos para probar manualmente.
6. Riesgos o pendientes estrictamente dentro de la tarea actual.
