# DECISION: La estampa guarda la configuración del sistema y del juego con campos opcionales, dentro del mismo formato v1

Fecha: 2026-11-14 (tarea 6.1 de FASE_6)
**Estado: ordenado por Freddy** (2026-11-14: validó el esquema con «sí, creo que está bien»). Implementado en `src/domain/estampa/`. Reemplaza dos propuestas descartadas el mismo día: campos tipados «de todo» (40) y una entidad `configuración` aparte de la estampa.

## Qué pasó

Freddy dejó el PC de juegos en una configuración que le gusta mucho más (la base RTS) y quiere repetirla en otro equipo, por ejemplo en un torneo. No cabía: el esquema es cerrado y HDR, Auto HDR, Night Light, Game Mode, las opciones de compatibilidad del ejecutable o el `Variables.txt` de StarCraft no tenían dónde ir; terminaban como texto en `notas`.

Palabras de Freddy: «una configuración es del Windows y la otra del juego. O configuración de sistema, para hacerlo más agnóstico»; «si la configuración tiene eso, ¿por qué lo sacaríamos afuera? Eso sería un DRY muy malo»; «la idea es básicamente copiar y pegar [el archivo de configuración]».

## Decisión

1. **Una sola entidad: la estampa.** `juego` ya identifica el juego; no hay `equipo`, `estampaId` ni entidad nueva.
2. **Dos bloques, agnósticos del sistema operativo**: `sistema` (configuración del sistema) y `enJuego` (configuración del juego). Los campos nuevos no dicen «Windows» (por si el sistema cambia), salvo los dos que ya existían con ese nombre.
3. **Campos nuevos, todos opcionales**, y los que son un dato aceptan `desconocido` (nunca `null`):
   - `sistema.pantalla`: `escalaPct`, `hdr`, `autoHdr`, `nightLight` (`estado` e `intensidad`), `perfilColor`, `vrr`.
   - `sistema.entrada`: `tecladoRetardo` (0-3), `tecladoVelocidad` (0-31).
   - `sistema.general`: `uac`, `modoJuego`, `gameDvr`, `planEnergia`, `suspensionUsb`, `exclusionesAntivirus` (lista).
   - `enJuego`: `modoPantalla`, `topeFps`, `vsync`, `resolucionJuego`, `ejecutable` (`ruta`, `optimizacionesPantallaCompleta`, `ejecutarComoAdmin`, `dpiOverride`) y `archivosConfig` (lista de `{ruta, contenido}`).
4. **Los archivos de configuración del juego se guardan enteros, como texto** (hasta 10, de hasta 64 KB cada uno; el tope cuenta bytes). No se parsean. Restaurar = escribir ese texto en esa ruta. Por eso no hay campos para idioma, perfil de teclas, versión del juego ni claves sueltas del juego: el archivo ya las lleva.
5. **El formato sigue en `version: 1`.** Son campos opcionales nuevos, compatibles (`DECISION_VERSIONADO_FORMATO.md`); no cambia ningún campo existente, no hay migrador y una estampa vieja sigue válida. La base no necesita migración (el documento es `jsonb`). sens-lab ignora lo que no conoce: contrato verificado con su código real.
6. **Quién lee y aplica el PC es la IA de ese PC; ladder-lab solo guarda y entrega.** El servidor corre en el Mac Mini y nunca toca el equipo. Para guardar: Claude Code lee lo que puede, pregunta lo que no, y llama a `crear_estampa`. Para aplicar en otro equipo: lee la estampa con `ver_estampa`, muestra qué cambiaría y escribe solo con la confirmación del usuario. No hay script ni herramienta nueva.

## Lo que se dejó fuera (a pedido de Freddy)

Modelo del monitor, GPU, orientación, compilación y versión fijada de Windows, actualizaciones diferidas, versión del parche, «es el más nuevo», origen usuario/máquina, banderas crudas, accesibilidad del teclado, perfil de G Hub. Tampoco `punteroPrecision`: es el mismo ajuste que `aceleracionWindows` (dos campos para un dato se contradirían).

## Límites que hay que saber

- **DPI y polling del mouse** viven en el mouse, no en el sistema: se anotan a mano como hasta ahora y una IA no puede aplicarlos en un PC prestado.
- **Hardware distinto**: HDR, VRR, perfil de color y escala dependen del monitor y la GPU del equipo destino.
- **Permisos**: UAC y las exclusiones del antivirus piden administrador y pueden pedir reinicio.
- **Datos de cuenta**: un archivo de juego puede traer nombre de usuario o rutas con el usuario de Windows. La descripción de `crear_estampa` pide a la IA no guardar credenciales y revisar los archivos antes de enviarlos.
- **Listas**: `corregir_estampa` reemplaza una lista entera (`archivosConfig`, `exclusionesAntivirus`); hay que enviarla completa.
- **`comparar_estampas`** trata una lista como un valor: si cambia un archivo, muestra los dos textos completos.

## Por confirmar con Freddy

- Los valores de `uac` (`siempre_notificar`, `predeterminado`, `sin_atenuar_escritorio`, `nunca`), de `dpiOverride` (`aplicacion`, `sistema`, `sistema_mejorado`, `predeterminado`) y de `modoPantalla` son propuesta (el texto de origen llegó cortado); `nightLight.intensidad` va de 0 a 100.
- Idioma y colores/tema del sistema no están en la lista; se agregan si los quiere.
- Géneros nuevos (MOBA, ARPG): agregar un valor al enum exige `version: 2`; sigue abierto.

## Relacionado

- `DECISION_VERSIONADO_FORMATO.md`: por qué no sube la versión.
- `DECISION_FORMATO_ESTAMPA_V1.md`, `DECISION_PUNTERO_WINDOWS_20.md`: el formato base y el precedente de un cambio sin subir versión.
