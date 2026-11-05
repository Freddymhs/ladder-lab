🤖 Proyecto asistido por IA — línea de tiempo personal de configuraciones competitivas.

# ladder-lab

MCP personal para registrar estampas de configuración por juego y etapa. Concepto en `docs/_CONCEPTO.md`; backlog en `docs/backlog/README.md`.

Servidor MCP (TypeScript, Node 22, Zod) con transporte stdio para desarrollo y Streamable HTTP con token para el Mac Mini. Un solo usuario, sin interfaz web.

**Estado:** FASE 0 (base) en curso. Todavía no hay herramientas de dominio: llegan en FASE 1.

## Inicio rápido

```bash
pnpm install
pnpm dev
```

`pnpm dev` arranca por stdio. Las variables de entorno no se cargan solas: expórtalas o usa `node --env-file=.env`.

## Scripts

| Script            | Descripción                             |
| ----------------- | --------------------------------------- |
| `pnpm dev`        | Arranque con recarga (tsx watch)        |
| `pnpm build`      | Compila TypeScript y resuelve los alias |
| `pnpm start`      | Ejecuta el build                        |
| `pnpm test`       | Pruebas (Vitest)                        |
| `pnpm lint`       | ESLint + Prettier sobre `src/`          |
| `pnpm type-check` | Tipos sin emitir                        |

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
| `LOG_LEVEL`            | `info`        | Nivel de pino                                       |
| `NODE_ENV`             | `development` | `development`, `production` o `test`                |

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
├── tools/         # Herramientas MCP (F1 en adelante)
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
  http://<host-tailscale>:3000/mcp \
  --header "Authorization: Bearer <TOKEN>"
```

Con `--scope user` el token queda en la configuración local del usuario, no en `.claude/settings.json` del repo.

## Stack

Node.js 22 · TypeScript estricto (ESM) · MCP SDK v1 · Zod · Joi (solo entorno) · Pino · Vitest · ESLint + Prettier + Husky.
