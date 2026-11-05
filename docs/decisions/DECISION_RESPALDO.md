# DECISION: Respaldo propio en JSON, verificado, con destino fuera del Mac Mini y de Supabase

Fecha: 2026-11-05 (tareas 3.2, 3.3 y 3.4 de FASE_3)

## Qué dice el concepto

«Son horas de juego convertidas en datos: no se pueden perder.» Riesgo declarado: dependencia de Supabase, mitigada con `exportar` desde F1. F3 agrega respaldo programado e importar desde JSON.

## Por qué el respaldo propio es obligatorio

El plan gratuito de Supabase **no ofrece copias descargables** y **pausa** el proyecto tras una semana con poca actividad (fuentes en `DECISION_MODELO_DATOS.md`). El respaldo propio es la única red de seguridad real, y como consulta la base a diario, cuenta además como actividad.

## Qué se respalda

El mismo envoltorio de `exportar` con `incluirVersiones`: **todas las versiones de todas las estampas, archivadas incluidas**, con `id` y `numeroVersion`. Un solo formato para exportar, respaldar y restaurar (SSOT). Comando: `pnpm respaldo` (`node dist/respaldo.js`).

## Cómo se hace el respaldo

1. Se lee todo con paginación (la API limita las filas por respuesta).
2. Se escribe a un archivo temporal y se **relee y verifica**: JSON completo, formato y versión conocidos, esquema válido, versiones consecutivas, y mismo número de versiones que las leídas de la base. Solo entonces se renombra al nombre definitivo (`ladder-lab-AAAAMMDDTHHMMSSZ.json`). Nunca queda un respaldo a medias con el nombre de uno bueno.
3. Se imprime siempre el **denominador**: estampas, versiones, bytes, sha256 y qué respaldos viejos se eliminaron.
4. **Retención**: se conservan los `RESPALDO_RETENCION` más nuevos (30 por defecto, mínimo 1). Solo se tocan archivos con el patrón de nombre de un respaldo.
5. **Alarma de regresión**: como nada se borra, el número de estampas y de versiones **nunca debe bajar**. Si el respaldo nuevo trae menos que el anterior (o el anterior no se puede verificar), el comando termina con código **2**, conserva el archivo nuevo y **no poda ningún respaldo viejo**: no se reemplazan buenos respaldos por uno peor.

Códigos de salida, para que el cron avise: `0` bien · `1` falló · `2` hecho pero con alerta.

## Dónde se guarda

`RESPALDO_DIR` en el host que ejecuta el comando. **Eso no basta**: un respaldo en el mismo Mac Mini que el servidor sobrevive a la pausa de Supabase pero no a una falla del Mac. El runbook (`PUESTA_EN_MARCHA.md`, sección 9) copia la carpeta a otro lugar con `rsync` o `rclone`. **El destino externo y sus credenciales los define Freddy**; el repo no los fija ni los guarda.

## Restaurar

`pnpm restaurar <respaldo>` **simula** por defecto (verifica el respaldo y dice qué entraría); con `--aplicar` restaura. Es la misma lógica que la herramienta `importar_json`, sin pasar el JSON por el chat, que no es práctico para un respaldo grande.

- **Un respaldo roto falla antes de tocar la base.**
- **Todo o nada**: la importación es una sola función SQL transaccional; si algo falla no entra nada.
- **Nunca pisa**: un `id` que ya existe se omite (las versiones son inmutables). Restaurar dos veces es idempotente.
- La **simulación ejecuta todas las comprobaciones reales** y deshace al final: no puede aprobar algo que la real rechazaría.
- Restaurar en una base nueva exige antes aplicar las migraciones (`PUESTA_EN_MARCHA.md`, sección 2).

## Límites conocidos

- **Los instantes originales no se conservan.** La exportación no lleva `creada_en` de la estampa ni de cada versión, así que una restauración les pone la hora de la restauración. El **orden** de las versiones y todos los **datos** sí se conservan. Si Freddy necesita los instantes, es un cambio de formato (nuevo campo opcional) y se decide con F4.
- Una exportación **sin** `incluirVersiones` restaura cada estampa como versión 1 (pierde la numeración). Para respaldar siempre se usa `incluirVersiones`.
- La importación es **una sola llamada** a la base: con un volumen muy grande podría topar con límites de tamaño de la API. Para el volumen esperado (cientos de estampas) no se espera problema; sin datos reales es un supuesto.
- No hay herramienta para **desarchivar**: el concepto solo nombra «archivar». Si hace falta, se agrega con su propia migración.
- El respaldo complementario a nivel de base (`pg_dump`) exige la cadena de conexión directa, que es otra credencial; no se incluye.

## Probado

Restauración real en una base vacía (Postgres de Supabase, función SQL real) con resultado idéntico dato por dato; respaldo truncado, vacío, de otro formato o con una versión faltante falla; el comando de verificación probado dentro de la imagen Docker (bueno → 0, roto → 1). **No probado** contra un proyecto Supabase real ni con una carpeta externa real (exige credenciales).

## Qué queda abierto

- Elegir el destino externo y programar la tarea (Freddy, runbook sección 9).
- Si se necesitan los instantes originales en la exportación.
