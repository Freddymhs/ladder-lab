import type { DatosEstampa } from './schema.js';

/** Una versión de una estampa tal como la guarda el repositorio. */
export interface EstampaGuardada {
  readonly id: string;
  readonly numeroVersion: number;
  readonly totalVersiones: number;
  readonly archivada: boolean;
  readonly creadaEn: string;
  readonly versionCreadaEn: string;
  readonly datos: DatosEstampa;
}
