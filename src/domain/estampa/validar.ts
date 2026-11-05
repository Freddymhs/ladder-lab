import { DatosInvalidosError } from './errors.js';
import { datosEstampaSchema } from './schema.js';
import type { DatosEstampa } from './schema.js';

/** Valida una entrada contra el esquema completo y devuelve un error legible. */
export function parsearDatos(entrada: unknown): DatosEstampa {
  const resultado = datosEstampaSchema.safeParse(entrada);
  if (resultado.success) {
    return resultado.data;
  }
  const detalle = resultado.error.issues
    .map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
    .join('; ');
  throw new DatosInvalidosError(`Datos inválidos — ${detalle}`);
}
