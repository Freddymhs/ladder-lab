# DECISION: la base vive en Neon, con PostgREST propio en el Mac Mini

**Fecha:** 2026-11-05 · **Alcance:** ladder-lab y sens-lab

Reemplaza a «proyecto Supabase propio en la nube» del concepto y de `DECISION_MODELO_DATOS.md`. El código no cambia: sigue usando `supabase-js`.

## Por qué

Supabase rechazó crear el proyecto: el plan gratis admite 2 proyectos activos y ya estaban `agriplan` y `sleep-reset`, ambos en uso. Freddy no quiere apagar nada de lo que funciona («no quiero matar nada») y pidió una alternativa en la nube («Neon SQL o alguna cosa… respaldado en la nube»).

## Qué se decidió

- **Neon, plan gratis, proyecto `lab`, región `aws-sa-east-1`, PostgreSQL 18.** Una sola base con `public` (ladder-lab) y `sens_lab` (sens-lab).
- **API en el Mac Mini:** `postgrest` más un `nginx` que traduce `/rest/v1/`, porque `supabase-js` llama a esa ruta y PostgREST sirve en la raíz. Definido en `deploy/docker-compose.yml`.
- **Conexión directa, no el pooler:** PostgREST necesita cambiar de rol y el pooler de Neon va en modo transacción.
- **Sin LISTEN y con conexiones que se cierran a los 30 s** (`PGRST_DB_CHANNEL_ENABLED=false`, `PGRST_DB_POOL_MAX_IDLETIME=30`). Sin esto Neon no se duerme y se agotan las 100 CU-horas mensuales del plan. Costo: tras migrar hay que reiniciar `lab-rest`.
- **La clave de servidor es un JWT propio** con rol `service_role`, firmado por `deploy/generar-entornos.py`. Roles creados a mano, porque Neon no trae los de Supabase (ver el runbook).

## Qué no sirve y por qué

- **Neon Data API:** exige JWT validado por una JWKS y no acepta una clave de servidor.
- **Pooler de Neon para PostgREST:** su documentación desaconseja el pooler externo y pierde LISTEN.

## Medido el 2026-11-05 en un proyecto desechable, ya borrado

| qué                                      | resultado                                             |
| ---------------------------------------- | ----------------------------------------------------- |
| Roles `NOINHERIT`, `BYPASSRLS` y `GRANT` | aceptados por el dueño del proyecto                   |
| Las 4 migraciones                        | aplicadas sin cambios                                 |
| Inmutabilidad con filas reales           | `DELETE` y `UPDATE` rechazados                        |
| Neon se duerme con la pila arriba        | sí, `idle` a los ~5,5 minutos                         |
| Despertar                                | primera consulta 2,2 s, siguiente 0,6 s               |
| Restaurar `pg_dump` en base nueva        | hash de versiones idéntico                            |
| Restaurar respaldo JSON en base nueva    | hash de versiones idéntico                            |
| Memoria de la pila                       | ~217 MB, sin el Postgres que habría corrido en el Mac |

## Riesgos

- **100 CU-horas al mes:** si se agotan, Neon suspende hasta el mes siguiente sin perder datos. Depende de que la pila no mantenga viva la base: los monitores de Kuma pegan a rutas que no consultan.
- **Historial de 6 horas:** no reemplaza al respaldo propio (`DECISION_RESPALDO.md`).
- **Una sola clave** abre ambos esquemas, igual que la decisión anterior (`DECISION_INTEGRACION_CONVERTIDOR.md`).

## Qué NO decide este ADR

- **Cómo se despliega:** es `DECISION_DEPLOY.md`.
- **Qué pasa con el Mac Mini:** la clave de servidor y el token viven ahí por decisión de Freddy; su reinstalación pendiente sigue abierta. Los datos no dependen del Mac.
