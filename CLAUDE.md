# CLAUDE.md — ladder-lab

Reglas globales del usuario: `~/.claude/CLAUDE.md` (no se copian aquí). Este archivo solo añade lo propio del proyecto.

## Qué es

MCP personal de un solo usuario que guarda **estampas**: fotos de una configuración de Windows y de juego, ligadas a un juego y a un resultado. Concepto: `docs/_CONCEPTO.md`. Backlog: `docs/backlog/README.md`.

## Decisiones cerradas (no se reabren)

- La **estampa** es la unidad; cada una es independiente.
- **Versiones sin borrado**: corregir crea una versión nueva y conserva la anterior; nada se borra de verdad, se archiva.
- Acceso por **HTTP con token, solo por Tailscale**, en el Mac Mini.
- Datos en **Supabase** (proyecto propio, en la nube) con **`supabase-js` y migraciones SQL**. Sin ORM. Un documento jsonb por versión (`DECISION_MODELO_DATOS.md`).
- Formato común: **JSON versionado**, esquema Zod (`DECISION_FORMATO_ESTAMPA_V1.md`, aceptado por Freddy). Es la única conexión con el convertidor (sens-lab). Toda exportación lleva el `id` de cada estampa.
- Stack base: TypeScript, Node 22, Zod, Vitest. No se re-decide.

## F1 está protegida

F1 tiene un alcance cerrado: 5 herramientas, esquema, versiones, formato JSON y despliegue. Lo que no sea de F1 se anota en F2/F3/F4, no se cuela. La compuerta de F2 (10 estampas reales) **se levantó por orden de Freddy el 2026-11-05 sin datos reales**: `docs/decisions/DECISION_COMPUERTA_F2.md`. Cuando existan las 10 estampas, F2 se revisa con datos.

## Comandos

`pnpm lint` · `pnpm type-check` · `pnpm build` · `pnpm test`. Verificar los cuatro tras cada cambio. `pnpm test:integration` (o `scripts/test-integracion.sh`, que levanta contenedores desechables) prueba el SQL y el repositorio de Supabase contra Postgres y PostgREST reales; en CI corren en el job `integracion`.

## Estructura y convenciones del repo

- `src/config` (entorno y constantes), `src/common` (logger, redacción, errores), `src/http` (servidor HTTP), `src/domain` (esquema y reglas, sin infraestructura), `src/data` (repositorios), `src/tools` (herramientas MCP). Alias `@config`, `@common`, `@http`, `@domain`, `@data`, `@tools`, `@resources`, `@prompts`: se declaran en `tsconfig.json` **y** en `vitest.config.ts`.
- stdout es el canal del protocolo en stdio: todo log va a stderr (pino). Prohibido `console.log`.
- Constantes nombradas en `constants.ts` de su dominio; nada de cadenas mágicas.
- El token (`MCP_AUTH_TOKEN`) y la clave de servicio (`SUPABASE_SERVICE_KEY`) nunca se loguean ni se escriben en el repo ni en `.claude/settings.json`.
- La versión de pnpm (major 10) está en `Dockerfile` y en `.github/workflows/ci.yml`: si una cambia, cambia la otra.
- **Migraciones: permisos explícitos, nunca los de por defecto.** Probando contra la imagen oficial de Supabase Postgres, ni `service_role` podía leer las vistas creadas por `postgres`. Cada migración declara qué puede cada rol (`anon`/`authenticated` nada; `service_role` sin DELETE ni TRUNCATE) y se prueba con `scripts/test-integracion.sh`. Las vistas llevan `security_invoker = true`.
- **Un doble de prueba solo vale si pasa el mismo contrato que el real.** `src/data/__tests__/contrato.ts` corre contra el repositorio en memoria y contra Supabase (PostgREST real): si divergen, una de las dos falla.
- **El contrato con sens-lab se prueba con su código real:** `scripts/verificar-con-sens-lab.sh` (sale 1 si algo se rompe y 2 si no encuentra sens-lab: en ese caso no verificó nada). Tras cambiar el formato hay que pasarlo; la tabla de `docs/formato/ladder-lab.estampa.v1.md` debe coincidir con el esquema o falla una prueba.
- Con pnpm 12 local, `pnpm-workspace.yaml` fija `esbuild: false` (política de builds); el CI usa pnpm 10 e ignora ese archivo.

## Reglas de trabajo

- **Sin commits ni push salvo que Freddy los ordene** (el 2026-11-05 ordenó commit y push al cerrar cada fase). **Nada de firmas de IA** en commits, PR ni archivos.
- Sin credenciales reales en el repo, en pruebas ni en ejemplos. `.env.example` solo lleva placeholders.
- No ejecutar migraciones ni instaladores sin confirmación. Aplicar una migración a Supabase lo hace Freddy.
- No desplegar sin orden explícita.
