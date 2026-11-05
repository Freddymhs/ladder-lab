import type { Logger } from 'pino';
import { toolError } from '@common/errors.js';
import type { ToolResult } from '@common/types.js';
import type { EstampaRepository } from '@data/index.js';
import { DomainError } from '@domain/estampa/index.js';
import type { EstampaGuardada } from '@domain/estampa/index.js';

export interface ToolDeps {
  readonly repository: EstampaRepository;
  readonly logger: Logger;
}

/**
 * Separa el camino feliz del manejo de errores: las herramientas solo cuentan
 * lo que hacen; aquí se decide qué ve el usuario si algo falla.
 */
export async function protegido(
  logger: Logger,
  accion: () => Promise<ToolResult>,
): Promise<ToolResult> {
  try {
    return await accion();
  } catch (error) {
    if (error instanceof DomainError) {
      return toolError(error.message);
    }
    logger.error({ err: error }, 'Fallo inesperado en una herramienta');
    return toolError('Error interno del servidor. Revisa sus registros.');
  }
}

export const ANOTACIONES_ESCRITURA = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export const ANOTACIONES_LECTURA = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function presentarEstampa(estampa: EstampaGuardada) {
  return {
    id: estampa.id,
    numeroVersion: estampa.numeroVersion,
    totalVersiones: estampa.totalVersiones,
    archivada: estampa.archivada,
    creadaEn: estampa.creadaEn,
    versionCreadaEn: estampa.versionCreadaEn,
    estampa: estampa.datos,
  };
}

export function resumirEstampa(estampa: EstampaGuardada) {
  const { juego, resultado } = estampa.datos;
  return {
    id: estampa.id,
    juego: juego.nombre,
    genero: juego.genero,
    etapa: juego.etapa,
    fecha: juego.fecha,
    rango: resultado.rango,
    certeza: resultado.certeza,
    matchPerfecto: resultado.matchPerfecto,
    numeroVersion: estampa.numeroVersion,
    archivada: estampa.archivada,
  };
}
