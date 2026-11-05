# DECISION: HTTP sin estado, con token, y escucha en interfaz configurable

Fecha: 2026-11-05 (tarea 0.4 y 0.5 de FASE_0)

## Qué dice el concepto

Transporte «Streamable HTTP en Mac Mini M1» y acceso «solo Tailscale, con token» (`_CONCEPTO.md`, tabla Stack). No dice cómo se manejan las sesiones ni dónde escucha el proceso.

## Qué se hizo y por qué

**1. Modo sin estado** (`sessionIdGenerator: undefined`, un servidor MCP y un transporte por petición).

La plantilla creaba **un único** `StreamableHTTPServerTransport` para todo el proceso, en modo con sesión. El SDK rechaza un segundo `initialize` sobre un transporte ya inicializado (`400 Invalid Request: Server already initialized`, `webStandardStreamableHttp.js`), así que un segundo cliente o un reinicio de Claude Code contra el mismo proceso no podía conectarse. Esto sale de leer la plantilla y el SDK; no se reprodujo antes de corregirlo.

Se descartó el modo con sesiones (un mapa `sessionId → transporte`) porque agrega estado en memoria que hay que expirar y que se pierde en cada reinicio del contenedor, y ninguna herramienta del concepto lo necesita: todas son petición y respuesta sobre la base.

Consecuencias aceptadas:

- No hay streams iniciados por el servidor (notificaciones, progreso): `GET /mcp` responde `405`. Se usa `enableJsonResponse: true`, es decir, respuestas JSON y no SSE.
- Si una herramienta futura necesita notificaciones de progreso, hay que revisar esta decisión.
- Cada petición crea un `McpServer` nuevo: coste despreciable para un solo usuario.

**2. Token Bearer** en `/mcp`, comparado en tiempo constante (digests SHA-256 + `timingSafeEqual`). La autenticación va antes que la validación de método: sin token no se revela nada. El token nunca se loguea (el código no lo pasa al logger, hay un test que lo comprueba, y pino censura `authToken`, `supabaseServiceKey` y `headers.authorization` por si alguien los pasa por error). Largo mínimo 32 caracteres, exigido al arrancar (Joi) y al construir la app.

**3. `MCP_HOST` configurable**, por defecto `127.0.0.1`. La plantilla llamaba a `listen(port)` sin host, que escucha en todas las interfaces. En el contenedor la imagen fija `MCP_HOST=0.0.0.0` (dentro del contenedor no hay otra interfaz útil) y el aislamiento real se hace al publicar el puerto: `docker run -p <ip-tailscale>:3000:3000`. Escuchar solo en la interfaz de Tailscale sin contenedor es poner esa IP en `MCP_HOST`.

**4. Límites del borde**: cuerpo máximo 1 MiB (`413`), JSON inválido o vacío `400` (antes `JSON.parse` sin `try/catch`), `/healthz` sin token y sin datos para el `HEALTHCHECK`, cualquier error inesperado `500` genérico y registrado.

## Qué queda abierto

- No hay TLS en el proceso: se confía en que Tailscale cifra el tráfico. Si en algún momento el servidor se expone fuera del tailnet, esto cambia.
- No hay limitación de intentos fallidos de token. Con 32 caracteres mínimos y acceso solo por tailnet se considera suficiente; los rechazos quedan en el log (`Rejected unauthorized request`, sin el token) para detectar insistencia.
