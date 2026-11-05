# DECISION: Un documento jsonb por versión, con columnas generadas solo para filtrar

**Base real desde el 2026-11-05:** Neon, no Supabase (`DECISION_BASE_NEON.md`). El modelo no cambia.

Fecha: 2026-11-05 (tarea 1.3 de FASE_1). Migración: `supabase/migrations/20261105120000_crear_estampas.sql`.

## Qué dice el concepto

Estampas versionadas que nunca se borran (corregir crea una versión nueva y conserva la anterior; se archiva, no se elimina), con JSON versionado como único vínculo con el convertidor, y «SQL e índices» en la practice-wishlist.

## Opciones

- **A. Una columna tipada por campo**, con una columna de estado por campo para `desconocido` / `no_aplica`.
- **B. Un documento `jsonb` por versión**, validado por Zod en la aplicación, con columnas **generadas** solo para lo que se filtra u ordena.

## Decisión: B

- Los valores especiales (`450` o `"desconocido"` o `"no_aplica"` en el mismo campo) no se tipan bien por columna: A obligaba a duplicar cada campo en valor y estado.
- El documento guardado **es** el formato exportado: `exportar` casi no transforma nada y el JSON es la fuente de verdad (SSOT). Las columnas generadas (`juego`, `genero`, `certeza`, `rango`, `fecha`, `match_perfecto`) no se escriben nunca a mano: la base lo impide.
- El costo de B es una validación más débil en la base (solo exige juego, género, certeza y rango) y más fuerte en la aplicación (Zod valida todo al escribir **y** al leer). Una fila escrita por SQL a mano que no cumpla el esquema hace fallar la lectura con un error que nombra la fila.

## Estructura

- `estampas` (identidad estable): `id`, `creada_en`, `archivada_en`. Sin `juego` ni `género`: pueden corregirse y viven en la versión (si estuvieran en las dos tablas serían dos fuentes de verdad).
- `estampa_versiones`: `(estampa_id, numero_version)` único, `version_formato` (versión del formato con la que se escribió, para migrar si hay una v2), `datos` y las columnas generadas.
- **`derivadaDe` vive en el documento**, no en una columna con clave foránea (una columna generada no puede llevarla con seguridad). Se valida con un trigger al insertar una versión: debe ser un uuid de una estampa existente y distinto de la propia estampa. Los ciclos largos no se validan en v1.
- Vistas `estampas_historial` (todas las versiones, con `total_versiones` y `archivada`) y `estampas_vigentes` (solo la última). **`security_invoker = true`**: sin esa opción una vista corre con los permisos de su dueño y expondría los datos a la clave anónima.

## «Nada se borra», dentro de la base

Triggers que rechazan con el código `LL010`: `UPDATE`/`DELETE`/`TRUNCATE` sobre `estampa_versiones`, `DELETE`/`TRUNCATE` sobre `estampas`, y cualquier `UPDATE` de `estampas` que toque algo distinto de `archivada_en`. Además `service_role` **no tiene** permiso de `DELETE` ni `TRUNCATE`. Un superusuario puede quitar los triggers: esto protege de accidentes y de bugs de la aplicación, no de quien administra la base.

## Escritura atómica

`supabase-js` no abre transacciones de varias sentencias. `crear_estampa` y `corregir_estampa` son funciones SQL: crear inserta la identidad y la versión 1 juntas, y corregir bloquea la estampa, comprueba que la **versión base** siga siendo la vigente (`LL002` si no) e inserta la siguiente. Así nunca queda una estampa sin versión ni dos versiones con el mismo número, y dos correcciones simultáneas no se pisan.

Códigos propios: `LL001` no existe, `LL002` conflicto de versión, `LL003` `derivadaDe` inválido, `LL010` modificación prohibida.

## Seguridad

RLS activado y **sin políticas**. Los permisos se declaran explícitos en la migración (no se depende de los privilegios por defecto de cada entorno): `anon` y `authenticated` sin acceso a nada; `service_role` con lo mínimo para leer, insertar y archivar. Probado contra la imagen oficial de Supabase Postgres (`anon` y `service_role` reales). Hallazgo de esa prueba: en esa imagen, sin permisos explícitos ni siquiera `service_role` podía leer las vistas.

## Índices

Solo `estampa_versiones (juego)`. Los de F2 se deciden con mediciones (`DECISION_INDICES_F2.md`).

## Plan gratuito de Supabase: lo que importa para «no perder»

Fuentes oficiales consultadas el 2026-11-05 ([pausa por inactividad](https://supabase.com/kb/faqs/platform/free-project-pausing), [lista de producción](https://supabase.com/docs/guides/deployment/going-into-prod)):

- Un proyecto gratuito con poca actividad durante una semana **se pausa**; los datos se conservan y se puede restaurar, pero la ventana de restauración depende de la fuente (90 días según el registro de cambios; otra guía habla de un año): **verificar la vigente antes de confiar en ella**.
- El plan gratuito **no incluye copias de seguridad descargables**. Los planes de pago incluyen copias diarias.
- Conclusión de diseño: **el respaldo propio es la única red de seguridad** (FASE_3, `DECISION_RESPALDO.md`). Además, el respaldo programado consulta la base a diario, lo que cuenta como actividad y evita la pausa.
