export const DESCONOCIDO = 'desconocido' as const;
export const NO_APLICA = 'no_aplica' as const;

export const GENERO_FPS = 'FPS' as const;
export const GENERO_RTS = 'RTS' as const;
export const GENEROS = [GENERO_FPS, GENERO_RTS] as const;
export type Genero = (typeof GENEROS)[number];

export const CERTEZAS = ['medido', 'recordado', 'estimado'] as const;
export type Certeza = (typeof CERTEZAS)[number];

export const ACELERACIONES_WINDOWS = ['encendida', 'apagada'] as const;
export const ESTADOS_RAW_INPUT = ['encendido', 'apagado'] as const;

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
