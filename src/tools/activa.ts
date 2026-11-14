import type { EstampaRepository } from '@data/index.js';
import { DESCONOCIDO, PATRON_FECHA } from '@domain/estampa/index.js';
import type {
  EstampaActiva,
  EstampaGuardada,
  ResultadoMarcarActiva,
} from '@domain/estampa/index.js';
import {
  FECHA_DEL_JUEGO,
  FECHA_DEL_REGISTRO,
  HERRAMIENTA_MARCAR_ACTIVA,
  LARGO_FECHA_ISO,
  MARCA_ACTIVA,
  SEPARADOR_ETIQUETA,
  SIN_ETAPA,
} from './constants.js';

/** Id de cada estampa activa → la versión fijada. */
export type IndiceDeActivas = ReadonlyMap<string, number>;

export const indiceDeActivas = (
  activas: readonly EstampaActiva[],
): IndiceDeActivas =>
  new Map(activas.map((a) => [a.estampa.id, a.estampa.numeroVersion]));

export const leerIndiceDeActivas = async (
  repository: EstampaRepository,
): Promise<IndiceDeActivas> => indiceDeActivas(await repository.activas());

export function marcaDeActiva(indice: IndiceDeActivas, id: string) {
  const versionActiva = indice.get(id);
  return versionActiva === undefined
    ? { activa: false }
    : { activa: true, versionActiva };
}

/** La fecha del juego si es una fecha; si no, el día en que se registró la estampa. */
function fechaParaListar(estampa: EstampaGuardada) {
  const { fecha } = estampa.datos.juego;
  return fecha !== undefined && PATRON_FECHA.test(fecha)
    ? { fecha, fechaOrigen: FECHA_DEL_JUEGO }
    : {
        fecha: estampa.creadaEn.slice(0, LARGO_FECHA_ISO),
        fechaOrigen: FECHA_DEL_REGISTRO,
      };
}

/**
 * Lo que un selector necesita de cada estampa, en una sola llamada: juego,
 * género, etapa, versión, fecha, rango y certeza, y si es la activa.
 */
export function resumirParaElegir(
  estampa: EstampaGuardada,
  indice: IndiceDeActivas,
) {
  const { juego, resultado } = estampa.datos;
  const { fecha, fechaOrigen } = fechaParaListar(estampa);
  const marca = marcaDeActiva(indice, estampa.id);
  const textoActiva =
    marca.versionActiva === undefined
      ? []
      : [
          marca.versionActiva === estampa.numeroVersion
            ? MARCA_ACTIVA
            : `${MARCA_ACTIVA} (v${marca.versionActiva})`,
        ];
  const etiqueta = [
    juego.nombre,
    juego.genero,
    juego.etapa ?? SIN_ETAPA,
    `v${estampa.numeroVersion}`,
    fecha,
    // El rango solo dice algo si se conoce: «desconocido (medido)» confunde al elegir un corazón.
    ...(resultado.rango === DESCONOCIDO
      ? []
      : [`rango ${resultado.rango} (${resultado.certeza})`]),
    ...textoActiva,
  ].join(SEPARADOR_ETIQUETA);
  return {
    id: estampa.id,
    juego: juego.nombre,
    genero: juego.genero,
    etapa: juego.etapa,
    numeroVersion: estampa.numeroVersion,
    fecha,
    fechaOrigen,
    rango: resultado.rango,
    certeza: resultado.certeza,
    matchPerfecto: resultado.matchPerfecto,
    archivada: estampa.archivada,
    ...marca,
    etiqueta,
  };
}

function textoDeMarcado({ activa, anterior }: ResultadoMarcarActiva): string {
  const { juego, estampa } = activa;
  const { id, numeroVersion } = estampa;
  if (anterior === null) {
    return `Marcada como la activa de "${juego}" (versión ${numeroVersion}).`;
  }
  const esLaMisma =
    anterior.id === id && anterior.numeroVersion === numeroVersion;
  if (esLaMisma) {
    return `Ya era la activa de "${juego}" (versión ${numeroVersion}): no cambió cuál es.`;
  }
  return `Ahora es la activa de "${juego}" (versión ${numeroVersion}); reemplaza a ${anterior.id} versión ${anterior.numeroVersion}.`;
}

/** Qué cambió al marcar: primera activa del juego, la misma de antes o un reemplazo. */
export function mensajeDeMarcado(resultado: ResultadoMarcarActiva): string {
  const { numeroVersion, totalVersiones } = resultado.activa.estampa;
  const texto = textoDeMarcado(resultado);
  const hayMasNueva = numeroVersion < totalVersiones;
  return hayMasNueva
    ? `${texto} Queda fijada la versión ${numeroVersion} aunque la estampa ya tiene la ${totalVersiones}.`
    : texto;
}

export function presentarMarcado(resultado: ResultadoMarcarActiva) {
  const { activa, anterior } = resultado;
  return {
    juego: activa.juego,
    id: activa.estampa.id,
    numeroVersion: activa.estampa.numeroVersion,
    elegidaEn: activa.elegidaEn,
    anterior,
  };
}

/** Aviso cuando la activa del juego está fijada a una versión vieja de la estampa. */
export function avisoDeVersionMasNueva(
  activa: EstampaActiva,
): string | undefined {
  const { numeroVersion, totalVersiones } = activa.estampa;
  return numeroVersion < totalVersiones
    ? `La activa está fijada en la versión ${numeroVersion}, pero la estampa ya tiene la versión ${totalVersiones}. Si la que usas es la nueva, márcala con ${HERRAMIENTA_MARCAR_ACTIVA}.`
    : undefined;
}
