import type {
  DatosEstampa,
  EstampaGuardada,
  Genero,
} from '@domain/estampa/index.js';

export interface FiltroListado {
  readonly juego?: string;
  readonly genero?: Genero;
  readonly incluirArchivadas: boolean;
  readonly limite: number;
  readonly desplazamiento: number;
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
 * - nada se borra.
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
  /** Todas las estampas (archivadas incluidas), vigente o con todas sus versiones. */
  todas(opciones: OpcionesTodas): Promise<EstampaGuardada[]>;
}
