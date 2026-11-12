# Colección Bruno de Business Manager

Esta colección prueba los endpoints implementados hasta la Tarea 005. No incluye
endpoints futuros ni sustituye las pruebas Vitest/Supertest.

## Requisitos

- Node.js 24 LTS.
- La API ejecutándose en `http://localhost:4000`.
- SQL Server local configurado y con la migración inicial aplicada.
- Bruno Desktop o el CLI oficial de Bruno 4.3.0.

Inicia solamente la API desde la raíz del repositorio:

```powershell
npm run dev -w @business-manager/api
```

## Primera ejecución

El ambiente `local` contiene una identidad técnica deliberadamente pública que se
usa únicamente en la base de desarrollo:

```text
bruno.local@example.test
LocalBrunoPassword7
```

No reutilices estas credenciales en ningún ambiente compartido o productivo.

Prepara el usuario una sola vez:

```powershell
npm run bruno:setup
```

La petición de preparación acepta `201` cuando crea la cuenta y `409` cuando ya
existe. Esto permite repetir el setup sin crear usuarios adicionales.

## Suite principal

Ejecuta la colección sin volver a registrar el usuario:

```powershell
npm run bruno:test
```

El flujo se ejecuta en este orden:

1. Comprueba `GET /health` y el `X-Request-Id`.
2. Comprueba `GET /openapi.json` y las cinco operaciones de autenticación.
3. Inicia sesión y guarda el access token como variable efímera.
4. Consulta `GET /auth/me`.
5. Rota la cookie de refresh y actualiza el access token.
6. Vuelve a consultar `GET /auth/me` con el token rotado.
7. Cierra la sesión.
8. Comprueba que la cookie anterior ya no permite hacer refresh.

Bruno conserva automáticamente la cookie `business_manager_refresh` durante la
ejecución. La colección nunca la copia a una variable, al ambiente o al repositorio.

## Bruno Desktop

1. Abre Bruno.
2. Selecciona **Open Collection**.
3. Abre la carpeta `bruno/`.
4. Selecciona el ambiente `local`.
5. Ejecuta primero `Setup > Register local test user`.
6. Después ejecuta `System` y `Auth` en orden.

## Convenciones para las siguientes fases

- Crear una carpeta por dominio (`Businesses`, `Branches`, `Products`, etc.).
- Usar `seq` para que el flujo completo sea reproducible.
- Guardar IDs y tokens temporales con `bru.setVar`; nunca en archivos versionados.
- No guardar refresh tokens: deben permanecer en cookies HttpOnly.
- Validar siempre status, estructura, código de error y `requestId`.
- Agregar pruebas negativas de tenant isolation cuando exista la Fase 2.
- Etiquetar datos de preparación con `setup` para excluirlos de ejecuciones normales.
- Usar únicamente datos de prueba en ambientes locales.
