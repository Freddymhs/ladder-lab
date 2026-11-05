# FASE 0: BASE

**Prioridad**: Alta (bloquea todo)
**Dependencias**: ninguna
**Origen**: huecos de la plantilla `template-mcp` frente al concepto (`../_CONCEPTO.md`, sección Stack). No es una fase del concepto: es el trabajo de dejar la plantilla lista para que F1 sea solo dominio.

> Regla de la fase: no entra dominio aquí (nada de estampas). Si una tarea menciona `estampa`, es de F1.
> Topología de referencia: [`../diagrams/DIAGRAMAS_COMPONENTES.md`](../diagrams/DIAGRAMAS_COMPONENTES.md).

## Estado de ejecución (2026-11-05)

**F0 CERRADA el 2026-11-05: 8 de 8 tareas hechas.** La 0.2 (`supabase-js`) se hizo tras la confirmación de Freddy (regla global: no instalar sin confirmación): `@supabase/supabase-js` 2.119.0, verificado con `pnpm lint`, `type-check`, `build`, `test` y un `docker build` con pnpm 10 y `--frozen-lockfile` (mismo camino del CI). El lockfile lo reescribió pnpm 12: cambian sufijos de peer-resolution (`(supports-color@…)`) pero no las versiones de lo que ya había.

| Tarea               | Estado                                    |
| ------------------- | ----------------------------------------- |
| 0.1 Renombrar       | hecho                                     |
| 0.2 `supabase-js`   | hecho (2026-11-05, confirmado por Freddy) |
| 0.3 Entorno         | hecho                                     |
| 0.4 HTTP            | hecho (ADR `DECISION_TRANSPORTE_HTTP.md`) |
| 0.5 Token           | hecho                                     |
| 0.6 Retirar demo    | hecho                                     |
| 0.7 `CLAUDE.md`     | hecho                                     |
| 0.8 CI `type-check` | hecho                                     |

**Adelantado desde F1 por pedido de Freddy:** el `Dockerfile` y el `.dockerignore` (tarea 1.11, puntos 1 y 2) se hicieron aquí, con una prueba de política (`src/__tests__/docker.spec.ts`). El despliegue sigue siendo de F1 y no se ejecutó.

**Efectos laterales de ejecutar en esta máquina (pnpm 12):** se creó `pnpm-workspace.yaml` con `allowBuilds: esbuild: false`, porque pnpm 12 aborta `pnpm install` y los scripts con `ERR_PNPM_IGNORED_BUILDS` si esa política no está declarada. `hylian-mcp` lo resolvió con `esbuild: true`; aquí se eligió `false` (esbuild funciona sin su postinstall). Además `pnpm install` ejecuta `prepare: husky`, que deja `core.hooksPath=.husky/_` en este repo: el hook `pre-commit` correrá `lint-staged` en cada commit de Freddy.

## Orden de ejecución

1. Tarea 0.1 — renombrar identidad (base de todos los nombres)
2. Tarea 0.2 — `supabase-js` (con confirmación de Freddy)
3. Tarea 0.3 — entorno (depende de 0.2 por los nombres de variables que usa el cliente)
4. Tarea 0.4 — extraer y endurecer el HTTP (estructura)
5. Tarea 0.5 — token HTTP (se monta sobre 0.4 y 0.3)
6. Tarea 0.6 — retirar el andamio de demo (independiente, pero tras 0.4 para no tocar `main.ts` dos veces)
7. Tarea 0.7 — `CLAUDE.md` del proyecto (independiente)
8. Tarea 0.8 — CI con `type-check` (independiente)

## Tareas

### Tarea 0.1: Renombrar la identidad de `template-mcp` a `ladder-lab`

- Archivo: `package.json` (modificar) — `name: "ladder-lab"`, `description` real, `version: "0.1.0"`.
- Archivo: `src/config/constants.ts` (modificar) — `SERVER_NAME = 'ladder-lab'`; `SERVER_VERSION` igual a `package.json`.
- Archivo: `README.md` (modificar) — reemplazar las secciones heredadas de plantilla (Features, Client Configuration con `template-mcp`, Docker `template-mcp`, "Verificación" y "Gaps conocidos") por lo que de verdad aplica a ladder-lab; mantener la línea 1 (proyecto asistido por IA) y la 5 (puntero al concepto).
- Archivo: `src/resources/__tests__/server-info.resource.spec.ts` (modificar solo si 0.6 aún no lo retiró).
- Que hacer:
  1. Cambiar el nombre en los 4 archivos de arriba. Buscar el resto con `grep -rn "template-mcp" . --exclude-dir=node_modules --exclude-dir=.git --exclude=pnpm-lock.yaml`.
  2. `SERVER_VERSION` no puede importar `package.json` (`rootDir: ./src` en `tsconfig.json`): mantener la constante y agregar un test que compare ambas versiones, para que no diverjan en silencio.
  3. Confirmar con `pnpm install --frozen-lockfile` que `pnpm-lock.yaml` sigue válido tras el cambio de nombre (no asumirlo).
  4. `elevator_speech.md` describe la plantilla (`# template-mcp — Elevator Pitch`). No tocarlo ahora: se regenera con `/review:elevator_speech` cuando F1 esté en uso (ver criterio de salida de F1).
- Referencia: `../_CONCEPTO.md` (título y propósito).

### Tarea 0.2: Agregar `@supabase/supabase-js`

- Archivo: `package.json`, `pnpm-lock.yaml` (modificar)
- Que hacer:
  1. **Pedir confirmación a Freddy antes de instalar** (regla global: no ejecutar instaladores sin confirmación). Luego `pnpm add @supabase/supabase-js`.
  2. Verificar que compila con `module: NodeNext` y `strict` (`pnpm type-check`) y que la versión soporta Node 22 (`engines.node >= 22`).
  3. No agregar ORM ni otro cliente: la decisión del concepto es `supabase-js` con migraciones SQL.
- Referencia: `../_CONCEPTO.md` (tabla Stack, fila Cliente).

### Tarea 0.3: Configuración de entorno para Supabase, token y bind

- Archivo: `src/config/env.ts` (modificar) — extender el esquema Joi.
- Archivo: `src/config/constants.ts` (modificar) — agregar las claves a `ENV_KEYS` (SSOT de nombres).
- Archivo: `src/config/index.ts` (modificar) — re-exportar lo nuevo.
- Archivo: `.env.example` (modificar) — solo placeholders vacíos, **sin valores reales**.
- Que hacer:
  1. Variables nuevas (nombres definitivos en `ENV_KEYS`): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (solo servidor), `MCP_AUTH_TOKEN`, `MCP_HOST` (por defecto `127.0.0.1`).
  2. Reglas Joi: la URL y la clave son obligatorias fuera de `NODE_ENV=test`; el token es obligatorio (largo mínimo, ver 0.5) cuando `MCP_TRANSPORT=http`. Trampa conocida: `env.ts` hace `process.exit(1)` al importarse y `logger.ts` lo importa; si las variables fueran obligatorias también en test, rompe toda la suite. Usar `Joi.when` con `NODE_ENV`.
  3. `env` expone `supabaseServiceKey` y `authToken` pero el logger nunca los imprime (ver 0.5 criterio de redacción).
  4. **No tocar `.env` ni credenciales reales**: solo `.env.example`.
- Referencia: `src/config/env.ts` (patrón Joi existente).

### Tarea 0.4: Extraer el HTTP de `main.ts` y corregir sus huecos

- Archivo: `src/http/server.ts` (crear) — `createHttpApp`/`startHttpServer` testeable sin arrancar el proceso.
- Archivo: `src/http/index.ts` (crear) — barrel.
- Archivo: `src/main.ts` (modificar) — solo selecciona transporte y delega.
- Archivo: `tsconfig.json`, `vitest.config.ts` (modificar) — alias `@http/*` en **ambos** (hoy los alias viven duplicados; no agregar un tercer lugar).
- Que hacer: corregir lo que la plantilla deja anotado como gap (README, "Gaps conocidos") y lo que se ve en `src/main.ts`:
  1. Hoy hay **un solo** `StreamableHTTPServerTransport` para todo el proceso: el segundo cliente (o un reinicio de Claude Code) no puede inicializar sesión. **Decidido: modo sin estado** (un servidor + transporte por petición), documentado en `../decisions/DECISION_TRANSPORTE_HTTP.md`.
  2. `JSON.parse` sin `try/catch` sobre el cuerpo: un cuerpo inválido tumba la petición. Responder 400 y registrar con el logger central.
  3. Solo existe `POST /mcp`: atender `GET`/`DELETE /mcp` según lo que exija el transporte elegido en el punto 1; el resto 404/405.
  4. Límite de tamaño del cuerpo.
  5. `GET /healthz` sin autenticación, sin datos (para el healthcheck de Docker en F1).
  6. `listen(port)` sin host escucha en todas las interfaces: usar el host de 0.3.
  7. Tests con un servidor HTTP real en puerto efímero (hoy solo se probó con `curl`).
- Referencia: `src/main.ts` (lógica actual), `src/tools/__tests__/greet.tool.spec.ts` (patrón de test con SDK).

### Tarea 0.5: Token HTTP (acceso por Tailscale + token)

- Archivo: `src/http/auth.ts` (crear) — verificación del token como función pura + middleware.
- Archivo: `src/http/__tests__/auth.spec.ts` (crear)
- Que hacer:
  1. `Authorization: Bearer <token>` obligatorio en `/mcp`; respuesta 401 sin detalle (no decir si faltó o fue incorrecto).
  2. Comparación en tiempo constante (`crypto.timingSafeEqual`, con comparación previa de longitudes sin filtrar información).
  3. Arranque en fail-fast si `MCP_TRANSPORT=http` y el token falta o es corto (el mínimo es una constante con nombre, no un número suelto).
  4. El token nunca aparece en logs, mensajes de error ni respuestas. Test que lo verifique capturando la salida del logger.
  5. `/healthz` queda fuera de la autenticación (0.4).
  6. Hacerlo fallar a propósito: test con token vacío, token de otra longitud y cabecera mal formada deben dar 401 (denominador impreso por el test: casos = N).
  7. La generación y custodia del token es de Freddy (fuera del repo); este backlog solo define cómo se valida.
- Referencia: concepto, tabla Stack, fila Acceso ("solo Tailscale, con token").

### Tarea 0.6: Retirar el andamio de demo de la plantilla

- Archivo: `src/tools/greet.tool.ts`, `src/prompts/summarize.prompt.ts`, `src/resources/server-info.resource.ts` y sus `__tests__/` (eliminar)
- Archivo: `src/tools/index.ts`, `src/prompts/index.ts`, `src/resources/index.ts`, `src/server.ts` (modificar)
- Archivo: `src/server.spec.ts` o equivalente en `src/__tests__/` (crear) — prueba de humo
- Que hacer:
  1. Eliminar las tres piezas de demo y sus tests; limpiar imports muertos en los barrels.
  2. Dejar `registerTools` vacío pero cableado; `registerPrompts`/`registerResources` quedan vacíos si nada del concepto los pide (el concepto solo pide herramientas).
  3. Prueba de humo con `InMemoryTransport`: `createServer()` inicializa y se identifica como `ladder-lab`. `tools/list` no se puede probar todavía: el SDK solo registra ese método cuando existe al menos una herramienta, así que se agrega en F1 con `crear_estampa`.
- Referencia: `src/tools/__tests__/greet.tool.spec.ts` (patrón del test de humo antes de borrarlo).

### Tarea 0.7: `CLAUDE.md` del proyecto

- Archivo: `CLAUDE.md` (crear)
- Que hacer: hoy el proyecto no tiene `CLAUDE.md` (lo exige `/work:create-backlog`; esta corrida usó el global de `~/.claude/CLAUDE.md`). Escribir uno corto: qué es el proyecto, decisiones cerradas del concepto (estampa como unidad, versiones sin borrado, HTTP con token por Tailscale, `supabase-js` con migraciones SQL, JSON versionado), protección de F1, estructura de `src/`, comandos (`pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test`), y "no commits, los ordena Freddy". Apuntar al global en vez de copiarlo (SSOT).
- Referencia: `~/.claude/CLAUDE.md`; `../hylian-mcp/CLAUDE.md` como ejemplo de un hermano.

### Tarea 0.8: CI con `type-check`

- Archivo: `.github/workflows/ci.yml` (modificar)
- Que hacer: agregar `pnpm type-check` antes de `pnpm build` (hoy el CI solo corre `lint`, `build`, `test`; `lint` apunta a `src/` y no cubre `vitest.config.ts`). No agregar despliegue aquí (ver tarea 1.11).
- Referencia: `package.json` (scripts).

## Criterios de Aceptacion

- [x] `grep -rn "template-mcp"` fuera de `docs/`, `node_modules`, `.git`, `pnpm-lock.yaml` y `elevator_speech.md` da solo una mención histórica en `.claude/backlog-context.json`.
- [x] `@supabase/supabase-js` 2.119.0 instalado con confirmación de Freddy; `pnpm install --frozen-lockfile` pasa con pnpm 10 (comprobado en `docker build`). Todavía no se importa en el código: el cliente llega en 1.4.
- [x] El proceso HTTP rechaza con 401 toda petición a `/mcp` sin token válido, y los tests lo prueban con casos rojos reales.
- [x] Dos clientes distintos (o un reinicio) pueden inicializar contra el HTTP sin reiniciar el servidor.
- [x] El token y la clave de servicio no aparecen en ningún log ni en `.env.example`.
- [x] `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` pasan (80 pruebas).
- [x] No quedan `greet`, `summarize` ni `server-info` ni imports muertos.
- [x] `CLAUDE.md` existe y apunta al global.
