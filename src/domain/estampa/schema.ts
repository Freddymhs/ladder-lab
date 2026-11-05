import { z } from 'zod';
import {
  ACELERACIONES_WINDOWS,
  CERTEZAS,
  DESCONOCIDO,
  ESTADOS_RAW_INPUT,
  FORMATO_ESTAMPA,
  FORMATO_EXPORT,
  FORMATO_VERSION,
  GENEROS,
  NO_APLICA,
  PATRON_FECHA,
  PATRON_RESOLUCION,
  POSICION_WINDOWS_MAX,
  POSICION_WINDOWS_MIN,
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
const textoLibre = z
  .string()
  .min(1)
  .refine((v) => v !== DESCONOCIDO && v !== NO_APLICA, {
    message: `"${DESCONOCIDO}" y "${NO_APLICA}" son valores reservados aquí`,
  });

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

const juegoSchema = z
  .object({
    nombre: textoLibre.describe('Nombre del juego'),
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
    posicionWindows: oDesconocido(
      z.number().int().min(POSICION_WINDOWS_MIN).max(POSICION_WINDOWS_MAX),
    ).describe('Velocidad del puntero de Windows, 1 a 11'),
    aceleracionWindows: z.enum([...ACELERACIONES_WINDOWS, DESCONOCIDO]),
    versionWindows: textoLibre.optional(),
  })
  .strict();

const enJuegoSchema = z
  .object({
    sensibilidad: z
      .union([z.number().positive(), desconocido, noAplica])
      .describe('Número, "desconocido" o "no_aplica" si el juego no la tiene'),
    rawInput: z
      .enum([...ESTADOS_RAW_INPUT, DESCONOCIDO, NO_APLICA])
      .describe('"no_aplica" si el juego no tiene raw input'),
    parametrosInicio: textoLibre.optional(),
    markC: z.boolean().optional(),
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

export const envoltorioExportSchema = z
  .object({
    formato: z.literal(FORMATO_EXPORT),
    version: z.literal(FORMATO_VERSION),
    estampas: z.array(documentoExportadoSchema),
  })
  .strict();
export type EnvoltorioExport = z.infer<typeof envoltorioExportSchema>;
