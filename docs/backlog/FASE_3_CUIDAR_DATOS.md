# FASE 3: CUIDAR LOS DATOS

**Prioridad**: Alta en cuanto existan datos reales (protege lo que F1 empezó a guardar)
**Dependencias**: FASE_1 desplegada. **Va antes que F2** (decidido 2026-11-05).
**Origen**: concepto, F3: archivar, respaldo programado e importar desde JSON.

> El concepto no ordena F3 respecto de F2. Freddy decidió el 2026-11-05 hacer F3 **antes** que F2: el respaldo protege horas de juego convertidas en datos («no se pueden perder»).

## Orden de ejecución

1. Tarea 3.1 — `archivar_estampa` (independiente)
2. Tarea 3.2 — respaldo programado (independiente de 3.1)
3. Tarea 3.3 — `importar_json` (usa el formato congelado de F1)
4. Tarea 3.4 — prueba de restauración (cierra el ciclo: depende de 3.2 y 3.3)

## Tareas

### Tarea 3.1: Herramienta `archivar_estampa`

- Archivo: `src/tools/archivar-estampa.tool.ts` (crear) y su spec; `src/tools/index.ts`, `src/tools/listar-estampas.tool.ts`, `src/tools/ver-estampa.tool.ts` (modificar)
- Archivo: `supabase/migrations/<timestamp>_archivar_estampa.sql` (crear) si hace falta una RPC o ajuste (la columna `archivada` ya existe desde F1, tarea 1.3).
- Que hacer: archivar marca la estampa; **no borra** (concepto: «Ninguna estampa se borra de verdad»). `listar_estampas` oculta las archivadas por defecto y puede incluirlas con un parámetro; `ver_estampa` indica si está archivada. Decidir si hace falta desarchivar; el concepto solo nombra «archivar» (anotar en un ADR; no agregarlo sin pedirlo). Los triggers de F1 siguen impidiendo `DELETE`.
- Referencia: `docs/decisions/DECISION_MODELO_DATOS.md` (F1).

### Tarea 3.2: Respaldo programado

- Archivo: `docs/decisions/DECISION_RESPALDO.md` (crear), script/tarea programada (ubicación a decidir en el ADR), `README.md` (modificar)
- Que hacer: definir en el ADR qué se respalda (volcado de la base y/o `exportar` completo con versiones), con qué frecuencia, dónde se guarda **fuera del Mac Mini y de la cuenta de Supabase** (si no, un solo fallo se lleva datos y respaldo) y cuánto se conserva. Que la raíz de destino sea parametrizable (`BASE="${VAR:-default}"`) para poder probarlo contra un directorio temporal. Credenciales del respaldo fuera del repo. Una tarea programada desatendida no puede preguntar nada: no debe depender de prompts. Que cada corrida deje un registro con el número de estampas y versiones respaldadas (denominador impreso).
- Referencia: `docs/decisions/DECISION_DEPLOY.md` (F1, dónde corre el servidor).

### Tarea 3.3: Herramienta `importar_json`

- Archivo: `src/tools/importar-json.tool.ts` (crear) y su spec; `src/domain/estampa/import.ts` (crear)
- Que hacer: recibe el envoltorio de `exportar` (toda exportación lleva `id`, así que puede reconocer estampas que ya existen; solo con `incluirVersiones` trae `numeroVersion` y por tanto versiones anteriores), valida contra el esquema de la versión declarada (`formato`, `version`) y lo carga. Rechaza la autorreferencia de `derivadaDe` igual que `corregir_estampa`. Rechaza versiones desconocidas con mensaje claro. Modo de prueba sin escribir (`dryRun`) por defecto. Decidir y documentar qué pasa con ids ya existentes (omitir, nunca sobrescribir en silencio: las versiones son inmutables). Importación atómica: o entra todo o nada.
- Referencia: `src/domain/estampa/export.ts` (F1, tarea 1.9).

### Tarea 3.4: Prueba de restauración

- Archivo: `src/data/__tests__/restauracion.int.spec.ts` (crear) o procedimiento documentado en `docs/decisions/DECISION_RESPALDO.md`
- Que hacer: demostrar que un respaldo real se restaura en una base **vacía** y que el resultado es idéntico (mismo número de estampas y versiones, mismos documentos). Un respaldo que nunca se restauró no está probado. Hacerla fallar a propósito una vez (respaldo truncado → debe dar rojo).

## Criterios de Aceptacion

- [ ] Archivar oculta pero no borra; ningún camino de la API ni de SQL elimina una estampa o versión.
- [ ] El respaldo corre solo, deja un registro con denominadores y su copia está fuera del Mac Mini y de Supabase.
- [ ] Se restauró un respaldo real en una base vacía con resultado idéntico, y se vio fallar con un respaldo roto.
- [ ] `importar_json` rechaza formato/versión desconocidos, no sobrescribe, y es atómico.
- [ ] `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` pasan.
