# DECISION: La velocidad del puntero de Windows se guarda en 20 puntos (`punteroWindows`)

Fecha: 2026-11-10 (tarea 5.1 de FASE_5)
**Estado: ordenado por Freddy** (el 2026-11-10; el renombrado fue recomendación de la sesión de control y Freddy respondió «dale»). Implementado en `src/domain/estampa/`.

## Qué pasó

Windows 11 guarda la velocidad del puntero como un entero de 1 a 20 (`HKCU\Control Panel\Mouse\MouseSensitivity`, el valor de `SPI_GETMOUSESPEED`). El formato v1 la pedía como «posición» de 1 a 11 (`sistema.posicionWindows`), la escala del panel viejo. La base de Freddy está en **9 de 20**, un valor que no existe en la escala de 11: la primera estampa real solo habría podido decir `desconocido` en un campo obligatorio.

## Decisión

Palabras de Freddy (2026-11-10): «debemos ajustarlo para que sea posible y funcione así de ahora en adelante en 20 puntos».

| qué                   | antes                     | ahora                                                                       |
| --------------------- | ------------------------- | --------------------------------------------------------------------------- |
| campo                 | `sistema.posicionWindows` | `sistema.punteroWindows`                                                    |
| tipo                  | entero de 1 a 11          | entero de **1 a 20**                                                        |
| significado           | casilla del panel viejo   | valor del registro `MouseSensitivity` (el que devuelve `SPI_GETMOUSESPEED`) |
| `desconocido`         | sí                        | sí                                                                          |
| `no_aplica`           | no                        | no                                                                          |
| obligatorio           | sí                        | sí                                                                          |
| `version` del formato | 1                         | **1** (sin migrador)                                                        |

El mismo contrato lo adopta sens-lab en su `FASE_4_PUNTERO_EN_20_PUNTOS`: no se cambia de un solo lado, y por eso la tarea 5.5 de esta fase pasa el contrato real contra su código.

`posicionWindows` **desaparece**: no queda alias ni se acepta como entrada. El esquema es estricto, así que un documento que lo traiga se rechaza y el error nombra el campo.

Para llevar a mano un dato recordado en la escala vieja (posición → puntero): 1→1, 2→2, 3→4, 4→6, 5→8, 6→10, 7→12, 8→14, 9→16, 10→18, 11→20. Ladder-lab no calcula nada con eso: solo guarda el entero.

## Por qué se renombra en vez de ampliar el rango

Con el mismo nombre, un `6` viejo (×1,0 en la escala de 11) se leería en silencio como un `6` nuevo (×0,5 en la de 20): el mismo número con otra velocidad, sin que nada falle. Con otro nombre, un documento viejo falla con un mensaje claro que dice cuál es el campo. Un error visible cuesta menos que un dato equivocado que parece válido. Por eso los ejemplos publicados que decían `6` pasan a `10`: es la misma velocidad en la escala nueva.

## Por qué no sube la versión del formato

`DECISION_VERSIONADO_FORMATO.md`, sección «Mientras el formato no esté congelado»: hasta que Freddy lo congele con datos reales (tarea 1.12) el formato puede cambiar sin subir de versión **solo si** se actualizan la especificación, los fixtures y las pruebas (`formato-publicado.spec.ts` lo obliga) y se pasa el contrato contra sens-lab. Las tres condiciones están en esta fase (tareas 5.3, 5.4 y 5.5).

Y no hay nada que migrar: **la base tiene 0 estampas** (medido el 2026-11-10 con `listar_estampas` contra el servidor desplegado). Ningún respaldo ni exportación vieja lleva `posicionWindows`, así que un migrador v1→v2 no convertiría nada.

## Qué NO decide este ADR

- **No congela el formato.** La tarea 1.12 sigue esperando uso real.
- **No agrega multiplicadores ni conversiones a ladder-lab.** Convertir el puntero en un factor es de sens-lab.
- **No decide nada sobre `aceleracionWindows`.** Sigue como estaba.
- No agrega un campo que diga de qué equipo viene la estampa (anotado como idea, no pedido).

## Relacionado

- `DECISION_FORMATO_ESTAMPA_V1.md`: la fila de la tabla se corrigió y apunta a este ADR; su historia no se reescribió.
- `DECISION_VERSIONADO_FORMATO.md`: la regla que permite el cambio sin subir de versión.
- `DECISION_INTEGRACION_CONVERTIDOR.md`: cómo se verifica el contrato con sens-lab.
