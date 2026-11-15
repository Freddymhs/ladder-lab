# FASE 7: ESTAMPA ACTIVA POR JUEGO

**Destraba**: que `/gameconfig:run-rts` y `/gameconfig:run-fps` lean como fuente de verdad la configuración que Freddy usa hoy en cada juego, sin deducirla de «la versión más nueva» ni del match perfecto.
**Prioridad**: Alta
**Dependencias**: FASE_1 y FASE_6. Agrega una tabla y una migración; no cambia el formato JSON (`version: 1`).
**Estado**: HECHA el 2026-11-14 (6/6) en los commits `6dea00f` y `f65dfc0`. Migración `supabase/migrations/20261114120000_estampa_activa.sql` aplicada a la base de producción y MCP desplegado en el Mac Mini el mismo día (`listar_estampas` en vivo devuelve `activa`/`versionActiva`). Pendientes abajo.
**Origen**: Freddy, 2026-11-14: cada juego debe tener una estampa activa que él elige.

> Diseño y garantías: sección «Estampa activa» de [`DECISION_MODELO_DATOS.md`](../decisions/DECISION_MODELO_DATOS.md).
> La activa es una **elección de uso** (una por juego, fijada a una versión concreta); el match perfecto es una **marca de calidad** dentro del documento. Nunca se deduce una de la otra.

## Cómo se usa

- **Marcar:** `marcar_activa` con el id (y opcionalmente `numeroVersion`; sin ella se fija la última). Reemplaza a la activa del mismo juego y devuelve la anterior.
- **Leer:** `activa_por_juego` con el nombre del juego. Si no existe, sugiere los parecidos («Starcraft 2» propone «StarCraft II»).
- **Al crear o corregir:** `crear_estampa` y `corregir_estampa` aceptan `marcarActiva`; sus descripciones piden preguntarle a Freddy antes de enviarlo.

## Orden de ejecución

1. 7.1 tabla, vistas y migración → 2. 7.2 RPC atómica → 3. 7.3 repositorio (memoria y Supabase) → 4. 7.4 herramientas nuevas → 5. 7.5 `marcarActiva` en crear/corregir → 6. 7.6 listados con marca, fecha y etiqueta

## Tareas

### Tarea 7.1: Tabla, vistas y migración — HECHA

`supabase/migrations/20261114120000_estampa_activa.sql`: `estampas_activas` (una fila por juego, índice único sobre `lower(juego)`, clave foránea a la versión), vistas `estampas_activas_detalle` y `juegos_registrados` con `security_invoker = true`, trigger que exige en la base que la versión exista, que su estampa no esté archivada y que el juego sea el de esa versión (`LL006`, `LL005`, `LL007`). `service_role` con `SELECT`, `INSERT` y `UPDATE`; sin `DELETE` ni `TRUNCATE`. Archivar la activa deja el juego sin activa sin borrar nada.

### Tarea 7.2: RPC `marcar_estampa_activa` — HECHA

Atómica: reemplaza la fila del juego y devuelve la activa anterior.

### Tarea 7.3: Repositorio — HECHA

`EstampaRepository.marcarActiva` / `activas` en memoria y en Supabase; el contrato compartido (`src/data/__tests__/contrato.ts`) corre contra los dos, y `sql-estampa-activa.int.spec.ts` contra Postgres real.

### Tarea 7.4: Herramientas `marcar_activa` y `activa_por_juego` — HECHA

`src/tools/marcar-activa.tool.ts` y `src/tools/activa-por-juego.tool.ts`. El nombre del juego se compara sin mayúsculas ni espacios en los extremos y, si no existe, sugiere parecidos con `juegos_registrados` (`src/domain/estampa/juegos.ts`).

### Tarea 7.5: `marcarActiva` en `crear_estampa` y `corregir_estampa` — HECHA

Corregir crea la versión N+1 pero la activa sigue en N hasta que se marque otra (aviso en la respuesta); `marcarActiva=true` fija la nueva.

### Tarea 7.6: Listados con marca de activa — HECHA

`listar_estampas`, `mejor_por_juego` y `matches_perfectos` traen fecha (la del juego o, sin ella, la del registro), versión, la marca de activa y una etiqueta para armar un selector (`f65dfc0`: la etiqueta omite el rango desconocido).

## Pendientes

Lo abierto al cerrar la fase. Un punto se cierra solo cuando Freddy lo dice.

1. **(a) HECHO (2026-11-15, migración aplicada a producción): renombrar el juego dejaba la misma estampa activa en dos juegos.** Pasos del bug: `corregir_estampa` cambia `juego.nombre`; luego `marcar_activa` de la versión nueva dejaba la fila del nombre viejo apuntando a la misma estampa, y `indiceDeActivas` (`src/tools/activa.ts:21`) se quedaba con la última. **Decisión (Freddy):** una estampa es activa en un solo juego, el suyo actual. `marcar_estampa_activa` borra, en la misma transacción y antes del upsert, las filas con esa `estampa_id` y otro `lower(juego)` (`supabase/migrations/20261115120000_activa_un_juego_por_estampa.sql`). Se descartó conceder `DELETE` a `service_role`: la función pasa a `security definer` (con `search_path` fijado y `execute` solo para `service_role`), así `service_role` sigue sin poder borrar a mano. El repositorio en memoria aplica la misma regla. Pruebas, rojo primero: contrato compartido (`contrato.ts`, «renombrar el juego y marcar…»), SQL (`sql-estampa-activa.int.spec.ts`, dos casos, uno como `service_role`; sin `security definer` el segundo falla). La firma de la RPC no cambia, así que PostgREST no necesita recargar el esquema; reiniciar `lab-rest` según el runbook es inocuo.
2. **(b) El respaldo JSON no lleva las activas.** `exportar` y `pnpm respaldo` no incluyen la elección (`DECISION_MODELO_DATOS.md:49`); `pg_dump` sí. Restaurar un respaldo JSON deja todos los juegos sin activa.
3. **(c) Crear/corregir + `marcarActiva` no son atómicos.** Si el marcado falla después de crear o corregir, hoy la herramienta responde error aunque la estampa ya se guardó (`src/tools/crear-estampa.tool.ts:60`, `src/tools/corregir-estampa.tool.ts:89`). Debe responder «creada (o corregida), pero no se pudo marcar» con el id.
4. **(d) `GENEROS = [FPS, RTS]`** (`src/domain/estampa/constants.ts:6`). MOBA y ARPG se registran con el género del comando (decisión, anotada en `gameconfig/corazon.md`). Agregar un género exige `version: 2` del formato.
5. **(e) Falta volver al «antes».** No hay paso ni herramienta para restaurar la configuración anterior; `gameconfig` lo hace a mano.

## Resultados de la ejecución (2026-11-14)

Esquema, repositorio (doble y PostgREST real), SQL real y herramientas con pruebas propias (ver commits `6dea00f` y `f65dfc0`). Después de cerrar la fase, `juego.nombre` pasó a recortar espacios en los bordes (`«StarCraft II »` ya no se escapa de `activa_por_juego`): 618 → 622 pruebas, rojo primero (4 fallos) y luego verde. `/gameconfig:run-rts` leyendo la activa contra el servidor real: **pendiente** (aún no se corrió con una estampa activa marcada).
