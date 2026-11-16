import { z } from 'zod';
import {
  ACELERACIONES_WINDOWS,
  ARCHIVO_CONFIG_BYTES_MAX,
  ARCHIVOS_CONFIG_MAX,
  CERTEZAS,
  DESCONOCIDO,
  DPI_OVERRIDES,
  ESTADOS_ENCENDIDO,
  FORMATO_ESTAMPA,
  FORMATO_EXPORT,
  FORMATO_VERSION,
  GENEROS,
  MODOS_PANTALLA,
  NIGHT_LIGHT_INTENSIDAD_MAX,
  NIVELES_UAC,
  NO_APLICA,
  PATRON_FECHA,
  PATRON_RESOLUCION,
  PUNTERO_WINDOWS_MAX,
  PUNTERO_WINDOWS_MIN,
  TECLADO_RETARDO_MAX,
  TECLADO_VELOCIDAD_MAX,
  TOPE_FPS_SIN_TOPE,
} from './constants.js';

const esFechaReal = (valor: string): boolean => {
  const fecha = new Date(`${valor}T00:00:00Z`);
  return (
    !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(valor)
  );
};

const fechaIso = z
  .string()
  .regex(PATRON_FECHA, 'Usa el formato YYYY-MM-DD')
  .refine(esFechaReal, 'La fecha no existe en el calendario');

const desconocido = z.literal(DESCONOCIDO);

/**
 * Texto que NO acepta ninguna palabra reservada: es un dato, no un marcador.
 * Sin esto `nombre: "desconocido"` pasaría como un nombre más.
 */
const noEsPalabraReservada = (v: string) =>
  v !== DESCONOCIDO && v !== NO_APLICA;
const MENSAJE_PALABRA_RESERVADA = `"${DESCONOCIDO}" y "${NO_APLICA}" son valores reservados aquí`;

const textoLibre = z
  .string()
  .min(1)
  .refine(noEsPalabraReservada, { message: MENSAJE_PALABRA_RESERVADA });

/**
 * Como `textoLibre`, pero recorta los bordes antes de validar: el nombre del
 * juego es la clave con la que se busca la estampa activa («StarCraft II »
 * no debe ser otro juego). Los demás textos libres se guardan tal cual.
 */
const nombreDeJuego = z
  .string()
  .trim()
  .min(1)
  .refine(noEsPalabraReservada, { message: MENSAJE_PALABRA_RESERVADA });

/** Texto que acepta `desconocido` (campo obligatorio) pero nunca `no_aplica`. */
const textoOConocido = z
  .string()
  .min(1)
  .refine((v) => v !== NO_APLICA, {
    message: `"${NO_APLICA}" no se acepta en este campo`,
  });
const noAplica = z.literal(NO_APLICA);

/** Un valor, o la cadena `desconocido`. Nunca `null`. */
const oDesconocido = <T extends z.ZodTypeAny>(valor: T) =>
  z.union([valor, desconocido]);

/** `encendido`, `apagado` o `desconocido`: un interruptor del sistema o del juego. */
const interruptor = z.enum([...ESTADOS_ENCENDIDO, DESCONOCIDO]);

const nightLightSchema = z
  .object({
    estado: interruptor,
    intensidad: oDesconocido(
      z.number().int().min(0).max(NIGHT_LIGHT_INTENSIDAD_MAX),
    ).optional(),
  })
  .strict();

const pantallaSchema = z
  .object({
    escalaPct: oDesconocido(z.number().int().positive())
      .optional()
      .describe('Escala de la pantalla en %, p. ej. 100'),
    hdr: interruptor.optional(),
    autoHdr: interruptor.optional(),
    nightLight: nightLightSchema.optional(),
    perfilColor: textoOConocido
      .optional()
      .describe('Nombre del perfil de color asignado'),
    vrr: interruptor.optional().describe('VRR / G-Sync'),
  })
  .strict();

const entradaSchema = z
  .object({
    tecladoRetardo: oDesconocido(
      z.number().int().min(0).max(TECLADO_RETARDO_MAX),
    ).optional(),
    tecladoVelocidad: oDesconocido(
      z.number().int().min(0).max(TECLADO_VELOCIDAD_MAX),
    ).optional(),
  })
  .strict();

const generalSchema = z
  .object({
    uac: z.enum([...NIVELES_UAC, DESCONOCIDO]).optional(),
    modoJuego: interruptor.optional(),
    gameDvr: interruptor.optional(),
    planEnergia: textoOConocido.optional(),
    suspensionUsb: interruptor.optional(),
    exclusionesAntivirus: oDesconocido(z.array(textoLibre))
      .optional()
      .describe('Lista de rutas o procesos excluidos del antivirus'),
  })
  .strict();

const juegoSchema = z
  .object({
    nombre: nombreDeJuego.describe('Nombre del juego'),
    genero: z.enum(GENEROS).describe('FPS o RTS'),
    etapa: textoOConocido
      .optional()
      .describe('Etapa o momento (texto); al menos etapa o fecha'),
    fecha: oDesconocido(fechaIso)
      .optional()
      .describe('Fecha YYYY-MM-DD o "desconocido"; al menos etapa o fecha'),
  })
  .strict();

const sistemaSchema = z
  .object({
    mouse: textoOConocido.describe('Marca y modelo del mouse, en un texto'),
    dpi: oDesconocido(z.number().int().positive()),
    polling: oDesconocido(z.number().int().positive()).describe('Hz'),
    resolucion: oDesconocido(
      z.string().regex(PATRON_RESOLUCION, 'Usa ANCHOxALTO, p. ej. 1920x1080'),
    ),
    hz: oDesconocido(z.number().int().positive()).describe('Hz del monitor'),
    punteroWindows: oDesconocido(
      z.number().int().min(PUNTERO_WINDOWS_MIN).max(PUNTERO_WINDOWS_MAX),
    ).describe(
      'Velocidad del puntero de Windows, 1 a 20 (valor de MouseSensitivity)',
    ),
    aceleracionWindows: z.enum([...ACELERACIONES_WINDOWS, DESCONOCIDO]),
    versionWindows: textoLibre.optional(),
    pantalla: pantallaSchema.optional(),
    entrada: entradaSchema.optional(),
    general: generalSchema.optional(),
  })
  .strict();

const ejecutableSchema = z
  .object({
    ruta: textoLibre.describe('Ruta del .exe del juego'),
    optimizacionesPantallaCompleta: oDesconocido(z.boolean()).optional(),
    ejecutarComoAdmin: oDesconocido(z.boolean()).optional(),
    dpiOverride: z.enum([...DPI_OVERRIDES, DESCONOCIDO]).optional(),
  })
  .strict();

const bytesDe = (texto: string): number =>
  new TextEncoder().encode(texto).length;

const archivoConfigSchema = z
  .object({
    ruta: textoLibre.describe('Ruta del archivo de configuración del juego'),
    contenido: z
      .string()
      .refine((texto) => bytesDe(texto) <= ARCHIVO_CONFIG_BYTES_MAX, {
        message: `El archivo pasa de ${ARCHIVO_CONFIG_BYTES_MAX} bytes`,
      })
      .describe('Texto entero del archivo, sin interpretar'),
  })
  .strict();

const enJuegoSchema = z
  .object({
    sensibilidad: z
      .union([z.number().positive(), desconocido, noAplica])
      .describe('Número, "desconocido" o "no_aplica" si el juego no la tiene'),
    rawInput: z
      .enum([...ESTADOS_ENCENDIDO, DESCONOCIDO, NO_APLICA])
      .describe('"no_aplica" si el juego no tiene raw input'),
    parametrosInicio: textoLibre.optional(),
    markC: z.boolean().optional(),
    modoPantalla: z.enum([...MODOS_PANTALLA, DESCONOCIDO]).optional(),
    topeFps: z
      .union([
        z.number().int().positive(),
        z.literal(TOPE_FPS_SIN_TOPE),
        desconocido,
      ])
      .optional()
      .describe('Cuadros por segundo máximos, "sin_tope" o "desconocido"'),
    vsync: interruptor.optional(),
    resolucionJuego: oDesconocido(
      z.string().regex(PATRON_RESOLUCION, 'Usa ANCHOxALTO, p. ej. 1920x1080'),
    ).optional(),
    ejecutable: ejecutableSchema.optional(),
    archivosConfig: z
      .array(archivoConfigSchema)
      .max(ARCHIVOS_CONFIG_MAX)
      .optional()
      .describe('Archivos de configuración del juego, copiados enteros'),
  })
  .strict();

const resultadoSchema = z
  .object({
    rango: textoOConocido.describe('Rango en texto libre'),
    certeza: z
      .enum(CERTEZAS)
      .describe('medido (comprobado), recordado o estimado'),
    matchPerfecto: z.boolean().optional(),
  })
  .strict();

/** Contenido de una estampa, sin `formato`/`version`/`id` (SSOT del contenido). */
export const datosBaseSchema = z
  .object({
    derivadaDe: z
      .string()
      .uuid()
      .optional()
      .describe('Id de la estampa de la que parte esta'),
    notas: textoLibre.optional(),
    juego: juegoSchema,
    sistema: sistemaSchema,
    enJuego: enJuegoSchema,
    resultado: resultadoSchema,
  })
  .strict();

type DatosBase = z.infer<typeof datosBaseSchema>;

const exigirEtapaOFecha = (datos: DatosBase, ctx: z.RefinementCtx): void => {
  if (datos.juego.etapa === undefined && datos.juego.fecha === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['juego'],
      message: 'Indica al menos la etapa o la fecha',
    });
  }
};

export const datosEstampaSchema =
  datosBaseSchema.superRefine(exigirEtapaOFecha);
export type DatosEstampa = z.infer<typeof datosEstampaSchema>;

/** Cambios de una corrección: cualquier subconjunto de los datos. */
export const cambiosSchema = datosBaseSchema.deepPartial();
export type CambiosEstampa = z.infer<typeof cambiosSchema>;

const cabeceraDocumento = {
  formato: z.literal(FORMATO_ESTAMPA),
  version: z.literal(FORMATO_VERSION),
};

export const documentoEstampaSchema = datosBaseSchema
  .extend(cabeceraDocumento)
  .strict()
  .superRefine(exigirEtapaOFecha);

export const documentoExportadoSchema = datosBaseSchema
  .extend({
    ...cabeceraDocumento,
    id: z.string().uuid(),
    numeroVersion: z.number().int().positive().optional(),
    archivada: z.literal(true).optional(),
  })
  .strict()
  .superRefine(exigirEtapaOFecha);
export type DocumentoExportado = z.infer<typeof documentoExportadoSchema>;

/**
 * La estampa activa de un juego: una elección de uso, aparte de las versiones
 * (que son inmutables). Solo el respaldo la lleva; es opcional en el envoltorio.
 */
export const activaExportadaSchema = z
  .object({
    juego: z.string().min(1),
    estampaId: z.string().uuid(),
    numeroVersion: z.number().int().positive(),
  })
  .strict();
export type ActivaExportada = z.infer<typeof activaExportadaSchema>;

export const envoltorioExportSchema = z
  .object({
    formato: z.literal(FORMATO_EXPORT),
    version: z.literal(FORMATO_VERSION),
    estampas: z.array(documentoExportadoSchema),
    activas: z.array(activaExportadaSchema).optional(),
  })
  .strict();
export type EnvoltorioExport = z.infer<typeof envoltorioExportSchema>;
