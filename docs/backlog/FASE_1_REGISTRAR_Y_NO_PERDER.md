# FASE 1: REGISTRAR Y NO PERDER (PROTEGIDA)

**Prioridad**: Alta (la única fase que importa hasta tener datos reales)
**Dependencias**: FASE_0
**Origen**: concepto, sección Fases, F1 ("registrar y no perder"). Herramientas: `crear_estampa`, `corregir_estampa`, `ver_estampa`, `listar_estampas`, `exportar`. Incluye esquema, versiones, formato JSON y despliegue.

## Protección de F1

Esta fase es **cerrada**. Alcance = las 5 herramientas + esquema + versiones + formato JSON + despliegue, y nada más.

- Cualquier idea de comparar, rankear, filtrar por rendimiento, archivar, respaldar con cron o importar **no entra aquí**: se anota en [`FASE_2`](./FASE_2_CONCLUSIONES.md) o [`FASE_3`](./FASE_3_CUIDAR_DATOS.md) y se sigue.
- Una tarea nueva en F1 exige que Freddy la apruebe y que la FASE diga qué se saca para mantener el tamaño.
- F2 queda **bloqueada** hasta cumplir el criterio de salida de esta (concepto: «Sin datos reales no se construye F2: F1 debe estar en uso antes»). F3 y F4 no están bloqueadas por el concepto, pero dependen de F1 desplegada (F3) y del formato congelado (F4); ver sus FASE.
- Lo que sí es de F1 aunque parezca extra: lo que impide **perder** datos (versiones inmutables en la base, `exportar` completo, validación en el borde). El concepto mitiga el riesgo «dependencia de Supabase» con `exportar` desde F1.

> Topología de referencia: [`../diagrams/DIAGRAMAS_COMPONENTES.md`](../diagrams/DIAGRAMAS_COMPONENTES.md).
> Decisiones del 2026-11-05 que condicionan esta fase (Supabase en la nube, valores especiales, `derivadaDe`, umbral de 10 estampas, despliegue como `hylian-mcp`): ver README del backlog, sección «Decisiones cerradas el 2026-11-05».

## Orden de ejecución

1. Tarea 1.1 — obtener la confirmación de Freddy del ADR del formato v1 (el ADR está revisado en sesión de control; **1.2 no empieza sin esa confirmación**)
2. Tarea 1.2 — esquema Zod del dominio (sobre 1.1)
3. Tarea 1.3 — modelo de datos y migración SQL (sobre 1.1; independiente de 1.2 en código)
4. Tarea 1.4 — capa de datos (sobre 1.2 y 1.3)
5. Tareas 1.5 a 1.9 — las cinco herramientas, en este orden: `crear_estampa` primero porque genera los datos que las otras leen; `exportar` al final porque usa el formato ya probado
6. Tarea 1.10 — pruebas de integración contra base real (sobre 1.3 y 1.4; corre en paralelo con 1.5-1.9)
7. Tarea 1.11 — despliegue (sobre 1.5-1.9 y 1.10)
8. Tarea 1.12 — puesta en uso (sobre 1.11; es lo que abre la puerta a F2)

## Tareas

### Tarea 1.1: Obtener la confirmación de Freddy del ADR del formato JSON v1

- Archivo: `docs/decisions/DECISION_FORMATO_ESTAMPA_V1.md` (estado: **revisado en sesión de control, pendiente de confirmación de Freddy**; al confirmarlo se actualiza el estado)
- Que hacer: el ADR ya fija el formato (valores especiales como cadenas `desconocido` / `no_aplica` y nunca `null`; `mouse` como una sola casilla de texto; sin `juegoDelLogro`; `genero` solo `FPS`/`RTS`; `juego.nombre`, `genero` y `certeza` sin `desconocido`; `derivadaDe` como referencia a un `id`, sin autorreferencia; exportación en envoltorio **con `id` siempre**). El conflicto entre `derivadaDe` y la exportación sin id **está resuelto** (2026-11-05). Lo único pendiente es la confirmación de Freddy, más dos puntos míos que el ADR marca como no decididos: el nombre `numeroVersion` y la inclusión de estampas archivadas en `exportar`.
- Referencia: `../_CONCEPTO.md` (secciones Modelo de dominio y Formato común).

### Tarea 1.2: Esquema Zod del dominio

- Archivo: `src/domain/estampa/constants.ts` (crear) — `DESCONOCIDO`, `NO_APLICA`, géneros, certezas, estados de `rawInput`, `FORMATO_ESTAMPA`, `FORMATO_VERSION` (nada de cadenas sueltas).
- Archivo: `src/domain/estampa/schema.ts` (crear) — esquemas Zod por bloque (juego, sistema, enJuego, resultado) y de la estampa completa.
- Archivo: `src/domain/estampa/types.ts` (crear) — tipos derivados con `z.infer` (una sola fuente).
- Archivo: `src/domain/estampa/index.ts` (crear), `src/domain/estampa/__tests__/schema.spec.ts` (crear)
- Archivo: `tsconfig.json`, `vitest.config.ts` (modificar) — alias `@domain/*` en ambos.
- Que hacer:
  1. Implementar exactamente lo fijado en el ADR (una vez confirmado en 1.1): campos numéricos como unión de número o valor especial; refinamiento «etapa o fecha»; `certeza` ∈ `medido | recordado | estimado` y `genero` ∈ `FPS | RTS`, ambos **sin** `desconocido` (tampoco `juego.nombre`); `desconocido` en el resto de los obligatorios según la tabla del ADR; `no_aplica` **solo** en `sensibilidad` y `rawInput`; `mouse` es un solo texto (marca y modelo); no existe `juegoDelLogro`; `derivadaDe` opcional (referencia a un `id`); un documento exportado lleva además `id` (el esquema de entrada de `crear_estampa` no lo acepta).
  2. Tests con el JSON de ejemplo del ADR como fixture, un caso por cada campo obligatorio ausente, `desconocido` y `no_aplica` en cada campo que los acepte y **rechazo donde no** (en especial `genero`, `certeza`, `juego.nombre` con `desconocido`, y `no_aplica` fuera de `sensibilidad`/`rawInput`); `etapa` o `fecha` ausentes a la vez.
  3. Sin `any`; sin `let`.
- Referencia: `src/tools/greet.tool.ts` (uso de Zod existente en el repo, antes de 0.6).

### Tarea 1.3: Modelo de datos y migración SQL

- Archivo: `docs/decisions/DECISION_MODELO_DATOS.md` (crear) — el porqué.
- Archivo: `supabase/migrations/<timestamp>_crear_estampas.sql` (crear)
- Que hacer:
  1. Decidir y documentar la forma. Opciones: (A) una columna tipada por campo, con una columna de estado por campo para `desconocido`/`no_aplica`; (B) un documento `jsonb` por versión validado por Zod en la aplicación, con columnas generadas e indexadas solo para lo que se filtra (`juego`, `genero`, `fecha`/`etapa`, `rango`). **Recomendación a confirmar: B**, porque los valores especiales son difíciles de tipar por columna, `exportar` queda casi gratis (el documento ya es el formato) y es un buen ejercicio de SQL e índices (practice-wishlist del concepto).
  2. Tablas mínimas: `estampas` (identidad estable, juego, género, creada, archivada nullable, `derivada_de` nullable con clave foránea a `estampas(id)` y con `CHECK (derivada_de <> id)`; no se validan ciclos largos en v1) y `estampa_versiones` (estampa, número de versión, documento, versión del formato con la que se escribió, creada). Unicidad `(estampa_id, version)`. Sin columna ni tool de borrado. Si `derivadaDe` se corrige (como cualquier dato), la fuente de verdad es el documento de la versión vigente: decidir en el ADR si `derivada_de` es una columna generada desde el documento o la columna manda.
  3. «Ninguna estampa se borra de verdad»: la migración hace cumplir la inmutabilidad en la base — trigger que rechaza `UPDATE` y `DELETE` sobre `estampa_versiones`, y `DELETE` sobre `estampas`.
  4. `archivada` existe como columna nullable pero **no tiene herramienta hasta F3** (solo se deja el campo para no migrar luego).
  5. Funciones SQL atómicas `crear_estampa` y `corregir_estampa` (RPC): `supabase-js` no abre transacciones de varias sentencias, y crear una estampa inserta la fila de identidad y la versión 1, y corregir calcula la versión siguiente. Sin esto, un fallo a medias deja una estampa sin versión o dos versiones con el mismo número.
  6. RLS activado sin políticas: solo el servidor accede con la clave de servicio. (Propuesta; confirmar en el ADR.)
  7. Índices: los mínimos para `listar_estampas` por juego y orden por fecha. Nada especulativo para F2 (los índices de F2 se miden con datos reales, tarea 2.6).
  8. **Aplicar la migración a un proyecto lo hace Freddy** (`supabase db push` o equivalente, con sus credenciales, fuera del agente). El agente solo escribe el `.sql`.
  9. **Supabase en la nube, proyecto propio** (decidido 2026-11-05). Antes de depender de él, Freddy comprueba en la documentación vigente del plan qué pasa con un proyecto inactivo (pausa) y qué respaldos incluye: una base pausada es un riesgo directo para «no perder». Anotar el resultado en el ADR.
- Referencia: `../../hylian-mcp/supabase/` como ejemplo hermano de estructura de carpeta (allí se usó Supabase local; aquí es un proyecto en la nube, propio y distinto).

### Tarea 1.4: Capa de datos

- Archivo: `src/data/estampa.repository.ts` (crear) — interfaz del repositorio, en términos del dominio.
- Archivo: `src/data/supabase-estampa.repository.ts` (crear) — implementación con `supabase-js` y las RPC de 1.3.
- Archivo: `src/data/in-memory-estampa.repository.ts` (crear) — doble para tests de herramientas.
- Archivo: `src/data/supabase-client.ts` (crear) — fábrica del cliente desde `env` (0.3).
- Archivo: `src/data/index.ts` (crear), alias `@data/*` en `tsconfig.json` y `vitest.config.ts`.
- Que hacer:
  1. Toda fila que sale de la base se parsea con el esquema de 1.2 en el borde; si no parsea, error explícito (no se devuelve basura al LLM).
  2. Errores de Supabase pasan por el logger central y se convierten con `toolError` en la herramienta; sin `catch` vacíos.
  3. El doble en memoria respeta las mismas reglas (versión siguiente, inmutabilidad) para que los tests de herramientas no mientan; las diferencias reales las atrapa 1.10.
  4. Inyección del repositorio en `createServer()` (parámetro, con valor por defecto de producción) para testear sin red.
- Referencia: `src/server.ts` (factory existente), `src/common/errors.ts`.

### Tarea 1.5: Herramienta `crear_estampa`

- Archivo: `src/tools/crear-estampa.tool.ts` (crear), `src/tools/__tests__/crear-estampa.tool.spec.ts` (crear), `src/tools/index.ts` (modificar)
- Que hacer: entrada = campos de la estampa según 1.2; crea la estampa y su versión 1 vía RPC; devuelve el id y la estampa creada. `description` explica al LLM cuándo usarla y que **una configuración distinta en otra etapa es otra estampa** (no una corrección). Anotaciones: no solo lectura, no destructiva.
- Referencia: `src/tools/greet.tool.ts` (patrón `registerTool`, antes de 0.6).

### Tarea 1.6: Herramienta `ver_estampa`

- Archivo: `src/tools/ver-estampa.tool.ts` (crear) y su spec; `src/tools/index.ts` (modificar)
- Que hacer: entrada = id; devuelve la versión vigente más su número de versión y cuántas versiones existen. No expone versiones anteriores (eso es `historial_versiones`, F2; hasta entonces están a salvo en la base y en `exportar` con versiones). Id inexistente → `toolError` claro. Solo lectura.

### Tarea 1.7: Herramienta `corregir_estampa`

- Archivo: `src/tools/corregir-estampa.tool.ts` (crear) y su spec; `src/tools/index.ts` (modificar)
- Que hacer: entrada = id + los campos a corregir (parche parcial, validado contra el esquema completo ya fusionado); crea una versión nueva vía RPC y **conserva la anterior**. Rechazar un parche que no cambia nada (no genera versión vacía). Responder con el número de versión nuevo. La `description` aclara que corregir un dato erróneo de la misma estampa va aquí, y una configuración distinta en otra etapa va en `crear_estampa`. Test explícito: tras corregir, la versión 1 sigue leyéndose idéntica en la base (lo cubre 1.10 contra Postgres real).
- Referencia: tarea 1.5 (mismo patrón).

### Tarea 1.8: Herramienta `listar_estampas`

- Archivo: `src/tools/listar-estampas.tool.ts` (crear) y su spec; `src/tools/index.ts` (modificar)
- Que hacer: devuelve un resumen compacto por estampa (id, juego, género, etapa/fecha, rango, certeza, número de versión), ordenado por fecha. Filtros mínimos: juego y género. Paginación con tope por defecto como constante. No incluye archivadas (no hay forma de archivar hasta F3; el filtro ya la respeta). Sin comparaciones ni orden por rendimiento (eso es F2).

### Tarea 1.9: Herramienta `exportar`

- Archivo: `src/tools/exportar.tool.ts` (crear) y su spec; `src/tools/index.ts` (modificar)
- Archivo: `src/domain/estampa/export.ts` (crear) — construcción del envoltorio exportable.
- Que hacer: según el ADR del formato v1 (sección «Exportación»):
  1. Devuelve un **envoltorio** `{ formato: 'ladder-lab.export', version: 1, estampas: [...] }` con un arreglo de documentos `ladder-lab.estampa`, validado contra el esquema antes de devolverse.
  2. **Un solo formato.** Cada documento lleva **siempre su `id`** (decidido 2026-11-05): sens-lab necesita citar la estampa de origen para crear `derivadaDe`, que es una referencia a ese id. `derivadaDe` viaja tal cual.
  3. **Una sola variante, `incluirVersiones`.** Sin ella, solo la versión vigente de cada estampa. Con ella, la estampa se repite una vez por versión y cada documento lleva además `numeroVersion` (nombre pendiente de confirmar; solo presente con `incluirVersiones`). Con `incluirVersiones` debe poder reconstruirse todo a mano: es lo que mitiga la dependencia de Supabase.
  4. Incluye las estampas archivadas (F3), para que ningún `derivadaDe` apunte a un id ausente (a confirmar, ADR «Qué queda abierto»).
  5. Test de contrato con fixtures textuales del envoltorio (los mismos que se publican en F4): uno sin versiones y otro con `incluirVersiones`; y un test que compruebe que todo `derivadaDe` presente se resuelve contra un `id` del mismo envoltorio.
  6. El servidor corre en el Mac Mini y el cliente en el PC de juegos, así que `exportar` devuelve el texto al cliente; no escribe archivos en el servidor. Si el volumen real obliga a paginar, se resuelve cuando ocurra, no antes.
- Referencia: `../_CONCEPTO.md` (Formato común) y `DECISION_FORMATO_ESTAMPA_V1.md`.

### Tarea 1.10: Pruebas de integración contra Postgres real

- Archivo: `src/data/__tests__/supabase-estampa.repository.int.spec.ts` (crear)
- Archivo: `package.json` (modificar) — script `test:integration` separado de `pnpm test`; `vitest.config.ts` (modificar) para que `pnpm test` no corra los `*.int.spec.ts`.
- Que hacer:
  1. Probar lo que el doble en memoria no puede: unicidad `(estampa_id, version)`, atomicidad de las RPC, y que los triggers de 1.3 **rechazan** `UPDATE`/`DELETE` de versiones y `DELETE` de estampas.
  2. Corren solo contra una base de pruebas **dedicada** (variables propias, nunca la de producción); sin esas variables, se omiten e imprimen el denominador (`omitidas: N`) para que un verde vacío no se confunda con un verde real.
  3. Hacerlas fallar a propósito una vez: quitar el trigger en una base de prueba y ver rojo.
  4. Credenciales de la base de pruebas: las pone Freddy en su entorno, no en el repo.
- Referencia: tarea 1.3.

### Tarea 1.11: Despliegue en el Mac Mini

- Archivo: `docs/decisions/DECISION_DEPLOY.md` (crear), `README.md` (modificar). `Dockerfile` y `.dockerignore` **ya están hechos en F0** (2026-11-05).
- **Supuesto de despliegue (2026-11-05), no ejecutado:** como `hylian-mcp` — push a GitHub, un workflow de despliegue que corre solo si el CI pasó, en el runner self-hosted del Mac Mini, y la imagen Docker queda corriendo ahí. Está sin confirmar y **esta tarea define** el repositorio, el runner y el nombre de la imagen (decidido 2026-11-05); **no se despliega hasta que Freddy lo ordene**. Diferencia a tener en cuenta: `hylian-mcp` se usa por stdio con `ssh mac-mini docker run`; ladder-lab se usa por HTTP con token y Tailscale, así que el contenedor queda corriendo de forma permanente (`--restart unless-stopped`).
- Que hacer:
  1. **Hecho en F0.** `Dockerfile`: usuario no root, solo dependencias de producción, pnpm 10 fijado, `HEALTHCHECK` contra `/healthz`. Verificado construyendo y corriendo la imagen en local.
  2. **Hecho en F0.** `.dockerignore` con `.env`, `.env.*`, `.venv/`, `__pycache__/`, `.git/`, `node_modules`, `dist`, `coverage` y más; cubierto por `src/__tests__/docker.spec.ts`.
  3. Documentar cómo se arranca en el Mac Mini: contenedor con `MCP_TRANSPORT=http`, variables desde un archivo de entorno **fuera del repo y del contexto del build**, política de reinicio, el puerto se publica solo en la IP de Tailscale (`docker run -p <ip-tailscale>:3000:3000`; dentro del contenedor la imagen ya fija `MCP_HOST=0.0.0.0`). Escribir en el ADR el despliegue desde el ThinkPad según el supuesto de arriba (como `hylian-mcp`), marcando qué está confirmado y qué no.
  4. Registrar el servidor en Claude Code del PC de juegos por HTTP con cabecera `Authorization: Bearer`, con el token guardado en la configuración local de usuario del PC, **nunca** en `.claude/settings.json` del repo (regla global §11).
  5. Base y credenciales propias del proyecto, sin compartir con otros sistemas del Mac (riesgo del concepto: incidente de seguridad pendiente en el Mac Mini). La base es el proyecto Supabase en la nube de ladder-lab (decidido 2026-11-05); la clave de servicio vive solo en el archivo de entorno del host.
  6. Probar de verdad: desde el PC, `tools/list` con token correcto responde y sin token da 401 (el chequeo debe poder fallar, regla global §12). Probar también con una cabecera inventada para confirmar que el servicio sí autentica.
- Referencia: `../../hylian-mcp/docs/decisions/DECISION_DEPLOY_MAC_MINI.md` (precedente del mismo host y de qué quedó abierto allí).

### Tarea 1.12: Puesta en uso con datos reales

- Archivo: `docs/flows.md` (modificar) — llenar los flujos probados.
- Archivo: `docs/decisions/DECISION_FORMATO_ESTAMPA_V1.md` (modificar) — marcar el formato como congelado con fecha.
- Que hacer: Freddy carga estampas reales de sus juegos usando las herramientas desde el PC. Registrar en `flows.md` lo que no se entiende o se siente torpe. Con los primeros datos reales, **congelar el formato v1** (de ahí en adelante un cambio incompatible exige `version: 2` y un plan de migración, F4). Hacer un `exportar` completo y comprobar a mano que reconstruye los datos. Esta tarea es la puerta de entrada a F2.
- Referencia: `../flows.md`.

## Criterios de Aceptacion

- [ ] Las 5 herramientas existen, tienen tests y aparecen en `tools/list` desde Claude Code del PC de juegos.
- [ ] Crear → corregir → ver deja dos versiones y la primera sigue intacta (probado contra Postgres real, 1.10).
- [ ] Intentar borrar o modificar una versión desde SQL es rechazado por la base (probado en 1.10, con el caso rojo hecho a propósito).
- [ ] Un campo desconocido o que no aplica se registra con `desconocido` / `no_aplica` y se exporta igual.
- [ ] `exportar` con `incluirVersiones` devuelve todo lo necesario (ids y números de versión incluidos) para reconstruir los datos sin Supabase, validado contra el esquema; toda exportación lleva `id` en cada documento y todo `derivadaDe` se resuelve contra un `id` del mismo envoltorio.
- [ ] El servidor responde 401 sin token (y con token inventado) y 200 con token correcto, medido desde el PC de juegos por Tailscale.
- [ ] La imagen corre como no root, `.dockerignore` existe y el `.env` no está dentro de la imagen.
- [ ] El formato v1 está marcado como congelado con fecha en el ADR.
- [ ] `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` pasan; `pnpm test:integration` pasa contra la base de pruebas.

### Criterio de salida de F1 (abre F2)

F1 en uso significa **10 estampas reales** cargadas por Freddy (decidido 2026-11-05). Hasta que lo confirme por escrito, F2 no se empieza. **F3 va antes que F2** (decidido 2026-11-05): el respaldo es lo que protege esos datos.
