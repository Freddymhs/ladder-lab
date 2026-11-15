🤖 Proyecto asistido por IA — línea de tiempo personal de configuraciones competitivas.

# ladder-lab

MCP personal para registrar estampas de configuración por juego y etapa. Concepto en `docs/_CONCEPTO.md`; backlog en `docs/backlog/README.md`.

Servidor MCP (TypeScript, Node 22, Zod) con transporte stdio para desarrollo y Streamable HTTP con token para el Mac Mini. Un solo usuario, sin interfaz web.

**Estado:** F0 a F4 implementadas y **desplegadas el 2026-11-05** en el Mac Mini, con base en Neon y sin datos reales todavía. Operación: [`docs/runbooks/PUESTA_EN_MARCHA.md`](docs/runbooks/PUESTA_EN_MARCHA.md).

## Inicio rápido

```bash
pnpm install
pnpm dev
```

`pnpm dev` arranca por stdio. Las variables de entorno no se cargan solas: expórtalas o usa `node --env-file=.env`.

## Scripts

| Script                              | Descripción                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                          | Arranque con recarga (tsx watch)                                                                                                     |
| `pnpm build`                        | Compila TypeScript y resuelve los alias                                                                                              |
| `pnpm start`                        | Ejecuta el build                                                                                                                     |
| `pnpm test`                         | Pruebas (Vitest); no tocan ninguna base                                                                                              |
| `pnpm respaldo`                     | Respaldo completo y verificado (`--verificar <archivo>` comprueba uno); ver `docs/decisions/DECISION_RESPALDO.md`                    |
| `pnpm restaurar <archivo>`          | Simula una restauración; con `--aplicar` la hace                                                                                     |
| `pnpm test:integration`             | Pruebas contra Postgres/PostgREST reales; sin base se saltan y lo dicen. Con contenedores desechables: `scripts/test-integracion.sh` |
| `scripts/verificar-con-sens-lab.sh` | Prueba el contrato JSON con el importador real de sens-lab (en solo lectura); sale 1 si algo se rompe                                |
| `scripts/medir-indices.sh`          | Mide las consultas con `EXPLAIN ANALYZE` sobre datos sintéticos en un Postgres desechable                                            |
| `pnpm lint`                         | ESLint + Prettier sobre `src/`                                                                                                       |
| `pnpm type-check`                   | Tipos sin emitir                                                                                                                     |

## Configuración

Copia `.env.example` a `.env` (nunca se sube al repo). Se valida al arrancar y el proceso termina con el nombre de la variable inválida, sin imprimir su valor.

| Variable               | Por defecto   | Descripción                                         |
| ---------------------- | ------------- | --------------------------------------------------- |
| `MCP_TRANSPORT`        | `stdio`       | `stdio` o `http`                                    |
| `MCP_HOST`             | `127.0.0.1`   | Interfaz donde escucha el HTTP (IP u hostname)      |
| `PORT`                 | `3000`        | Puerto HTTP                                         |
| `MCP_AUTH_TOKEN`       | —             | Obligatorio con `http`; mínimo 32 caracteres        |
| `SUPABASE_URL`         | —             | Obligatoria fuera de `NODE_ENV=test`                |
| `SUPABASE_SERVICE_KEY` | —             | Obligatoria fuera de `NODE_ENV=test`; solo servidor |
| `RESPALDO_DIR`         | `respaldos`   | Carpeta de destino de `pnpm respaldo`               |
| `RESPALDO_RETENCION`   | `30`          | Cuántos respaldos se conservan                      |
| `LOG_LEVEL`            | `info`        | Nivel de pino                                       |
| `NODE_ENV`             | `development` | `development`, `production` o `test`                |

## Herramientas (F1, F2, F3 y estampa activa)

| Herramienta           | Qué hace                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `crear_estampa`       | Registra una estampa nueva (versión 1)                                                                                     |
| `corregir_estampa`    | Crea una versión nueva con los campos corregidos; conserva la anterior                                                     |
| `ver_estampa`         | Versión vigente, con su número y el total de versiones                                                                     |
| `listar_estampas`     | Resumen paginado, filtrable por juego y género                                                                             |
| `exportar`            | Envoltorio JSON versionado con el id de cada estampa, archivadas incluidas; con `incluirVersiones`, también las anteriores |
| `archivar_estampa`    | Oculta una estampa de la lista sin borrar nada (no hay herramienta para desarchivar)                                       |
| `importar_json`       | Carga un JSON de `exportar`; simulación por defecto, todo o nada, nunca pisa un id existente                               |
| `historial_versiones` | Todas las versiones de una estampa y qué campos cambiaron entre una y la siguiente                                         |
| `comparar_estampas`   | Compara de 2 a 10 estampas campo por campo; "sin dato" no cuenta como diferencia; no juzga                                 |
| `matches_perfectos`   | Estampas marcadas como match perfecto, con su configuración, rango (texto) y certeza                                       |
| `mejor_por_juego`     | Lo mismo para un juego: "mejor" = marcada como match perfecto, sin ordenar rangos ni juzgar                                |
| `marcar_activa`       | Marca la estampa que Freddy usa hoy en su juego (una por juego, fijada a una versión; por defecto la última)               |
| `activa_por_juego`    | La activa de un juego, con la versión entera (Windows, `.exe`, `archivosConfig`); si no hay, lo dice y sugiere nombres     |

**Activa no es match perfecto.** La activa es la configuración que Freddy usa hoy: exactamente una por juego, elegida a mano con `marcar_activa` (o con `marcarActiva: true` en `crear_estampa`/`corregir_estampa`, siempre preguntándole antes). Es lo que lee `/gameconfig:run-rts` como fuente de verdad. Match perfecto es una marca de calidad del resultado y puede haber muchas. Nada elige la activa por número de versión ni por match perfecto. Corregir la activa crea la versión N+1 pero la activa sigue en N hasta marcarla; archivarla deja el juego sin activa. `listar_estampas`, `activa_por_juego` y `mejor_por_juego` traen en cada estampa juego, género, etapa, versión, fecha, rango, certeza, `activa` y una `etiqueta` para armar un selector. Los nombres de juego no distinguen mayúsculas ni espacios en los extremos.

Migraciones en `supabase/migrations/`, en orden; la de la estampa activa es `20261114120000_estampa_activa.sql` (tabla `estampas_activas`, vistas `estampas_activas_detalle` y `juegos_registrados`, función `marcar_estampa_activa`). Cómo aplicarlas: `docs/runbooks/PUESTA_EN_MARCHA.md`.

Nada se borra: no existe ninguna herramienta ni permiso que borre, y la base rechaza `UPDATE`/`DELETE` de versiones (`docs/decisions/DECISION_MODELO_DATOS.md`). Formato del JSON: `docs/decisions/DECISION_FORMATO_ESTAMPA_V1.md`.

## Transporte HTTP

- `POST /mcp` — protocolo MCP. Exige `Authorization: Bearer <token>`; sin token válido responde `401` sin más detalle.
- `GET /healthz` — `200 {"status":"ok"}` sin token ni datos (healthcheck de Docker).
- `GET`/`DELETE /mcp` responden `405`. El servidor es **sin estado**: cada petición crea su propio servidor y transporte, así que varios clientes y los reinicios no chocan (`docs/decisions/DECISION_TRANSPORTE_HTTP.md`).
- Cuerpo máximo 1 MiB (`413`); JSON inválido `400`.
- El servidor no gestiona TLS: el acceso es solo por Tailscale (cifrado por la red) y por eso `MCP_HOST` debe ser la interfaz de Tailscale o loopback, nunca `0.0.0.0` fuera de un contenedor.

El token se genera con `openssl rand -hex 32`, vive en el host y en la configuración local de usuario de Claude Code. Nunca en este repo.

## Estructura

```
src/
├── main.ts        # Entrada: elige transporte
├── server.ts      # createServer() — fábrica del servidor MCP
├── config/        # Entorno (Joi) y constantes
├── common/        # Logger (stderr), redacción de secretos, errores de herramienta
├── http/          # Servidor HTTP: auth por token, límites, modo sin estado
├── domain/estampa/ # Esquema Zod, constantes, errores, fusión y exportación (sin dependencias de infraestructura)
├── data/          # Repositorio: interfaz, doble en memoria y Supabase (supabase-js)
├── respaldo/      # Respaldo, verificación y restauración (comandos `respaldo` y `restaurar`)
├── tools/         # Herramientas MCP
├── resources/     # Vacío: el concepto solo pide herramientas
└── prompts/       # Vacío: el concepto solo pide herramientas
```

## Docker

```bash
docker build -t ladder-lab .
# El puerto se publica solo en la IP de Tailscale del host; dentro del
# contenedor la imagen ya escucha en 0.0.0.0.
docker run -d --restart unless-stopped \
  -p <ip-tailscale>:3000:3000 \
  --env-file /ruta/fuera/del/repo/ladder-lab.env \
  ladder-lab
```

La imagen corre como usuario no root, solo con dependencias de producción, y trae un `HEALTHCHECK` contra `/healthz`. El archivo de entorno vive fuera del repo. Cómo se despliega desde el ThinkPad: `docs/backlog/FASE_1_REGISTRAR_Y_NO_PERDER.md`, tarea 1.11 (supuesto: igual que `hylian-mcp`, sin confirmar).

## Cliente (Claude Code en el PC de juegos)

```bash
claude mcp add --transport http --scope user ladder-lab \
  https://<host-del-servidor>.ts.net:8446/mcp \
  --header "Authorization: Bearer <TOKEN>"
```

Con `--scope user` el token queda en la configuración local del usuario, no en `.claude/settings.json` del repo.

## Stack

Node.js 22 · TypeScript estricto (ESM) · MCP SDK v1 · Zod · Joi (solo entorno) · Pino · Vitest · ESLint + Prettier + Husky.
