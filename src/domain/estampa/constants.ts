export const DESCONOCIDO = 'desconocido' as const;
export const NO_APLICA = 'no_aplica' as const;

export const GENERO_FPS = 'FPS' as const;
export const GENERO_RTS = 'RTS' as const;
export const GENEROS = [GENERO_FPS, GENERO_RTS] as const;
export type Genero = (typeof GENEROS)[number];

export const CERTEZAS = ['medido', 'recordado', 'estimado'] as const;
export type Certeza = (typeof CERTEZAS)[number];

export const ACELERACIONES_WINDOWS = ['encendida', 'apagada'] as const;
/** Interruptor de Windows o del juego: raw input, HDR, VSync, Game Mode… */
export const ESTADOS_ENCENDIDO = ['encendido', 'apagado'] as const;

export const NIVELES_UAC = [
  'siempre_notificar',
  'predeterminado',
  'sin_atenuar_escritorio',
  'nunca',
] as const;

export const DPI_OVERRIDES = [
  'aplicacion',
  'sistema',
  'sistema_mejorado',
  'predeterminado',
] as const;

export const MODOS_PANTALLA = [
  'completa_exclusiva',
  'ventana_sin_bordes',
  'ventana',
] as const;

/** Valor de `enJuego.topeFps` cuando el juego no limita los cuadros por segundo. */
export const TOPE_FPS_SIN_TOPE = 'sin_tope' as const;

export const TECLADO_RETARDO_MAX = 3;
export const TECLADO_VELOCIDAD_MAX = 31;
export const NIGHT_LIGHT_INTENSIDAD_MAX = 100;

/** Archivos de configuración del juego guardados enteros dentro de la estampa. */
export const ARCHIVOS_CONFIG_MAX = 10;
export const ARCHIVO_CONFIG_BYTES_MAX = 65_536;

export const FORMATO_ESTAMPA = 'ladder-lab.estampa' as const;
export const FORMATO_EXPORT = 'ladder-lab.export' as const;
export const FORMATO_VERSION = 1 as const;

export const PUNTERO_WINDOWS_MIN = 1;
export const PUNTERO_WINDOWS_MAX = 20;

export const PATRON_RESOLUCION = /^\d{3,5}x\d{3,5}$/;
export const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const LISTADO_LIMITE_POR_DEFECTO = 50;
export const LISTADO_LIMITE_MAXIMO = 200;

export const COMPARAR_MINIMO = 2;
export const COMPARAR_MAXIMO = 10;
