import { DESCONOCIDO, NO_APLICA } from './constants.js';
import { jsonCanonico } from './merge.js';
import type { DatosEstampa } from './schema.js';

export interface CambioDeCampo {
  readonly campo: string;
  /** `undefined` si el campo no estaba registrado en la versión anterior. */
  readonly antes: unknown;
  /** `undefined` si el campo ya no está registrado. */
  readonly despues: unknown;
}

export interface DiferenciaEntreEstampas {
  readonly campo: string;
  /** Valor de cada estampa por id; `null` si esa estampa no registró el campo. */
  readonly valores: Readonly<Record<string, unknown>>;
}

export interface CampoIncompleto {
  readonly campo: string;
  /** Ids de las estampas que no tienen dato en este campo. */
  readonly sinDato: readonly string[];
}

export interface ResultadoComparacion {
  readonly diferencias: readonly DiferenciaEntreEstampas[];
  readonly incompletos: readonly CampoIncompleto[];
}

/** `desconocido`, `no_aplica` y un campo ausente significan «sin dato»: no son un valor comparable. */
export const esSinDato = (valor: unknown): boolean =>
  valor === undefined || valor === DESCONOCIDO || valor === NO_APLICA;

const esObjetoPlano = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/** `{ sistema: { dpi: 450 } }` → `{ 'sistema.dpi': 450 }`. */
export function aplanar(datos: unknown, prefijo = ''): Record<string, unknown> {
  if (!esObjetoPlano(datos)) {
    return { [prefijo]: datos };
  }
  return Object.entries(datos).reduce<Record<string, unknown>>(
    (acumulado, [clave, valor]) => ({
      ...acumulado,
      ...aplanar(valor, prefijo === '' ? clave : `${prefijo}.${clave}`),
    }),
    {},
  );
}

/**
 * Qué cambió de una versión a la siguiente. Aquí un cambio es cualquier
 * cambio: pasar de `desconocido` a `450` es justo lo que se quiere ver.
 */
export function cambiosEntre(
  antes: DatosEstampa,
  despues: DatosEstampa,
): CambioDeCampo[] {
  const a = aplanar(antes);
  const d = aplanar(despues);
  const campos = [...new Set([...Object.keys(a), ...Object.keys(d)])].sort();
  return campos
    .filter((campo) => jsonCanonico(a[campo]) !== jsonCanonico(d[campo]))
    .map((campo) => ({ campo, antes: a[campo], despues: d[campo] }));
}

/**
 * Compara varias estampas campo por campo. Describe diferencias; no dice cuál
 * configuración es mejor. Un campo es una **diferencia** solo si dos estampas
 * tienen un dato real y distinto; si falta el dato en alguna, es **incompleto**
 * (no se sabe si coinciden), nunca una diferencia inventada.
 */
export function compararEstampas(
  estampas: ReadonlyArray<{
    readonly id: string;
    readonly datos: DatosEstampa;
  }>,
): ResultadoComparacion {
  const aplanadas = estampas.map((e) => ({
    id: e.id,
    campos: aplanar(e.datos),
  }));
  const campos = [
    ...new Set(aplanadas.flatMap((e) => Object.keys(e.campos))),
  ].sort();

  const diferencias: DiferenciaEntreEstampas[] = [];
  const incompletos: CampoIncompleto[] = [];

  for (const campo of campos) {
    const valores = aplanadas.map((e) => ({
      id: e.id,
      valor: e.campos[campo],
    }));
    const conDato = valores.filter((v) => !esSinDato(v.valor));
    const sinDato = valores.filter((v) => esSinDato(v.valor));
    const distintos = new Set(conDato.map((v) => jsonCanonico(v.valor)));

    if (distintos.size >= 2) {
      diferencias.push({
        campo,
        valores: Object.fromEntries(
          valores.map((v) => [v.id, v.valor ?? null]),
        ),
      });
    } else if (conDato.length >= 1 && sinDato.length >= 1) {
      incompletos.push({ campo, sinDato: sinDato.map((v) => v.id) });
    }
  }
  return { diferencias, incompletos };
}
