# FASE 6: CONFIGURACIÓN DEL SISTEMA Y DEL JUEGO EN LA ESTAMPA

**Destraba**: guardar la configuración del PC de juegos que a Freddy le gusta (la base RTS) y poder repetirla en otro equipo (por ejemplo, un torneo) pidiéndoselo a Claude Code.
**Prioridad**: Alta
**Dependencias**: FASE_1, FASE_4 y FASE_5. No cambia la base de datos (el documento es `jsonb`).
**Estado**: HECHA EN LOCAL el 2026-11-14 (6/7). Falta la tarea 6.7 (sellar, push, CI y despliegue), que espera la orden de Freddy. Nada commiteado.
**Origen**: Freddy, 2026-11-14: «lo que necesito es que yo utilizo Claude Code […] llamo al MCP y le digo: utiliza este MCP para registrar la configuración de mi Windows y de este juego […] y si algún día le digo "configura mi computador con la configuración de este computador", me dice: ya vamos a aplicarlo todo». Validó el esquema final con «sí, creo que está bien».

> Diseño, lo que se dejó fuera y los límites: [`DECISION_CONFIGURACION_COMPLETA.md`](../decisions/DECISION_CONFIGURACION_COMPLETA.md).
> Una sola entidad (la estampa), dos bloques: `sistema` y `enJuego`. Campos opcionales nuevos; el formato sigue en `version: 1` y sens-lab no cambia.
> La IA del PC lee y aplica; el MCP solo guarda y entrega, y nunca toca el equipo.

## Cómo se usa

- **Guardar:** en el PC de juegos, a Claude Code: «usa ladder-lab para registrar la configuración de mi sistema y de este juego». Lee lo que puede, pregunta lo que no, y llama a `crear_estampa`.
- **Aplicar:** en otro PC: «aplica la estampa X a este equipo y al juego». Llama a `ver_estampa`, muestra qué cambiaría y, con tu confirmación, lo aplica.

## Orden de ejecución

1. 6.1 ADR → 2. 6.2 esquema y constantes → 3. 6.3 especificación y fixture → 4. 6.4 pruebas del esquema → 5. 6.5 herramientas → 6. 6.6 contrato con sens-lab → 7. 6.7 sellar y desplegar

## Tareas

### Tarea 6.1: ADR — HECHA

`docs/decisions/DECISION_CONFIGURACION_COMPLETA.md`. Dos diseños descartados por Freddy antes de llegar al final (40 campos tipados; entidad aparte).

### Tarea 6.2: Esquema y constantes — HECHA

`src/domain/estampa/constants.ts` y `schema.ts`: `sistema.pantalla`, `sistema.entrada`, `sistema.general`, y en `enJuego` `modoPantalla`, `topeFps`, `vsync`, `resolucionJuego`, `ejecutable` y `archivosConfig` (tope de 10 archivos y 64 KB, contado en bytes). `ESTADOS_RAW_INPUT` pasó a `ESTADOS_ENCENDIDO` (un solo interruptor para todos los campos encendido/apagado).

### Tarea 6.3: Especificación y fixture — HECHA

`docs/formato/ladder-lab.estampa.v1.md`: 24 filas nuevas, nota de que son opcionales y no cambian la versión. Fixture nuevo `docs/formato/ejemplos/estampa-completa.json` (datos inventados). `formato-publicado.spec.ts` usa ese fixture como base, así que cualquier fila de la tabla se puede quitar o cambiar.

### Tarea 6.4: Pruebas del esquema — HECHA

`src/domain/estampa/__tests__/schema-configuracion.spec.ts`: extremos válidos y rojos de cada rango y enum, `null` rechazado, claves que se quitaron rechazadas, ejecutable sin ruta, tope de archivos y de bytes (una «é» ocupa dos), el texto del archivo vuelve idéntico (CRLF, tabulaciones, acentos), y corregir un bloque no borra a sus hermanos.

### Tarea 6.5: Herramientas — HECHA

`crear_estampa` y `corregir_estampa` ya derivan del esquema; se actualizaron sus descripciones (campos nuevos, «no guardes contraseñas, tokens ni datos de cuenta», «las listas se reemplazan enteras»). `src/tools/__tests__/configuracion.tool.spec.ts`: crear/ver idénticos, corregir parcial con versión 1 conservada, lista inválida rechazada sin escribir, exportar e importar ida y vuelta. `contrato.ts` suma un caso que corre contra el repositorio en memoria y contra PostgREST real.

### Tarea 6.6: Contrato real contra sens-lab — HECHA

`scripts/verificar-con-sens-lab.sh` sale 0 (13 comprobaciones; sens-lab importa `estampa-completa.json`). Control rojo: con `"version": 2` en el fixture sale 1.

### Tarea 6.7: Sellar, push, CI y despliegue — PENDIENTE (orden de Freddy)

`/work:sellar:run`, commit y push solo cuando Freddy lo ordene (sin firma de IA); CI en verde; `deploy/desplegar.sh` solo con orden explícita (el push no despliega). Comprobar en el servidor, **sin crear estampas**, que `crear_estampa` declara los campos nuevos. La primera estampa real la carga Freddy desde el PC de juegos.

## Fuera de alcance

- Scripts de captura o de restauración, y `comprobar_estampa`: la IA del PC hace ese trabajo.
- Idioma y colores/tema del sistema (no están en la lista; se agregan si Freddy los pide).
- Géneros nuevos (exige `version: 2`), `desarchivar_estampa` y congelar el formato (tarea 1.12).

## Criterios de Aceptacion

- [x] ADR aceptado por Freddy; valores de `uac`, `dpiOverride` y `modoPantalla` quedan «por confirmar» dentro del ADR.
- [x] Una estampa vieja (sin los bloques nuevos) sigue válida.
- [x] Los campos nuevos aceptan su valor y `desconocido`; rechazan `null`, enums inválidos, rangos y claves extra.
- [x] El archivo de configuración se guarda y vuelve idéntico; se rechaza lo que pasa el tope.
- [x] La especificación, el fixture y el esquema dicen lo mismo (`formato-publicado.spec.ts` en verde).
- [x] `crear_estampa`, `corregir_estampa`, `exportar` e `importar_json` funcionan con los campos nuevos; repositorio en memoria y PostgREST real pasan el mismo contrato.
- [x] `scripts/verificar-con-sens-lab.sh` sale 0.
- [ ] Sellado, pusheado y desplegado por orden de Freddy; comprobado sin crear estampas.

## Resultados de la ejecución (2026-11-14)

`pnpm lint`, `pnpm type-check`, `pnpm build` y `pnpm test` en verde (22 archivos, **571 pruebas**, antes 440); integración contra contenedores desechables 87/87 (antes 86). Contrato con sens-lab: exit 0. **Rojos provocados:** (1) `TECLADO_RETARDO_MAX` en 4 → cae «tecladoRetardo rechaza 4»; (2) el tope contando letras en vez de bytes → cae la prueba de la «é»; (3) la tabla diciendo que `nightLight.estado` no es obligatorio → cae la prueba de obligatorio; (4) fixture con `"version": 2` → el contrato sale 1. Los cuatro revertidos. Nota: `sens-lab` tiene cambios sin commitear de otra sesión (`src/domain/juegos/catalogo.ts`); el contrato se verificó con ese árbol de trabajo.
