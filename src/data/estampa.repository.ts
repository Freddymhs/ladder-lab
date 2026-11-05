import type {
  DatosEstampa,
  EstampaGuardada,
  Genero,
  PlanImportacion,
} from '@domain/estampa/index.js';

export interface FiltroListado {
  readonly juego?: string;
  readonly genero?: Genero;
  readonly incluirArchivadas: boolean;
  /** Solo las estampas cuyo resultado está marcado como match perfecto. */
  readonly soloMatchPerfecto?: boolean;
  readonly limite: number;
  readonly desplazamiento: number;
}

export interface OpcionesImportacion {
  /** Con `true` se ejecutan todas las comprobaciones pero no se escribe nada. */
  readonly dryRun: boolean;
}

export interface ResultadoImportacion {
  readonly estampasNuevas: number;
  readonly versionesNuevas: number;
  /** Ids que ya existían: se omiten, nunca se sobrescriben. */
  readonly omitidas: readonly string[];
  readonly aplicada: boolean;
}

export interface OpcionesTodas {
  readonly incluirVersiones: boolean;
}

/**
 * Contrato de almacenamiento, en términos del dominio. Las reglas que los dos
 * repositorios (Supabase y memoria) deben respetar:
 * - una corrección crea una versión nueva y nunca altera las anteriores;
 * - `corregir` falla si la versión base ya no es la vigente;
 * - `derivadaDe` debe existir y no puede ser la propia estampa;
 * - nada se borra: archivar solo marca, importar nunca pisa un id existente.
 */
export interface EstampaRepository {
  crear(datos: DatosEstampa): Promise<EstampaGuardada>;
  corregir(
    id: string,
    versionBase: number,
    datos: DatosEstampa,
  ): Promise<EstampaGuardada>;
  /** Versión vigente, o `null` si la estampa no existe. */
  obtener(id: string): Promise<EstampaGuardada | null>;
  listar(filtro: FiltroListado): Promise<EstampaGuardada[]>;
  /** Todas las versiones de una estampa, de la 1 en adelante; `null` si no existe. */
  versionesDe(id: string): Promise<EstampaGuardada[] | null>;
  /** Marca la estampa como archivada (no borra nada). Idempotente. */
  archivar(id: string): Promise<EstampaGuardada>;
  /** Todo o nada: si algo falla no entra nada. Los ids existentes se omiten. */
  importar(
    plan: PlanImportacion,
    opciones: OpcionesImportacion,
  ): Promise<ResultadoImportacion>;
  /** Todas las estampas (archivadas incluidas), vigente o con todas sus versiones. */
  todas(opciones: OpcionesTodas): Promise<EstampaGuardada[]>;
}
