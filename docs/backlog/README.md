# Backlog — ladder-lab

Backlog estructurado del proyecto. Generado el 2026-11-05 desde [`../_CONCEPTO.md`](../_CONCEPTO.md) (MCP personal, un solo usuario, base histórica de estampas de configuración competitiva).

## Estado actual

**F0 cerrada el 2026-11-05** (8 de 8 tareas). **F1, F2 y F3 implementadas y probadas en local el 2026-11-05**; **nada desplegado ni usado con datos reales** (1.11 y 1.12 son de Freddy: [`PUESTA_EN_MARCHA.md`](../runbooks/PUESTA_EN_MARCHA.md)). Detalle en cada FASE, sección «Estado de ejecución».
**Orden de fases acordado (2026-11-05):** F0 → F1 → **F3** → F2 → F4. F3 va antes que F2.

## Fases

| Fase                                        | Nombre                                                      | Estado                                                          | Tareas | Fuente                                      |
| ------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- | ------ | ------------------------------------------- |
| [FASE_0](./FASE_0_BASE.md)                  | Base (huecos de la plantilla)                               | **cerrada**                                                     | 8      | plantilla `template-mcp` vs concepto, Stack |
| [FASE_1](./FASE_1_REGISTRAR_Y_NO_PERDER.md) | Registrar y no perder (**PROTEGIDA**)                       | implementada y probada en local; falta desplegar y usar         | 12     | concepto F1                                 |
| [FASE_3](./FASE_3_CUIDAR_DATOS.md)          | Cuidar los datos (**va antes que F2**)                      | implementada y probada en local; falta programar y copiar fuera | 4      | concepto F3                                 |
| [FASE_2](./FASE_2_CONCLUSIONES.md)          | Conclusiones (**BLOQUEADA**: 10 estampas reales y F3 hecha) | implementada y probada en local, sin datos reales               | 6      | concepto F2                                 |
| [FASE_4](./FASE_4_CONVERTIDOR.md)           | Integración con el convertidor                              | pendiente                                                       | 3      | concepto F4                                 |

Total: **33 tareas** en 5 fases. Los archivos conservan su número de fase del concepto aunque F3 se ejecute antes que F2.

## Decisiones cerradas (no se reabren)

Vienen del concepto y de las órdenes de Freddy. Las fases las dan por hechas.

- La **estampa** es la unidad principal; cada una es independiente.
- Las **versiones** no se borran: corregir crea una versión nueva y conserva la anterior; ninguna estampa se borra de verdad, se archiva.
- Acceso por **HTTP con token, solo por Tailscale**, en el Mac Mini M1 (Streamable HTTP).
- Datos: **`supabase-js` con migraciones SQL**, proyecto Supabase propio **en la nube** (2026-11-05).
- Formato común: **JSON versionado**, esquema Zod; única conexión con el convertidor.
- Stack de base: `template-mcp`, TypeScript, Node 22, Zod, Vitest. No se re-decide.

### Decisiones cerradas el 2026-11-05

Respuestas de Freddy a las 6 preguntas que dejó abiertas la primera versión de este backlog. Un punto se cierra solo cuando Freddy lo dice; estos los cerró él.

1. **Dónde vive Supabase:** en la nube, proyecto propio. Efecto: tareas 1.3, 1.10, 1.11 y 3.2. Pendiente que él compruebe la política de pausa por inactividad y los respaldos del plan (1.3, punto 9).
2. **Forma del JSON v1:** el ADR se escribe como propuesta, **revisado después en una sesión de control, pendiente de confirmación de Freddy** (ver abajo) ([`DECISION_FORMATO_ESTAMPA_V1.md`](../decisions/DECISION_FORMATO_ESTAMPA_V1.md)); cada campo va con un valor, `desconocido` o `no_aplica`. Se agrega el campo opcional **`derivadaDe`** al formato y al concepto.
3. **Valores especiales:** los obligatorios aceptan `desconocido` (**salvo `juego.nombre`, `genero` y `certeza`**, ver la revisión de F0); `no_aplica` solo en `sensibilidad` y `rawInput`, cuando el juego no los tiene.
4. **`mejor_por_juego`:** no juzga causa; devuelve las estampas marcadas como match perfecto del juego, con el rango como texto. No hay orden de rangos en v1. Efecto: tarea 2.3 reescrita (ya no hay catálogo de rangos).
5. **«F1 en uso»:** 10 estampas reales.
6. **Despliegue:** como `hylian-mcp`, **como supuesto**; no se despliega todavía (tarea 1.11).

También: **F3 antes que F2**, onboarding no, TestSprite no.

### Decisiones cerradas en la revisión de F0 (2026-11-05)

Dadas en la revisión de F0 y del ADR del formato (sesión de control). El ADR quedó **revisado, pendiente de confirmación de Freddy**. El conflicto que había se resolvió en los ajustes posteriores.

1. **`mouse`:** una sola casilla de texto, «marca y modelo». Sin `mouse.marca` ni `mouse.modelo`.
2. **`desconocido`:** `juego.nombre`, `genero` y `certeza` **no** lo aceptan. `genero` solo `FPS` o `RTS`. (Corrige la frase del concepto «todo campo obligatorio acepta `desconocido`».)
3. **`juegoDelLogro`:** se quita; el juego ya está en la estampa.
4. **`derivadaDe`:** se rechaza la autorreferencia; en v1 no se validan ciclos largos.
5. **Exportar varias:** arreglo de documentos dentro de un envoltorio con `formato` y `version`. _(La parte «`id` solo en respaldo» fue reemplazada: ver ajustes posteriores.)_
6. **`@supabase/supabase-js`:** instalado (2.119.0). F0 cerrada.
7. **Repositorio y runner del despliegue:** se definen en la tarea 1.11.

### Ajustes posteriores a la revisión de F0 (2026-11-05)

1. **La exportación siempre lleva `id`.** sens-lab debe poder citar la estampa de origen para crear una estampa con `derivadaDe`. `derivadaDe` queda como referencia a ese `id`. Esto cierra el conflicto que había (ya no hay «exportación normal sin id»): hay un solo formato y la única variante es `incluirVersiones`. Efecto: tareas 1.9 y 3.3.
2. **Estado del ADR:** "revisado en sesión de control, pendiente de confirmación de Freddy". No se escribe como aceptado.

## Protección de F1

F1 es la única fase con prioridad hasta tener datos reales. Su alcance está cerrado (5 herramientas, esquema, versiones, formato JSON y despliegue) y está escrito en [`FASE_1`](./FASE_1_REGISTRAR_Y_NO_PERDER.md), sección «Protección de F1». F0 existe para que F1 sea solo dominio, y no contiene nada de estampas. Lo que se proponga y no sea de F1 se anota en F2/F3/F4, no se cuela en F1.

## Preguntas abiertas

Cada punto se lee solo. Un punto se cierra únicamente cuando Freddy lo confirma. Fecha de apertura: 2026-11-05.

1. **Confirmación del ADR del formato JSON v1 (tarea 1.1).** El ADR quedó revisado en sesión de control y falta que Freddy lo confirme; hasta entonces no se escribe el esquema Zod (1.2). Decisión provisional: el formato tal como está en `DECISION_FORMATO_ESTAMPA_V1.md` (campos, valores especiales, exportación con `id` siempre y `derivadaDe` como referencia a ese `id`). Flojo: dos cosas son mías y no decididas: el nombre `numeroVersion` (número de versión en la exportación con `incluirVersiones`) y que `exportar` incluya las estampas archivadas para que ningún `derivadaDe` quede colgado. Pregunta: ¿confirmas el ADR, y te sirven `numeroVersion` y la inclusión de archivadas?

## Diagramas de Referencia

| Archivo                                                                        | Tipo                 | Contenido                                                                              |
| ------------------------------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------- |
| [`../diagrams/DIAGRAMAS_COMPONENTES.md`](../diagrams/DIAGRAMAS_COMPONENTES.md) | Flowcharts (Mermaid) | Topología: PC de juegos, Mac Mini, Supabase, ThinkPad, convertidor; capas del servidor |

Este diagrama es referencia estructural estable. Las fases lo referencian pero no lo repiten. Actualizar solo ante cambios de topología (agregar/quitar servicios o cambiar frontera cliente/servidor).

## Decisiones Técnicas

Carpeta [`../decisions/`](../decisions/) — documentar aquí decisiones arquitectónicas cuando surjan durante el desarrollo.
Formato: `DECISION_[TEMA].md` — explica el POR QUÉ, no el QUÉ.

ADRs que el backlog ya prevé (nacen al ejecutar la tarea, no antes): `DECISION_TRANSPORTE_HTTP` (0.4), `DECISION_FORMATO_ESTAMPA_V1` (1.1), `DECISION_MODELO_DATOS` (1.3), `DECISION_DEPLOY` (1.11), `DECISION_MEJOR_POR_JUEGO` (2.3), `DECISION_INDICES_F2` (2.6), `DECISION_RESPALDO` (3.2), `DECISION_VERSIONADO_FORMATO` (4.2), `DECISION_INTEGRACION_CONVERTIDOR` (4.3).

## Validación de Flujos

| Archivo                      | Propósito                                                       |
| ---------------------------- | --------------------------------------------------------------- |
| [`../flows.md`](../flows.md) | Flujos de usuario documentados manualmente. Guía para QA y E2E. |

Llenar después de probar cada feature. Usar como referencia con `/tools:testing:run-browser-testing`. Nota: este proyecto no tiene interfaz web; los «pasos» son llamadas a herramientas MCP desde Claude Code.

## Concepto original

[`../_CONCEPTO.md`](../_CONCEPTO.md) — documento de origen, no editar. Refleja la idea original con la que se generó el backlog.

## Sincronización

Estado técnico del progreso: `../../.claude/backlog-progress.json`. Contexto técnico derivado: `../../.claude/backlog-context.json`.
Comando de sincronización: `/work:backlog:sync` (detecta drift entre este directorio y el JSON).
