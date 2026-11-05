# FASE 2: CONCLUSIONES

**Prioridad**: Media
**Dependencias**: FASE_1 **en uso con 10 estampas reales** (decidido 2026-11-05) y **FASE_3 hecha antes** (decidido 2026-11-05: primero se protegen los datos, después se sacan conclusiones)
**Origen**: concepto, F2 ("obtener conclusiones"): `comparar_estampas`, `mejor_por_juego`, `matches_perfectos`, `historial_versiones`.

> **BLOQUEADA** hasta que Freddy confirme por escrito que tiene 10 estampas reales y F3 esté hecha. Riesgo del concepto: «Sobrediseño: comparaciones antes de tener datos».
> Las tareas de abajo son deliberadamente cortas: el detalle (forma de la salida, qué diferencias importan) se decide mirando datos reales, no antes. No ampliar ahora.

## Orden de ejecución

1. Tarea 2.1 — `historial_versiones` (solo lee lo que F1 ya guarda; la más barata)
2. Tarea 2.2 — `comparar_estampas`
3. Tarea 2.3 — ADR de «mejor» y del solapamiento con `matches_perfectos` (prerrequisito de 2.4 y 2.5)
4. Tarea 2.4 — `mejor_por_juego` (sobre 2.3)
5. Tarea 2.5 — `matches_perfectos` (sobre 2.3)
6. Tarea 2.6 — índices según consultas reales (al final: se mide con las herramientas ya usadas)

## Tareas

### Tarea 2.1: Herramienta `historial_versiones`

- Archivo: `src/tools/historial-versiones.tool.ts` (crear) y su spec; `src/tools/index.ts` (modificar)
- Que hacer: dado el id de una estampa, devuelve todas sus versiones en orden, indicando qué campos cambiaron entre una y la siguiente. Solo lectura. No recomienda ni juzga cuál versión es mejor.
- Referencia: `src/tools/ver-estampa.tool.ts` (F1).

### Tarea 2.2: Herramienta `comparar_estampas`

- Archivo: `src/tools/comparar-estampas.tool.ts` (crear) y su spec; `src/tools/index.ts` (modificar)
- Que hacer: dadas dos o más estampas, devuelve las diferencias campo por campo (sistema, en el juego, resultado). Describe diferencias, **no dice cuál configuración es mejor** («Qué no es», concepto). Tratar `desconocido`/`no_aplica` como «sin dato», no como una diferencia real.
- Referencia: `src/domain/estampa/schema.ts` (F1).

### Tarea 2.3: ADR de «mejor» y del solapamiento con `matches_perfectos`

- Archivo: `docs/decisions/DECISION_MEJOR_POR_JUEGO.md` (crear)
- Que hacer: decidido el 2026-11-05: `mejor_por_juego` **no juzga causa** y devuelve las estampas **marcadas como match perfecto** del juego, con el `rango` como **texto**. **No hay orden de rangos en v1**, así que no se crea catálogo ni se compara un rango con otro. Dejar por escrito dos consecuencias:
  1. «Mejor» no es un ranking: si ninguna estampa del juego está marcada como match perfecto, la respuesta es explícita («ninguna marcada»), no un error ni una elección arbitraria.
  2. Solapamiento: así definido, `mejor_por_juego` es `matches_perfectos` filtrado por un juego. Decidir con los datos reales si siguen siendo dos herramientas (por claridad para el LLM) o una con filtro opcional (por DRY), y registrar la razón. No inventar un criterio de ranking para diferenciarlas.
- Referencia: `../_CONCEPTO.md` (Qué no es / Fases) y `DECISION_FORMATO_ESTAMPA_V1.md` (campo `matchPerfecto`).

### Tarea 2.4: Herramienta `mejor_por_juego`

- Archivo: `src/tools/mejor-por-juego.tool.ts` (crear) y su spec; `src/tools/index.ts` (modificar)
- Que hacer: según 2.3, devuelve las estampas del juego marcadas como match perfecto, mostrando `rango` como texto y la `certeza` a la vista (una `estimado` no pesa igual que una `medido`: se muestra, no se oculta). Juego sin estampas o sin ninguna marcada: respuesta explícita.

### Tarea 2.5: Herramienta `matches_perfectos`

- Archivo: `src/tools/matches-perfectos.tool.ts` (crear) y su spec; `src/tools/index.ts` (modificar)
- Que hacer: lista las estampas marcadas con match perfecto, con su configuración, de todos los juegos o filtradas. Si 2.3 decide unir esta herramienta con `mejor_por_juego`, esta tarea se convierte en la herramienta única y 2.4 se cierra como «absorbida».

### Tarea 2.6: Índices según consultas reales

- Archivo: `supabase/migrations/<timestamp>_indices_f2.sql` (crear), `docs/decisions/DECISION_INDICES_F2.md` (crear)
- Que hacer: con datos reales y las herramientas de F2 en uso, medir las consultas (`EXPLAIN ANALYZE`) y crear solo los índices que cambien algo. Si con el volumen real no cambian nada, documentar «no se necesitó» y cerrar. Aplicar la migración lo hace Freddy.
- Referencia: `docs/decisions/DECISION_MODELO_DATOS.md` (F1).

## Criterios de Aceptacion

- [ ] Freddy confirmó por escrito las 10 estampas reales y F3 está hecha antes de empezar.
- [ ] Las 4 herramientas existen con tests y solo leen datos (anotaciones de solo lectura).
- [ ] Ninguna herramienta de F2 emite un juicio de «esta configuración es mejor» ni compara rangos entre sí; el criterio de `mejor_por_juego` está en el ADR.
- [ ] `desconocido`/`no_aplica` no se cuentan como diferencias ni como valores comparables.
- [ ] Los índices nuevos (si hubo) están justificados con una medición.
- [ ] `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` pasan.
