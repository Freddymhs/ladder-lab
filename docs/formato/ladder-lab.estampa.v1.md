# Formato `ladder-lab.estampa` v1

Especificación del JSON que produce `ladder-lab` (herramienta `exportar`, comando `pnpm respaldo`) y que consume el convertidor (sens-lab). **Es lo que debe leer quien escriba un consumidor**: no hace falta leer el código ni el esquema Zod (los dos productos no comparten código).

Estado: v1, **no congelado** hasta que Freddy lo marque con datos reales (`docs/decisions/DECISION_FORMATO_ESTAMPA_V1.md`). Política de cambios: `docs/decisions/DECISION_VERSIONADO_FORMATO.md`. Esta tabla está protegida por una prueba (`src/domain/estampa/__tests__/formato-publicado.spec.ts`): si el esquema cambia y este documento no, la prueba falla.

## Lo que un consumidor debe hacer

1. **Comprobar `formato` y `version`** antes de leer nada más. Si la versión no es la que conoce, **rechazar con un mensaje claro** (no adivinar).
2. **Ignorar los campos que no conoce.** Dentro de una versión solo se agregan campos opcionales; un consumidor estricto se rompería sin motivo.
3. **Tratar `"desconocido"` y `"no_aplica"` como «sin dato»**, nunca como un valor. Un campo es un valor, una de esas dos cadenas, o (si es opcional) no aparece. **Nunca `null`.**
4. **No inventar lo que falta.** Si la estampa no permite deducir algo, que lo complete el usuario.

## Envoltorio de exportación

`exportar` devuelve un envoltorio con un arreglo de documentos:

```json
{
  "formato": "ladder-lab.export",
  "version": 1,
  "estampas": [
    {
      "formato": "ladder-lab.estampa",
      "version": 1,
      "id": "7d1c2f4e-0000-4000-8000-000000000001",
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
        "punteroWindows": 10,
        "aceleracionWindows": "apagada"
      },
      "enJuego": { "sensibilidad": 1.8, "rawInput": "encendido" },
      "resultado": {
        "rango": "Global",
        "certeza": "medido",
        "matchPerfecto": true
      }
    }
  ]
}
```

- **Todo documento exportado lleva `id`** (uuid). Con él se cita la estampa de origen: `derivadaDe` es el `id` de otra estampa y se resuelve contra los `id` del mismo envoltorio.
- Sin `incluirVersiones` se exporta **solo la versión vigente** de cada estampa. Con `incluirVersiones` la misma estampa se repite una vez por versión y cada documento lleva `numeroVersion` (1, 2, 3… sin saltos).
- La exportación incluye también las **estampas archivadas**, marcadas con `archivada: true`. Una estampa no archivada no lleva el campo.
- Un documento suelto (sin envoltorio) es el mismo objeto con `"formato": "ladder-lab.estampa"` y **sin** `id`: es lo que recibe `crear_estampa`.

## Campos

Columnas: **obligatorio** (`sí` / `no` / `solo exportación`), y si el campo acepta la cadena **`desconocido`** o **`no_aplica`**. El tipo es el del valor cuando hay un valor.

| campo                                               | tipo                                                                      | obligatorio      | desconocido | no_aplica | notas                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------- | ---------------- | ----------- | --------- | --------------------------------------------------------------------------------------------- |
| `formato`                                           | `"ladder-lab.estampa"`                                                    | sí               | —           | —         | constante                                                                                     |
| `version`                                           | `1`                                                                       | sí               | —           | —         | versión del formato, no de la estampa                                                         |
| `id`                                                | uuid                                                                      | solo exportación | —           | —         | identidad de la estampa                                                                       |
| `numeroVersion`                                     | entero ≥ 1                                                                | solo exportación | —           | —         | solo con `incluirVersiones`                                                                   |
| `archivada`                                         | `true`                                                                    | solo exportación | —           | —         | solo si la estampa está archivada                                                             |
| `derivadaDe`                                        | uuid                                                                      | no               | no          | no        | el `id` de la estampa de la que parte esta; puede ser de otro juego                           |
| `notas`                                             | texto                                                                     | no               | no          | no        | texto libre                                                                                   |
| `juego.nombre`                                      | texto no vacío                                                            | sí               | no          | no        |                                                                                               |
| `juego.genero`                                      | `FPS` o `RTS`                                                             | sí               | no          | no        |                                                                                               |
| `juego.etapa`                                       | texto no vacío                                                            | no               | sí          | no        | al menos `etapa` o `fecha`                                                                    |
| `juego.fecha`                                       | `YYYY-MM-DD`                                                              | no               | sí          | no        | al menos `etapa` o `fecha`; debe existir en el calendario                                     |
| `sistema.mouse`                                     | texto: marca y modelo juntos                                              | sí               | sí          | no        | una sola casilla                                                                              |
| `sistema.dpi`                                       | entero > 0                                                                | sí               | sí          | no        |                                                                                               |
| `sistema.polling`                                   | entero > 0 (Hz)                                                           | sí               | sí          | no        |                                                                                               |
| `sistema.resolucion`                                | `ANCHOxALTO`, p. ej. `1920x1080`                                          | sí               | sí          | no        |                                                                                               |
| `sistema.hz`                                        | entero > 0                                                                | sí               | sí          | no        | frecuencia del monitor                                                                        |
| `sistema.punteroWindows`                            | entero de 1 a 20                                                          | sí               | sí          | no        | velocidad del puntero de Windows (valor de `MouseSensitivity`)                                |
| `sistema.aceleracionWindows`                        | `encendida` o `apagada`                                                   | sí               | sí          | no        |                                                                                               |
| `sistema.versionWindows`                            | texto                                                                     | no               | no          | no        |                                                                                               |
| `sistema.pantalla.escalaPct`                        | entero > 0                                                                | no               | sí          | no        | escala de la pantalla en %, p. ej. 100                                                        |
| `sistema.pantalla.hdr`                              | `encendido` o `apagado`                                                   | no               | sí          | no        |                                                                                               |
| `sistema.pantalla.autoHdr`                          | `encendido` o `apagado`                                                   | no               | sí          | no        |                                                                                               |
| `sistema.pantalla.nightLight.estado`                | `encendido` o `apagado`                                                   | sí               | sí          | no        | obligatorio dentro de `nightLight`                                                            |
| `sistema.pantalla.nightLight.intensidad`            | entero de 0 a 100                                                         | no               | sí          | no        |                                                                                               |
| `sistema.pantalla.perfilColor`                      | texto                                                                     | no               | sí          | no        | nombre del perfil de color asignado                                                           |
| `sistema.pantalla.vrr`                              | `encendido` o `apagado`                                                   | no               | sí          | no        | VRR / G-Sync                                                                                  |
| `sistema.entrada.tecladoRetardo`                    | entero de 0 a 3                                                           | no               | sí          | no        |                                                                                               |
| `sistema.entrada.tecladoVelocidad`                  | entero de 0 a 31                                                          | no               | sí          | no        |                                                                                               |
| `sistema.general.uac`                               | `siempre_notificar`, `predeterminado`, `sin_atenuar_escritorio` o `nunca` | no               | sí          | no        |                                                                                               |
| `sistema.general.modoJuego`                         | `encendido` o `apagado`                                                   | no               | sí          | no        |                                                                                               |
| `sistema.general.gameDvr`                           | `encendido` o `apagado`                                                   | no               | sí          | no        |                                                                                               |
| `sistema.general.planEnergia`                       | texto                                                                     | no               | sí          | no        |                                                                                               |
| `sistema.general.suspensionUsb`                     | `encendido` o `apagado`                                                   | no               | sí          | no        |                                                                                               |
| `sistema.general.exclusionesAntivirus`              | lista de textos                                                           | no               | sí          | no        | rutas o procesos excluidos del antivirus                                                      |
| `enJuego.sensibilidad`                              | número > 0                                                                | sí               | sí          | sí        | `no_aplica` si el juego no la tiene                                                           |
| `enJuego.rawInput`                                  | `encendido` o `apagado`                                                   | sí               | sí          | sí        | `no_aplica` si el juego no lo tiene                                                           |
| `enJuego.parametrosInicio`                          | texto                                                                     | no               | no          | no        |                                                                                               |
| `enJuego.markC`                                     | booleano                                                                  | no               | no          | no        |                                                                                               |
| `enJuego.modoPantalla`                              | `completa_exclusiva`, `ventana_sin_bordes` o `ventana`                    | no               | sí          | no        |                                                                                               |
| `enJuego.topeFps`                                   | entero > 0 o `sin_tope`                                                   | no               | sí          | no        | cuadros por segundo máximos                                                                   |
| `enJuego.vsync`                                     | `encendido` o `apagado`                                                   | no               | sí          | no        |                                                                                               |
| `enJuego.resolucionJuego`                           | `ANCHOxALTO`, p. ej. `1920x1080`                                          | no               | sí          | no        | resolución dentro del juego                                                                   |
| `enJuego.ejecutable.ruta`                           | texto no vacío                                                            | sí               | no          | no        | obligatoria dentro de `ejecutable`: ruta del .exe del juego                                   |
| `enJuego.ejecutable.optimizacionesPantallaCompleta` | booleano                                                                  | no               | sí          | no        |                                                                                               |
| `enJuego.ejecutable.ejecutarComoAdmin`              | booleano                                                                  | no               | sí          | no        |                                                                                               |
| `enJuego.ejecutable.dpiOverride`                    | `aplicacion`, `sistema`, `sistema_mejorado` o `predeterminado`            | no               | sí          | no        |                                                                                               |
| `enJuego.archivosConfig`                            | lista de `{ruta, contenido}`                                              | no               | no          | no        | hasta 10 archivos de hasta 64 KB; `contenido` es el texto entero del archivo, sin interpretar |
| `resultado.rango`                                   | texto libre                                                               | sí               | sí          | no        | no hay un orden de rangos                                                                     |
| `resultado.certeza`                                 | `medido`, `recordado` o `estimado`                                        | sí               | no          | no        |                                                                                               |
| `resultado.matchPerfecto`                           | booleano                                                                  | no               | no          | no        |                                                                                               |

Los campos de `sistema.pantalla`, `sistema.entrada`, `sistema.general` y los nuevos de `enJuego` son **opcionales y se agregaron sin cambiar la versión** (`DECISION_CONFIGURACION_COMPLETA.md`): una estampa vieja sigue siendo válida. `sistema` y `enJuego` describen el sistema operativo y el juego sin atarse a Windows, salvo los campos que ya llevaban `Windows` en el nombre.

Cualquier otra clave en un documento **de ladder-lab** se rechaza (el esquema es estricto al escribir); un consumidor, en cambio, debe ignorarlas.

## Ejemplo con valores especiales

Un RTS sin sensibilidad ni raw input, con el DPI sin recordar y derivado de otra estampa:

```json
{
  "formato": "ladder-lab.estampa",
  "version": 1,
  "derivadaDe": "7d1c2f4e-0000-4000-8000-000000000001",
  "juego": {
    "nombre": "StarCraft II",
    "genero": "RTS",
    "etapa": "Temporada 3"
  },
  "sistema": {
    "mouse": "Marca Modelo",
    "dpi": "desconocido",
    "polling": 1000,
    "resolucion": "2560x1440",
    "hz": 144,
    "punteroWindows": 10,
    "aceleracionWindows": "apagada",
    "versionWindows": "Windows 11"
  },
  "enJuego": {
    "sensibilidad": "no_aplica",
    "rawInput": "no_aplica",
    "markC": false
  },
  "resultado": { "rango": "Diamante", "certeza": "estimado" },
  "notas": "Dato de DPI no recordado"
}
```

## Fixtures

En `docs/formato/ejemplos/`, los mismos que usan las pruebas de contrato de ladder-lab (una sola copia): `estampa-fps.json`, `estampa-rts-no-aplica.json`, `estampa-completa.json` (con todos los campos opcionales de configuración, datos inventados), `export-vigentes.json` y `export-con-versiones.json`.

## Qué no cubre este formato

- **Los instantes de creación** de la estampa y de cada versión no se exportan (una restauración les pone la hora de la restauración).
- **No hay un orden de rangos** ni nada que diga cuál configuración es mejor: el formato guarda lo registrado, no lo juzga.
