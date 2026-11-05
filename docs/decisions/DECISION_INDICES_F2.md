# DECISION: No se crean índices nuevos para F2

Fecha: 2026-11-05 (tarea 2.6 de FASE_2)
**Medido con datos sintéticos, no con datos reales** (la compuerta de F2 se levantó sin ellos: `DECISION_COMPUERTA_F2.md`). El número vale como orden de magnitud, no como medición del uso real.

## Cómo se midió

`scripts/medir-indices.sh`: Postgres de Supabase desechable, **20 000 estampas y 26 000 versiones** (40 juegos, ~30 % con segunda versión, ~10 % match perfecto, 5 % archivadas), `EXPLAIN (ANALYZE)` de las consultas que generan las herramientas. Repetible con otro tamaño (`scripts/medir-indices.sh 100000`) o contra una copia de datos reales (`MEDIR_URL`, nunca producción).

## Resultado (Execution Time)

| Consulta                                  | Tiempo |
| ----------------------------------------- | ------ |
| `ver_estampa` (por id, vigente)           | 0,2 ms |
| `historial_versiones` (por id)            | 0,4 ms |
| `matches_perfectos` (limit 51)            | 47 ms  |
| `mejor_por_juego` (juego + match)         | 49 ms  |
| `listar_estampas` sin filtros             | 51 ms  |
| `listar_estampas` por género              | 49 ms  |
| `listar_estampas` por juego (`ilike`)     | 75 ms  |
| `exportar`, primera página (500)          | 46 ms  |
| `exportar`, página lejana (offset 15 000) | 82 ms  |

## Decisión: no se agrega ningún índice

- **Las lecturas por id son instantáneas** (clave primaria): ver e historial no necesitan nada.
- **Los listados cuestan 50–80 ms con 20 000 estampas**, y ese costo **no viene de falta de índice**: la vista `estampas_vigentes` calcula `count(*) over (partition by estampa_id)` para saber cuál es la última versión, y esa ventana recorre todas las versiones antes de poder filtrar. Un índice por `juego` o `match_perfecto` no evita ese recorrido, así que no cambiaría nada: lo que mide el listado es el tamaño total de la tabla.
- **El volumen esperado es de cientos de estampas**, no decenas de miles: a esa escala el mismo plan es de un dígito en milisegundos.
- **Sin datos reales no se justifica un índice.** Un índice que no cambia nada solo cuesta escritura y espacio (regla de la tarea 2.6).

## Hallazgos que quedan anotados

- El índice `estampa_versiones_juego_idx` (F1) **no lo usan** las consultas por juego: las herramientas filtran con `ilike` (sin distinguir mayúsculas), que un índice btree común no puede usar. Se deja hasta tener datos reales; quitarlo es trivial.
- **Si el volumen real crece** hasta que el listado moleste (del orden de decenas de miles de estampas), la corrección es **redefinir la vista** para obtener la última versión con `max(numero_version)` por estampa en lugar de la función de ventana, y recién ahí evaluar un índice en `lower(juego)`. Se verifica con `scripts/medir-indices.sh` antes y después.

## Qué queda abierto

- Repetir la medición con las 10 estampas reales y con el uso real de Freddy.
