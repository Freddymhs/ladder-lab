import type { EstampaRepository } from '@data/index.js';
import type { Genero } from '@domain/estampa/index.js';
import type { EstampaGuardada } from '@domain/estampa/index.js';
import { resumirParaElegir } from './activa.js';
import type { IndiceDeActivas } from './activa.js';

export interface FiltroMatches {
  readonly juego?: string;
  readonly genero?: Genero;
  readonly incluirArchivadas: boolean;
  readonly limite: number;
  readonly desplazamiento: number;
}

/**
 * Única implementación de «estampas marcadas como match perfecto»: la usan
 * `matches_perfectos` y `mejor_por_juego` (DECISION_MEJOR_POR_JUEGO.md).
 * Se pide una de más para saber si hay otra página sin contar todo.
 */
export async function buscarMatchesPerfectos(
  repository: EstampaRepository,
  filtro: FiltroMatches,
): Promise<{ estampas: EstampaGuardada[]; hayMas: boolean }> {
  const encontradas = await repository.listar({
    ...filtro,
    soloMatchPerfecto: true,
    limite: filtro.limite + 1,
  });
  return {
    estampas: encontradas.slice(0, filtro.limite),
    hayMas: encontradas.length > filtro.limite,
  };
}

/** El resultado se muestra tal cual: rango como texto y su certeza, sin ordenar ni juzgar. */
export function presentarMatch(
  estampa: EstampaGuardada,
  indice: IndiceDeActivas,
) {
  const { sistema, enJuego, resultado } = estampa.datos;
  return {
    ...resumirParaElegir(estampa, indice),
    resultado,
    configuracion: { sistema, enJuego },
  };
}
