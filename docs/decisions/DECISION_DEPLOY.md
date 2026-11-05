# DECISION: Despliegue en el Mac Mini como `hylian-mcp` — SUPUESTO, NO EJECUTADO

Fecha: 2026-11-05 (tarea 1.11 de FASE_1)
**Estado: propuesta sin confirmar. No se desplegó nada.** Todo lo que sigue está escrito, pero ningún comando de este documento se ejecutó contra el Mac Mini ni contra una cuenta de Supabase, GitHub u otro servicio.

## Qué dice el concepto

«Se desarrolla en el ThinkPad, se despliega en el Mac Mini y se usa desde Claude Code del PC de juegos.» Transporte Streamable HTTP, acceso solo por Tailscale y con token. Proyecto Supabase propio en la nube, con credenciales propias, sin compartir con otros sistemas del Mac (incidente de seguridad pendiente).

## Supuesto (como `hylian-mcp`)

`hylian-mcp` despliega por push: un workflow que corre solo si el CI pasó, en el runner self-hosted del Mac Mini, y deja la imagen Docker ahí (`hylian-mcp/docs/decisions/DECISION_DEPLOY_MAC_MINI.md`). Se propone lo mismo para ladder-lab, con estas definiciones (las que la tarea 1.11 debía fijar):

| Pieza       | Propuesta                                                                                                                                             | Estado                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Repositorio | `fmarcos-labs/ladder-lab` (la misma organización que `hylian-mcp`, porque es donde vive el runner)                                                    | **sin confirmar**; el repo local no tiene remoto |
| Runner      | el self-hosted de esa organización, en el Mac Mini                                                                                                    | sin confirmar                                    |
| Imagen      | `ladder-lab:local`                                                                                                                                    | propuesta                                        |
| Contenedor  | `ladder-lab`, `--restart unless-stopped`                                                                                                              | propuesta                                        |
| Puerto      | `-p <ip-tailscale>:3000:3000` (nunca `0.0.0.0` en el host)                                                                                            | propuesta                                        |
| Entorno     | archivo en el Mac, fuera del repo y del build, `chmod 600`                                                                                            | propuesta                                        |
| Workflow    | borrador en `docs/runbooks/deploy.workflow.example.yml`, **fuera de `.github/`** a propósito: un `deploy.yml` activo se dispararía con el primer push | borrador                                         |

## Diferencia con `hylian-mcp`

`hylian-mcp` se usa por stdio con `ssh mac-mini docker run …`. ladder-lab corre como un contenedor **permanente** por HTTP con token. Eso añade tres riesgos que `hylian-mcp` no tiene: un puerto escuchando, un token que custodiar y un proceso que debe reiniciarse solo.

## Lo que ya está hecho y verificado en local

- Imagen sin root, solo dependencias de producción, `HEALTHCHECK` contra `/healthz` y `.dockerignore` (F0; política cubierta por `src/__tests__/docker.spec.ts`).
- `MCP_HOST=0.0.0.0` solo dentro del contenedor: el aislamiento real es publicar el puerto en la IP de Tailscale.

## Lo que exige credenciales y por lo tanto queda como runbook

Crear el proyecto Supabase, aplicar la migración, generar el token, escribir el archivo de entorno, desplegar y registrar el servidor en Claude Code: `docs/runbooks/PUESTA_EN_MARCHA.md`, paso a paso y con la comprobación que debe poder fallar.

## Qué queda abierto

- Confirmar organización, repositorio y runner.
- Que el workflow de despliegue exista como `.github/workflows/deploy.yml` solo cuando Freddy lo ordene.
