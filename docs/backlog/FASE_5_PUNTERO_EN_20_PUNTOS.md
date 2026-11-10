# FASE 5: VELOCIDAD DEL PUNTERO EN 20 PUNTOS

**Destraba**: registrar la primera estampa real (la base RTS del 2026-11-10), que hoy no cabe en el formato.
**Prioridad**: Alta
**Dependencias**: FASE_1 y FASE_4. Va en paralelo con `sens-lab` `FASE_4_PUNTERO_EN_20_PUNTOS` (mismo contrato; la tarea 5.5 necesita esa fase hecha en disco).
**Estado**: HECHA el 2026-11-10 (7/7): código, pruebas, documentos y contrato real contra sens-lab. Sellada y pusheada en `fc972a1`; CI de ese commit en verde; desplegada y comprobada en el Mac Mini sin crear estampas. Escrita por la sesión de control el 2026-11-10.
**Origen**: orden de Freddy del 2026-11-10: «debemos ajustarlo para que sea posible y funcione así de ahora en adelante en 20 puntos». Renombrar el campo fue recomendación de control; Freddy respondió «dale».

> Por qué: Windows 11 guarda la velocidad del puntero como un entero de 1 a 20 (`HKCU\Control Panel\Mouse\MouseSensitivity`, el valor de `SPI_GETMOUSESPEED`). El formato v1 la pide como «posición» de 1 a 11, la escala del panel viejo. La base de Freddy está en **9 de 20**, que no existe en la escala de 11: hoy esa estampa solo podría decir `desconocido`.
> Por qué se puede sin subir de versión: `DECISION_VERSIONADO_FORMATO.md`, «Mientras el formato no esté congelado». El formato no está congelado y **la base tiene 0 estampas** (medido el 2026-11-10 con `listar_estampas` contra el servidor desplegado).

## Contrato (idéntico al de la fase de sens-lab; no se cambia de un solo lado)

| qué                   | antes                     | ahora                                                                       |
| --------------------- | ------------------------- | --------------------------------------------------------------------------- |
| campo                 | `sistema.posicionWindows` | `sistema.punteroWindows`                                                    |
| tipo                  | entero de 1 a 11          | entero de **1 a 20**                                                        |
| significado           | casilla del panel viejo   | valor del registro `MouseSensitivity` (el que devuelve `SPI_GETMOUSESPEED`) |
| `desconocido`         | sí                        | sí                                                                          |
| `no_aplica`           | no                        | no                                                                          |
| obligatorio           | sí                        | sí                                                                          |
| `version` del formato | 1                         | **1** (sin migrador)                                                        |

`posicionWindows` **desaparece**: no queda alias ni se acepta como entrada. Motivo: con el mismo nombre, un `6` viejo (×1,0) se leería en silencio como `6` nuevo (×0,5). Con otro nombre, un documento viejo falla con mensaje claro.

Equivalencia para llevar a mano un dato recordado en la escala vieja (posición → puntero): 1→1, 2→2, 3→4, 4→6, 5→8, 6→10, 7→12, 8→14, 9→16, 10→18, 11→20. Ladder-lab **no** calcula multiplicadores (eso es de sens-lab): solo guarda el entero.

## Orden de ejecución

1. Tarea 5.1 — ADR del cambio
2. Tarea 5.2 — esquema y constantes
3. Tarea 5.3 — especificación publicada, fixtures y ADR del formato
4. Tarea 5.4 — pruebas, con controles rojos
5. Tarea 5.5 — contrato real contra sens-lab (**necesita la fase de sens-lab hecha en disco**)
6. Tarea 5.6 — sellar, push, CI y despliegue
7. Tarea 5.7 — comprobar en el servidor desplegado

## Tareas

### Tarea 5.1: ADR del cambio

- Archivo: `docs/decisions/DECISION_PUNTERO_WINDOWS_20.md` (crear)
- Que hacer: registrar la decisión con la cita textual de Freddy (arriba), el contrato de esta fase, por qué se renombra en vez de ampliar el rango, y por qué no sube la versión (citar la sección de `DECISION_VERSIONADO_FORMATO.md` y el dato de 0 estampas). Incluir una sección «Qué NO decide este ADR»: no congela el formato; no agrega multiplicadores a ladder-lab; no decide nada sobre `aceleracionWindows`.
- Referencia: `DECISION_VERSIONADO_FORMATO.md`, `DECISION_FORMATO_ESTAMPA_V1.md`.

### Tarea 5.2: Esquema y constantes

- Archivo: `src/domain/estampa/constants.ts:19-20`, `src/domain/estampa/schema.ts:14-15` y `:78-79`
- Que hacer: `POSICION_WINDOWS_MIN/MAX` (1 y 11) pasan a `PUNTERO_WINDOWS_MIN/MAX` (1 y 20); el campo `posicionWindows` pasa a `punteroWindows`. El esquema es estricto: comprobar que un documento con `posicionWindows` se rechaza con un error legible que nombre el campo. Grepear `posicionWindows|POSICION_WINDOWS` en `src/`, `scripts/` y `docs/` al terminar: debe quedar solo en el ADR nuevo, en el historial de `DECISION_FORMATO_ESTAMPA_V1.md` y en esta fase.
- Referencia: `src/domain/estampa/schema.ts`.

### Tarea 5.3: Especificación publicada, fixtures y ADR del formato

- Archivo: `docs/formato/ladder-lab.estampa.v1.md:38`, `:79` y `:112`; los cuatro fixtures de `docs/formato/ejemplos/` (6 apariciones); `docs/decisions/DECISION_FORMATO_ESTAMPA_V1.md:53` y `:82`
- Que hacer: actualizar la fila de la tabla de campos, los ejemplos y los fixtures. **Los `6` de los ejemplos pasan a `10`** (es la misma velocidad, ×1,0, en la escala nueva): no dejarlos en 6. En el ADR del formato, corregir la fila y agregar una línea que apunte al ADR nuevo; no reescribir su historia.
- Referencia: `src/domain/estampa/__tests__/formato-publicado.spec.ts` (obliga a que la tabla coincida con el esquema campo por campo).

### Tarea 5.4: Pruebas, con controles rojos

- Archivo: `src/domain/estampa/__tests__/schema.spec.ts:59`, `:97`, `:164`, `:221-222`, `:239-243`
- Que hacer: adaptar los casos al campo nuevo. Extremos válidos 1 y 20; rojos 0, 21 y 2,5. Caso rojo nuevo: un documento con `posicionWindows` (el nombre viejo) se rechaza. Caso verde nuevo: `punteroWindows: 9` valida. Antes de dar la fase por buena, hacer fallar una prueba a propósito una vez (por ejemplo dejar el máximo en 11) y ver que cae.
- Referencia: `docs/formato/ejemplos/`.

### Tarea 5.5: Contrato real contra sens-lab

- Archivo: `scripts/verificar-con-sens-lab.sh`
- Que hacer: correrlo con `../sens-lab` ya en su `FASE_4_PUNTERO_EN_20_PUNTOS` hecha. Debe salir 0. Si sale 2 no verificó nada; si sale 1 el contrato está roto y no se sella. Si la fase de sens-lab no está hecha en disco, **parar acá y avisar a control**: no sellar ladder-lab solo.
- Referencia: `DECISION_INTEGRACION_CONVERTIDOR.md`.

### Tarea 5.6: Sellar, push, CI y despliegue

- Archivo: ninguno nuevo
- Que hacer: `pnpm lint`, `pnpm type-check`, `pnpm build` y `pnpm test` en verde; `/work:sellar:run`; commit y push (orden de Freddy del 2026-11-10: «que lo complete y selle al final y pushee»). Sin firma de IA. Después del push, mirar el CI del commit con `gh run list` hasta verlo verde. **El push no despliega** (`docs/runbooks/PUESTA_EN_MARCHA.md`, «Actualizar»): con los dos repos pusheados y sus CI en verde, correr `deploy/desplegar.sh` (despliega los dos). Freddy pidió el push «para el autodeploy»: el despliegue es parte de la orden.
- Referencia: `docs/runbooks/PUESTA_EN_MARCHA.md`.

### Tarea 5.7: Comprobar en el servidor desplegado

- Archivo: ninguno
- Que hacer: comprobar que el servidor desplegado ya habla el formato nuevo **sin crear ni corregir estampas** (la base es real y nada se borra): `/healthz` responde y la descripción del esquema de entrada de `crear_estampa` en `tools/list` nombra `punteroWindows` con máximo 20. La primera estampa real la carga la sesión de control después, no esta fase.
- Referencia: `docs/runbooks/PUESTA_EN_MARCHA.md`, «Comprobar de verdad».

## Fuera de alcance

- Cargar estampas (lo hace control al terminar).
- Multiplicadores o conversiones (sens-lab).
- Congelar el formato (tarea 1.12; sigue esperando uso real).
- Un campo que diga de qué equipo viene la estampa (anotado como idea, no pedido).

## Criterios de Aceptacion

- [x] `sistema.punteroWindows` acepta de 1 a 20 y `desconocido`; rechaza 0, 21, decimales y `no_aplica`.
- [x] Un documento con `posicionWindows` se rechaza con un error que nombra el campo.
- [x] La especificación, los cuatro fixtures y los dos ADR dicen lo mismo que el esquema (`formato-publicado.spec.ts` en verde).
- [x] `scripts/verificar-con-sens-lab.sh` sale 0 contra el sens-lab ya cambiado.
- [x] Sellado y pusheado; CI del commit en verde.
- [x] Desplegado y comprobado en el Mac Mini sin haber creado estampas.

## Resultados de la ejecución (2026-11-10)

`pnpm lint`, `pnpm type-check`, `pnpm build` y `pnpm test` en verde (20 archivos, **440 pruebas**, antes 437); integración contra contenedores desechables 86/86. `scripts/verificar-con-sens-lab.sh` sale **0** (12 comprobaciones) contra el sens-lab ya cambiado (`b8b9c53`, CI verde).

- **5.1** `docs/decisions/DECISION_PUNTERO_WINDOWS_20.md`.
- **5.2** `PUNTERO_WINDOWS_MIN/MAX` (1 y 20) y `sistema.punteroWindows`. Un documento con `posicionWindows` se rechaza y el error nombra el campo. El grep de la tarea devuelve solo el ADR nuevo, el apartado de cambio posterior de `DECISION_FORMATO_ESTAMPA_V1.md`, esta fase y la prueba que comprueba el rechazo del nombre viejo.
- **5.3** Tabla de la especificación, ejemplos y los cuatro fixtures: los `6` pasan a `10`.
- **5.4** Pruebas del puntero 9 (válido), extremos 1 y 20, rojos 0, 21 y 2,5, y el campo viejo. **Prueba añadida que no pedía la fase:** `formato-publicado.spec.ts` comparaba nombres y banderas pero no el rango, así que una tabla que dijera «1 a 11» seguía en verde; ahora una prueba compara el rango de la tabla con las constantes del esquema.
- **Rojos provocados:** (1) máximo en 11 → cae la prueba de extremos; (2) tabla de la especificación en «1 a 11» → cae la prueba nueva de rango; (3) ejemplos con `posicionWindows` → el contrato con sens-lab sale 1. Los tres revertidos.
- **5.5** El contrato real sale 0; sens-lab lee `punteroWindows` y los faltantes del mapeo no incluyen el puntero.
- **5.6** Sellada con `/work:sellar:run` (2 vueltas: la primera escribió 2 restos de la escala vieja, `DECISION_FORMATO_ESTAMPA_V1.md:35` y `docs/flows.md:108`; la segunda limpia). Commit `fc972a1`, sin firma de IA; CI run 42840650152 en verde. Con sens-lab ya pusheado (`6e2de83`, CI verde), `deploy/desplegar.sh` salió 0: imágenes `ladder-lab:fc972a1` y `sens-lab:6e2de83`, contenedores recreados; `ladder-lab` quedó `healthy`.
- **5.7** Contra el servidor desplegado, sin crear ni corregir estampas: `/healthz` 200; `POST /mcp` sin cabecera 401 y con token basura 401; `tools/list` devuelve 11 herramientas y `crear_estampa` declara `sistema.punteroWindows` entero de 1 a 20 (o `desconocido`), sin rastro de `posicionWindows`; los logs de `ladder-lab` no contienen token. sens-lab responde 200 en su puerto. Los controles de borrado/inmutabilidad del runbook no se corrieron: exigen filas reales y la base es real.
- **Pendiente de control:** cargar la primera estampa real (base RTS, puntero 9).
