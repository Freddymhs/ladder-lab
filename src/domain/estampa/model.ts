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

/** Una versión concreta de una estampa. */
export interface ReferenciaVersion {
  readonly id: string;
  readonly numeroVersion: number;
}

/**
 * La estampa que Freddy usa hoy en un juego: una por juego (sin distinguir
 * mayúsculas), elegida a mano y fijada a una versión. `estampa` es ESA versión,
 * no necesariamente la vigente.
 */
export interface EstampaActiva {
  readonly juego: string;
  readonly elegidaEn: string;
  readonly estampa: EstampaGuardada;
}

export interface ResultadoMarcarActiva {
  readonly activa: EstampaActiva;
  /** La que estaba activa en ese juego antes de marcar (puede ser la misma), o `null`. */
  readonly anterior: ReferenciaVersion | null;
}
