import {
  SUGERENCIAS_JUEGO_DISTANCIA_MAXIMA,
  SUGERENCIAS_JUEGO_MAXIMO,
} from './constants.js';

/** Números romanos que aparecen en nombres de juegos («StarCraft II», «Age of Empires IV»). */
const ROMANOS: Readonly<Record<string, string>> = {
  i: '1',
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  x: '10',
};

/** Clave para comparar parecidos: minúsculas, sin tildes ni signos, romanos como arábigos. */
const claveDeParecido = (nombre: string): string => {
  const sinTildes = nombre.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const palabras = sinTildes
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((palabra) => palabra.length > 0);
  return palabras.map((palabra) => ROMANOS[palabra] ?? palabra).join('');
};

/** Distancia de Levenshtein, fila por fila. */
const distanciaDeEdicion = (a: string, b: string): number => {
  const primeraFila = Array.from({ length: b.length + 1 }, (_, j) => j);
  const ultimaFila = [...a].reduce((filaPrevia, letraA, i) => {
    const fila = [i + 1];
    [...b].forEach((letraB, j) => {
      const sustituir = filaPrevia[j]! + (letraA === letraB ? 0 : 1);
      const borrar = filaPrevia[j + 1]! + 1;
      const insertar = fila[j]! + 1;
      fila.push(Math.min(sustituir, borrar, insertar));
    });
    return fila;
  }, primeraFila);
  return ultimaFila[b.length]!;
};

/**
 * Nombres conocidos que se parecen al buscado («Starcraft 2» → «StarCraft II»),
 * del más parecido al menos. No decide por el usuario: solo propone.
 */
export function sugerirJuegos(
  buscado: string,
  conocidos: readonly string[],
): string[] {
  const claveBuscada = claveDeParecido(buscado);
  if (claveBuscada.length === 0) return [];
  return conocidos
    .map((nombre) => ({
      nombre,
      distancia: distanciaDeEdicion(claveBuscada, claveDeParecido(nombre)),
    }))
    .filter(({ distancia }) => distancia <= SUGERENCIAS_JUEGO_DISTANCIA_MAXIMA)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, SUGERENCIAS_JUEGO_MAXIMO)
    .map(({ nombre }) => nombre);
}
