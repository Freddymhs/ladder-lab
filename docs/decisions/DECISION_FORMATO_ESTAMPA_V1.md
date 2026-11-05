# DECISION: Formato JSON v1 de la estampa

Fecha: 2026-11-05
**Estado: aceptado por Freddy** (confirmación comunicada por orden en la sesión del 2026-11-05; sustituye a «revisado en sesión de control, pendiente de confirmación»). El esquema Zod ya está implementado a partir de este ADR (`src/domain/estampa/schema.ts`). El formato **no está congelado**: se congela en la tarea 1.12, con los primeros datos reales de Freddy (ver `docs/runbooks/PUESTA_EN_MARCHA.md`).

## Qué dice el concepto

Un modelo de dominio en prosa (`_CONCEPTO.md`, Modelo de dominio) y un JSON de ejemplo (Formato común) que no coinciden en todo: el ejemplo usa `null`, un solo string de mouse y un campo `windows`; el texto habla de `desconocido` / `no_aplica` y de dos campos de Windows. Este ADR sigue el texto y las decisiones de Freddy.

**Dónde este ADR corrige al concepto:** el concepto dice «todo campo obligatorio acepta `desconocido`». Por decisión recibida en la revisión de F0 (2026-11-05) **`juego.nombre`, `genero` y `certeza` no lo aceptan**. Este ADR manda sobre esa frase; `_CONCEPTO.md` no se reescribe (es documento de origen).

## Decisiones recibidas en la revisión que fijan el formato

- Cada campo va marcado con un **valor**, **`desconocido`** o **`no_aplica`**.
- `no_aplica` solo en `sensibilidad` y `rawInput`, cuando el juego no los tiene.
- `desconocido` en los obligatorios, **salvo** `juego.nombre`, `genero` y `certeza`.
- `genero` es solo `FPS` o `RTS`.
- `mouse` es **una sola casilla de texto** con marca y modelo juntos. No hay `mouse.marca` ni `mouse.modelo`.
- No existe `juegoDelLogro`: el juego ya está en la estampa.
- `derivadaDe` opcional; se rechaza la autorreferencia; no se validan ciclos largos en v1.
- Exportar varias estampas: arreglo de documentos dentro de un envoltorio con `formato` y `version`. **La exportación siempre lleva `id`** (ajuste posterior del 2026-11-05, ver «Exportación»): reemplaza la decisión anterior «`id` solo en respaldo».

## Representación de un campo

Un campo es una de tres cosas: un **valor** de su tipo, la cadena literal `"desconocido"` o la cadena literal `"no_aplica"` (solo donde se permite). **Nunca `null`.** Un campo **opcional** que no se registró **no aparece** en el JSON (ausente ≠ desconocido: ausente es «nadie lo pidió»; `desconocido` es «es obligatorio y no se sabe»).

Alternativa descartada: envolver cada campo como `{ "estado": …, "valor": … }`. Triplica el tamaño y obliga al convertidor a desenvolver cada campo; con las cadenas literales el estado ya viaja en el propio valor.

## Campos

«Obligatorio» = debe estar presente. La columna `desconocido` dice si acepta esa cadena. Los tipos de valor (rangos, `ANCHOxALTO`, `1–11`) son propuesta; no vienen del concepto.

| Bloque    | Campo                | Tipo del valor                        | `desconocido` | `no_aplica` | Notas                                                                                                                         |
| --------- | -------------------- | ------------------------------------- | ------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| raíz      | `formato`            | `"ladder-lab.estampa"`                | no            | no          | Constante                                                                                                                     |
| raíz      | `version`            | entero (`1`)                          | no            | no          | Versión del formato, no de la estampa                                                                                         |
| raíz      | `id`                 | texto (uuid)                          | no            | no          | **Siempre presente en toda exportación**; no se acepta como entrada de `crear_estampa` (lo genera la base). Ver «Exportación» |
| raíz      | `derivadaDe`         | el `id` de otra estampa               | no            | no          | **Opcional.** Referencia a un `id`. Ver «derivadaDe»                                                                          |
| raíz      | `notas`              | texto                                 | no            | no          | Opcional                                                                                                                      |
| juego     | `nombre`             | texto no vacío                        | **no**        | no          | Obligatorio                                                                                                                   |
| juego     | `genero`             | `FPS` \| `RTS`                        | **no**        | no          | Obligatorio. Solo esos dos valores                                                                                            |
| juego     | `etapa`              | texto no vacío                        | sí            | no          | Al menos `etapa` o `fecha` presente                                                                                           |
| juego     | `fecha`              | `YYYY-MM-DD`                          | sí            | no          | Al menos `etapa` o `fecha` presente                                                                                           |
| sistema   | `mouse`              | texto: marca y modelo                 | sí            | no          | Obligatorio. Una sola casilla                                                                                                 |
| sistema   | `dpi`                | entero > 0                            | sí            | no          | Obligatorio                                                                                                                   |
| sistema   | `polling`            | entero > 0 (Hz)                       | sí            | no          | Obligatorio                                                                                                                   |
| sistema   | `resolucion`         | `"ANCHOxALTO"` (p. ej. `1920x1080`)   | sí            | no          | Obligatorio                                                                                                                   |
| sistema   | `hz`                 | entero > 0                            | sí            | no          | Frecuencia del monitor. Obligatorio                                                                                           |
| sistema   | `posicionWindows`    | entero 1–11                           | sí            | no          | Velocidad del puntero. Obligatorio                                                                                            |
| sistema   | `aceleracionWindows` | `encendida` \| `apagada`              | sí            | no          | Obligatorio                                                                                                                   |
| sistema   | `versionWindows`     | texto                                 | no            | no          | Opcional                                                                                                                      |
| enJuego   | `sensibilidad`       | número > 0                            | sí            | **sí**      | Obligatorio                                                                                                                   |
| enJuego   | `rawInput`           | `encendido` \| `apagado`              | sí            | **sí**      | Obligatorio                                                                                                                   |
| enJuego   | `parametrosInicio`   | texto                                 | no            | no          | Opcional                                                                                                                      |
| enJuego   | `markC`              | booleano                              | no            | no          | Opcional                                                                                                                      |
| resultado | `rango`              | texto libre                           | sí            | no          | Obligatorio. Sin orden entre rangos en v1                                                                                     |
| resultado | `certeza`            | `medido` \| `recordado` \| `estimado` | **no**        | no          | Obligatorio                                                                                                                   |
| resultado | `matchPerfecto`      | booleano                              | no            | no          | Opcional. Lo usa `mejor_por_juego` (F2)                                                                                       |

## Ejemplo

```json
{
  "formato": "ladder-lab.estampa",
  "version": 1,
  "derivadaDe": "7d1c2f4e-0000-4000-8000-000000000001",
  "juego": {
    "nombre": "Counter-Strike",
    "genero": "FPS",
    "fecha": "2025-06-01"
  },
  "sistema": {
    "mouse": "Marca Modelo",
    "dpi": 450,
    "polling": 1000,
    "resolucion": "1920x1080",
    "hz": 240,
    "posicionWindows": 6,
    "aceleracionWindows": "apagada"
  },
  "enJuego": { "sensibilidad": "desconocido", "rawInput": "apagado" },
  "resultado": { "rango": "Global", "certeza": "recordado" }
}
```

Este es el documento de **entrada** (lo que recibe `crear_estampa`), por eso no lleva `id`. En una exportación, cada documento lleva además su `id` (ver «Exportación»).

Con un juego sin ajuste de sensibilidad o sin raw input (algunos RTS): `"sensibilidad": "no_aplica"` y/o `"rawInput": "no_aplica"`.

## derivadaDe

Del concepto (párrafo «Árbol»): «indica la estampa que dio origen a otra, por ejemplo una conversión probada en otro juego». Puede apuntar a una estampa de **otro juego**.

- Referencia al **`id`** de otra estampa (su identidad), no a una versión. Como la exportación siempre lleva `id`, quien lee un documento puede citar la estampa de origen y resolver `derivadaDe` contra los `id` del mismo envoltorio.
- Debe apuntar a una estampa que existe: clave foránea en la base y comprobación en la herramienta.
- **Se rechaza la autorreferencia** (una estampa no puede derivar de sí misma): comprobación en `corregir_estampa` (donde el id ya existe), `CHECK (derivada_de <> id)` en la base e importación. En `crear_estampa` no puede ocurrir: el id aún no existe al crearla.
- **No se validan ciclos largos en v1** (A deriva de B, B de A, o cadenas mayores). Si algún día se recorre el árbol, quien lo recorra debe protegerse contra ciclos; en v1 nada lo recorre.
- Es un dato más de la estampa: se corrige con una versión nueva y no cambia su identidad. No copia datos del origen.

## Exportación

`exportar` devuelve un **envoltorio** con un arreglo de documentos, no un documento suelto:

```json
{
  "formato": "ladder-lab.export",
  "version": 1,
  "estampas": [
    {
      "formato": "ladder-lab.estampa",
      "version": 1,
      "id": "7d1c2f4e-0000-4000-8000-000000000001",
      "…": "…"
    }
  ]
}
```

- Cada elemento de `estampas` es un documento `ladder-lab.estampa` completo, validado con el mismo esquema, **más su `id`**.
- **El `id` va siempre**, en toda exportación (ajuste del 2026-11-05). Motivo: sens-lab, que consume este JSON, debe poder citar la estampa de origen para crear una estampa con `derivadaDe`, y `derivadaDe` es una referencia a ese id.
- Sin `incluirVersiones` se exporta solo la versión vigente de cada estampa. Con `incluirVersiones` la misma estampa se repite una vez por versión, así que cada documento necesita además el número de versión de la estampa: propongo el campo `numeroVersion`, para no chocar con `version` (versión del formato). **Solo aparece con `incluirVersiones`.** _(Nombre propuesto por mí, no decidido.)_
- La exportación incluye también las **estampas archivadas** (F3), para que ningún `derivadaDe` apunte a un id ausente. _(Consecuencia que deduzco de lo anterior; a confirmar.)_
- `importar_json` (F3) lee este envoltorio; con `id` puede reconocer estampas que ya existen.

Ya no hay dos formatos («normal» y «respaldo»): hay uno, con `id`, y la única variante es `incluirVersiones`.

## Conflicto resuelto: `derivadaDe` y la exportación sin id

Estado: **resuelto el 2026-11-05** por la opción 3 de las tres que este ADR planteaba.

`derivadaDe` es el id de otra estampa y la decisión anterior decía que la exportación normal no llevaba `id`: el vínculo quedaba apuntando a un id que ningún documento declara. Se resolvió haciendo que **los documentos exportados lleven siempre `id`**, y `derivadaDe` queda como referencia a ese id. Se descartó omitir `derivadaDe` en la exportación normal (el consumidor perdería el árbol) y dejarlo como referencia opaca (dato sin sentido por sí solo).

## Ampliación por F3: campo `archivada` en la exportación

Este ADR decía que la exportación incluye las estampas archivadas (para que ningún `derivadaDe` quede colgado), pero un documento exportado no decía si la estampa estaba archivada: al restaurar, todas volverían como visibles. Se añade el campo **`archivada: true`**, presente **solo** cuando la estampa está archivada y solo en documentos exportados (igual que `id`). Una estampa no archivada no lleva el campo. El esquema lo acepta únicamente como `true`. _(Ampliación mía, necesaria para que respaldar y restaurar sea una ida y vuelta fiel; a confirmar con Freddy.)_

## Qué queda abierto

- El nombre `numeroVersion` (propuesta mía; ya implementado, renombrar cuesta un cambio de esquema y de fixtures).
- Que la exportación incluya estampas archivadas y el campo `archivada` (deducciones mías, implementadas).
- Congelar el formato v1 con datos reales (tarea 1.12).
