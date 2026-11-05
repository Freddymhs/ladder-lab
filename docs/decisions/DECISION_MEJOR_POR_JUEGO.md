# DECISION: «Mejor por juego» = estampas marcadas como match perfecto, sin juicio ni orden de rangos

Fecha: 2026-11-05 (tarea 2.3 de FASE_2)

## Qué dice el concepto

F2 incluye `mejor_por_juego`, pero «Qué no es» dice que el sistema **no recomienda ni juzga** cuál configuración es mejor. Las dos frases chocan salvo que «mejor» no sea un juicio del sistema.

## Decisión (dada por Freddy el 2026-11-05)

`mejor_por_juego` **no juzga causa**: devuelve las estampas del juego **marcadas como match perfecto**, con el `rango` **como texto** y su `certeza` a la vista. **No hay orden de rangos en v1**: no se crea catálogo y nunca se compara un rango con otro. «Mejor» significa solo «el usuario la marcó como match perfecto».

Consecuencias:

- Si el juego tiene estampas pero ninguna está marcada, la respuesta lo dice (`Ninguna estampa de "X" está marcada como match perfecto.`); si no tiene ninguna, dice otra cosa (`No hay estampas de "X".`). Ninguna de las dos es un error ni una elección arbitraria.
- Una `certeza` `estimado` no se oculta ni se pondera: se muestra tal cual.
- El `criterio` va dentro de la propia respuesta, para que el LLM que la lee no la presente como un ranking.

## El solapamiento con `matches_perfectos`

Así definido, `mejor_por_juego` es `matches_perfectos` filtrado por un juego. El backlog pedía decidir con datos reales si siguen siendo dos herramientas o una; **sin datos reales se decidió así, y se puede revisar**:

- **Una sola implementación** (`src/tools/matches.ts`, `buscarMatchesPerfectos` y `presentarMatch`), usada por las dos. Un test comprueba que devuelven las mismas estampas para el mismo juego. No hay lógica duplicada (DRY).
- **Dos nombres de herramienta**, por claridad para el LLM: «¿cuál es lo mejor que tengo en X?» no se confunde con «lista todos mis matches perfectos». Cuesta una descripción más, no código.
- Se descartó inventar un criterio de ranking para diferenciarlas: sería exactamente el juicio que el concepto prohíbe.

## Qué queda abierto

- Con las 10 estampas reales (`DECISION_COMPUERTA_F2.md`), revisar si dos nombres siguen valiendo la pena o conviene una sola herramienta con un parámetro de juego opcional.
