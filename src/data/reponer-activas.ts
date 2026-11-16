import { DomainError } from '@domain/estampa/index.js';
import type { ActivaExportada } from '@domain/estampa/index.js';
import type { EstampaRepository } from './estampa.repository.js';

export interface ActivaNoRepuesta {
  readonly juego: string;
  readonly motivo: string;
}

export interface ResultadoReposicion {
  /** Juegos cuya activa se repuso (con `dryRun`, los que se repondrían). */
  readonly repuestas: readonly string[];
  /** Juegos que ya tenían activa: nunca se pisa una elección existente. */
  readonly yaTenian: readonly string[];
  /** Activas que la base rechazó (estampa archivada, versión que no existe…). */
  readonly noRepuestas: readonly ActivaNoRepuesta[];
}

/**
 * Repone las activas de un respaldo con lo que ya expone el repositorio
 * (`activaDe` y `marcarActiva`). Igual que la importación, no pisa: un juego
 * que ya tiene activa se deja como está. Debe llamarse DESPUÉS de importar las
 * estampas. Una activa rechazada por una regla de dominio se informa sin
 * abortar las demás; cualquier otro error se propaga.
 */
export async function reponerActivas(
  repository: EstampaRepository,
  activas: readonly ActivaExportada[],
  opciones: { readonly dryRun: boolean },
): Promise<ResultadoReposicion> {
  const repuestas: string[] = [];
  const yaTenian: string[] = [];
  const noRepuestas: ActivaNoRepuesta[] = [];

  for (const { juego, estampaId, numeroVersion } of activas) {
    if ((await repository.activaDe(juego)) !== null) {
      yaTenian.push(juego);
      continue;
    }
    if (opciones.dryRun) {
      repuestas.push(juego);
      continue;
    }
    try {
      await repository.marcarActiva(estampaId, numeroVersion);
      repuestas.push(juego);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      noRepuestas.push({ juego, motivo: error.message });
    }
  }
  return { repuestas, yaTenian, noRepuestas };
}
