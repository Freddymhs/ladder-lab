# CLAUDE.md — ladder-lab

Reglas globales del usuario: `~/.claude/CLAUDE.md` (no se copian aquí). Este archivo solo añade lo propio del proyecto.

## Qué es

MCP personal de un solo usuario que guarda **estampas**: fotos de una configuración de Windows y de juego, ligadas a un juego y a un resultado. Concepto: `docs/_CONCEPTO.md`. Backlog: `docs/backlog/README.md`.

## Decisiones cerradas (no se reabren)

- La **estampa** es la unidad; cada una es independiente.
- **Versiones sin borrado**: corregir crea una versión nueva y conserva la anterior; nada se borra de verdad, se archiva.
- Acceso por **HTTP con token, solo por Tailscale**, en el Mac Mini.
- Datos en **Supabase** (proyecto propio, en la nube) con **`supabase-js` y migraciones SQL**. Sin ORM.
- Formato común: **JSON versionado**, esquema Zod. Es la única conexión con el convertidor.
- Stack base: TypeScript, Node 22, Zod, Vitest. No se re-decide.

## F1 está protegida

F1 es la única fase con prioridad hasta tener datos reales. Alcance cerrado: 5 herramientas, esquema, versiones, formato JSON y despliegue. Lo que no sea de F1 se anota en F2/F3/F4, no se cuela. F2 está bloqueada hasta que Freddy tenga 10 estampas reales (`docs/backlog/README.md`).

## Comandos

`pnpm lint` · `pnpm type-check` · `pnpm build` · `pnpm test`. Verificar los cuatro tras cada cambio.

## Estructura y convenciones del repo

- `src/config` (entorno y constantes), `src/common` (logger, redacción, errores), `src/http` (servidor HTTP), `src/tools` (herramientas MCP). Alias `@config`, `@common`, `@http`, `@tools`, `@resources`, `@prompts`: se declaran en `tsconfig.json` **y** en `vitest.config.ts`.
- stdout es el canal del protocolo en stdio: todo log va a stderr (pino). Prohibido `console.log`.
- Constantes nombradas en `constants.ts` de su dominio; nada de cadenas mágicas.
- El token (`MCP_AUTH_TOKEN`) y la clave de servicio (`SUPABASE_SERVICE_KEY`) nunca se loguean ni se escriben en el repo ni en `.claude/settings.json`.
- La versión de pnpm (major 10) está en `Dockerfile` y en `.github/workflows/ci.yml`: si una cambia, cambia la otra.
- Con pnpm 12 local, `pnpm-workspace.yaml` fija `esbuild: false` (política de builds); el CI usa pnpm 10 e ignora ese archivo.

## Reglas de trabajo

- **Sin commits ni push**: los ordena Freddy. Nada de firmas de IA en commits, PR ni archivos.
- Sin credenciales reales en el repo, en pruebas ni en ejemplos. `.env.example` solo lleva placeholders.
- No ejecutar migraciones ni instaladores sin confirmación. Aplicar una migración a Supabase lo hace Freddy.
- No desplegar sin orden explícita.
