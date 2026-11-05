# Backlog — ladder-lab

Backlog estructurado del proyecto. Generado el 2026-11-05 desde [`../_CONCEPTO.md`](../_CONCEPTO.md) (MCP personal, un solo usuario, base histórica de estampas de configuración competitiva).

## Estado actual

**F0 cerrada el 2026-11-05** (8 de 8 tareas). **F1 a F4 implementadas y probadas en local el 2026-11-05**; **nada desplegado ni usado con datos reales**. Lo que falta es de Freddy: ver «Pendientes reales» abajo y [`PUESTA_EN_MARCHA.md`](../runbooks/PUESTA_EN_MARCHA.md). Detalle en cada FASE, sección «Estado de ejecución».
**Orden de fases acordado (2026-11-05):** F0 → F1 → **F3** → F2 → F4. F3 va antes que F2.

## Fases

| Fase                                        | Nombre                                                      | Estado                                                          | Tareas | Fuente                                      |
| ------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- | ------ | ------------------------------------------- |
| [FASE_0](./FASE_0_BASE.md)                  | Base (huecos de la plantilla)                               | **cerrada**                                                     | 8      | plantilla `template-mcp` vs concepto, Stack |
| [FASE_1](./FASE_1_REGISTRAR_Y_NO_PERDER.md) | Registrar y no perder (**PROTEGIDA**)                       | implementada y probada en local; falta desplegar y usar         | 12     | concepto F1                                 |
| [FASE_3](./FASE_3_CUIDAR_DATOS.md)          | Cuidar los datos (**va antes que F2**)                      | implementada y probada en local; falta programar y copiar fuera | 4      | concepto F3                                 |
| [FASE_2](./FASE_2_CONCLUSIONES.md)          | Conclusiones (**BLOQUEADA**: 10 estampas reales y F3 hecha) | implementada y probada en local, sin datos reales               | 6      | concepto F2                                 |
| [FASE_4](./FASE_4_CONVERTIDOR.md)           | Integración con el convertidor                              | hecha y verificada contra sens-lab; falta una exportación real  | 3      | concepto F4                                 |

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

## Pendientes reales

Todo el código y los documentos están hechos y probados en local. **No se desplegó nada y nada se ejecutó contra un Supabase real ni contra el Mac Mini**: exige credenciales y decisiones de Freddy. Pasos exactos en [`PUESTA_EN_MARCHA.md`](../runbooks/PUESTA_EN_MARCHA.md). Fecha: 2026-11-05. Cada punto se lee solo; se cierra cuando Freddy lo confirma.

1. **Aplicar las migraciones y desplegar (tareas 1.3 y 1.11).** Hay dos migraciones SQL escritas y probadas contra Postgres de Supabase y PostgREST reales en contenedor, pero ninguna se aplicó a un proyecto Supabase real, y el servidor no corre en el Mac Mini. Decisión provisional: despliegue como `hylian-mcp` (push, CI, runner del Mac), solo como supuesto, con el workflow de despliegue como borrador **fuera** de `.github/` (`DECISION_DEPLOY.md`). Flojo: organización, repositorio y runner sin confirmar. Pregunta: ¿cuándo quieres que se aplique y desplegue, y con qué repositorio y runner?

2. **Poner F1 en uso y congelar el formato (tarea 1.12).** Sin estampas reales no se puede congelar el formato v1 (la especificación dice «no congelado»). Decisión provisional: el formato queda abierto y cualquier cambio sigue `DECISION_VERSIONADO_FORMATO.md`. Flojo: los tipos de valor propuestos (`resolucion` como `ANCHOxALTO`, `posicionWindows` de 1 a 11) y el nombre `numeroVersion` son propuesta. Pregunta: ¿cargas las primeras estampas reales y marcas el formato como congelado cuando te cierre?

3. **Programar el respaldo y copiarlo fuera (tarea 3.2 y 3.4).** El comando `pnpm respaldo` está hecho y verificado (también la restauración en una base vacía real en contenedor), pero falta la tarea programada, el destino **fuera del Mac Mini y de Supabase**, y restaurar un respaldo real en un proyecto Supabase de prueba. Es la única red de seguridad: el plan gratuito no da copias descargables y pausa el proyecto inactivo (`DECISION_RESPALDO.md`). Pregunta: ¿qué destino externo usarás y cuándo se programa?

4. **Supabase compartido con sens-lab.** sens-lab usa un esquema `sens_lab` dentro del mismo proyecto. Decisión provisional: se respeta (es decisión tuya) y está documentado en `DECISION_INTEGRACION_CONVERTIDOR.md`. Flojo: una sola clave `service_role` abre los dos esquemas, el respaldo de ladder-lab no cubre `sens_lab`, y la pausa por inactividad afecta a los dos productos. Pregunta: ¿aceptas ese riesgo compartido o prefieres un proyecto aparte para sens-lab?

5. **Revisar F2 con datos reales.** La compuerta de F2 se levantó por orden tuya sin las 10 estampas reales (`DECISION_COMPUERTA_F2.md`); la forma de las salidas de `comparar_estampas`, `historial_versiones`, `matches_perfectos` y `mejor_por_juego` es una primera propuesta, y los índices se midieron con datos sintéticos. Decisión provisional: se deja como está. Pregunta: cuando existan las 10 estampas, ¿revisamos qué herramientas se usan y recortamos las que no?

6. **Tres nombres propios de ladder-lab que Freddy no confirmó:** `numeroVersion` (versión dentro del respaldo), el campo `archivada: true` en la exportación y que la exportación incluya las archivadas (`DECISION_FORMATO_ESTAMPA_V1.md`). Ya están implementados y publicados; cambiarlos cuesta una versión del formato. Pregunta: ¿los aceptas tal cual?

7. **Falta herramienta para desarchivar.** El concepto solo nombra «archivar». Decisión provisional: no existe y se anota en el ADR. Pregunta: ¿necesitas poder desarchivar?

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
