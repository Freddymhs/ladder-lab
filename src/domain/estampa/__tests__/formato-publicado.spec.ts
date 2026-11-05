import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  documentoEstampaSchema,
  documentoExportadoSchema,
  envoltorioExportSchema,
} from '../schema.js';
import { clonar, leerEjemplo } from './fixtures.js';

const ESPECIFICACION = readFileSync(
  new URL('../../../../docs/formato/ladder-lab.estampa.v1.md', import.meta.url),
  'utf8',
);

interface FilaDeLaTabla {
  campo: string;
  obligatorio: string;
  desconocido: string;
  noAplica: string;
}

/** Las filas de la tabla «Campos» de la especificación: `| \`ruta\` | tipo | obl | desc | no_aplica | notas |`. */
const filasDeLaEspecificacion = (): FilaDeLaTabla[] =>
  ESPECIFICACION.split('\n')
    .map((linea) => linea.split('|').map((celda) => celda.trim()))
    .filter(
      (celdas) => celdas.length >= 7 && /^`[A-Za-z.]+`$/.test(celdas[1] ?? ''),
    )
    .map((celdas) => ({
      campo: (celdas[1] ?? '').replaceAll('`', ''),
      obligatorio: celdas[3] ?? '',
      desconocido: celdas[4] ?? '',
      noAplica: celdas[5] ?? '',
    }));

type ZodCualquiera = z.ZodTypeAny;
const desenvolver = (esquema: ZodCualquiera): ZodCualquiera => {
  if (esquema instanceof z.ZodEffects)
    return desenvolver(esquema._def.schema as ZodCualquiera);
  if (esquema instanceof z.ZodOptional)
    return desenvolver(esquema._def.innerType as ZodCualquiera);
  return esquema;
};
/** Todas las rutas de campo (`sistema.dpi`) que declara el esquema, sin escribirlas a mano. */
const rutasDelEsquema = (esquema: ZodCualquiera, prefijo = ''): string[] => {
  const objeto = desenvolver(esquema);
  if (!(objeto instanceof z.ZodObject)) return [prefijo];
  return Object.entries(objeto.shape as Record<string, ZodCualquiera>).flatMap(
    ([clave, valor]) =>
      rutasDelEsquema(valor, prefijo === '' ? clave : `${prefijo}.${clave}`),
  );
};

const CABECERA = new Set([
  'formato',
  'version',
  'id',
  'numeroVersion',
  'archivada',
]);

type Documento = Record<string, unknown>;
const conValorEn = (ruta: string, valor: unknown): Documento => {
  const copia = clonar(leerEjemplo('estampa-fps.json')) as Documento;
  const partes = ruta.split('.');
  const ultimo = partes.at(-1)!;
  const padre = partes
    .slice(0, -1)
    .reduce<Documento>((nodo, clave) => nodo[clave] as Documento, copia);
  padre[ultimo] = valor;
  return copia;
};
const sinCampo = (ruta: string): Documento => {
  const copia = clonar(leerEjemplo('estampa-fps.json')) as Documento;
  const partes = ruta.split('.');
  const padre = partes
    .slice(0, -1)
    .reduce<Documento>((nodo, clave) => nodo[clave] as Documento, copia);
  delete padre[partes.at(-1)!];
  return copia;
};

describe('la especificación publicada no miente', () => {
  const filas = filasDelaTabla();
  function filasDelaTabla(): FilaDeLaTabla[] {
    return filasDeLaEspecificacion();
  }

  it('la tabla de campos coincide exactamente con las rutas del esquema (sin faltantes ni sobrantes)', () => {
    const delEsquema = rutasDelEsquema(documentoExportadoSchema).sort();
    const delDocumento = filas.map((f) => f.campo).sort();

    expect(delDocumento).toEqual(delEsquema);
    expect(filas.length).toBeGreaterThan(20); // denominador: no es una tabla vacía que "coincide" con nada
  });

  it('cada campo aparece una sola vez en la tabla', () => {
    const campos = filas.map((f) => f.campo);

    expect(new Set(campos).size).toBe(campos.length);
  });

  describe('celda «desconocido»', () => {
    it.each(
      filas.filter((f) => !CABECERA.has(f.campo) && f.desconocido !== '—'),
    )(
      '$campo: la especificación dice «$desconocido»',
      ({ campo, desconocido }) => {
        const acepta = documentoEstampaSchema.safeParse(
          conValorEn(campo, 'desconocido'),
        ).success;

        expect(acepta).toBe(desconocido === 'sí');
      },
    );
  });

  describe('celda «no_aplica»', () => {
    it.each(filas.filter((f) => !CABECERA.has(f.campo) && f.noAplica !== '—'))(
      '$campo: la especificación dice «$noAplica»',
      ({ campo, noAplica }) => {
        const acepta = documentoEstampaSchema.safeParse(
          conValorEn(campo, 'no_aplica'),
        ).success;

        expect(acepta).toBe(noAplica === 'sí');
      },
    );
  });

  describe('celda «obligatorio»', () => {
    it.each(filas.filter((f) => f.obligatorio === 'sí'))(
      '$campo es obligatorio: sin él se rechaza',
      ({ campo }) => {
        expect(documentoEstampaSchema.safeParse(sinCampo(campo)).success).toBe(
          false,
        );
      },
    );

    it.each(
      filas.filter(
        (f) =>
          f.obligatorio === 'no' &&
          !['juego.etapa', 'juego.fecha'].includes(f.campo),
      ),
    )('$campo es opcional: sin él se acepta', ({ campo }) => {
      expect(documentoEstampaSchema.safeParse(sinCampo(campo)).success).toBe(
        true,
      );
    });

    it('etapa y fecha: al menos una (la tabla dice que ninguna es obligatoria por sí sola)', () => {
      const sinFecha = sinCampo('juego.fecha');

      expect(documentoEstampaSchema.safeParse(sinFecha).success).toBe(false);
      expect(
        documentoEstampaSchema.safeParse(conValorEn('juego.etapa', 'T1'))
          .success,
      ).toBe(true);
    });

    it.each(filas.filter((f) => f.obligatorio === 'solo exportación'))(
      '$campo solo existe en exportación: el documento de entrada lo rechaza',
      ({ campo }) => {
        const valor =
          campo === 'archivada'
            ? true
            : campo === 'numeroVersion'
              ? 1
              : '7d1c2f4e-0000-4000-8000-000000000001';

        expect(
          documentoEstampaSchema.safeParse({
            ...(leerEjemplo('estampa-fps.json') as Documento),
            [campo]: valor,
          }).success,
        ).toBe(false);
      },
    );
  });

  it('todo bloque ```json de la especificación es un documento o un envoltorio válido', () => {
    const bloques = [...ESPECIFICACION.matchAll(/```json\n([\s\S]*?)```/g)].map(
      (m) => JSON.parse(m[1]!) as Documento,
    );

    expect(bloques.length).toBeGreaterThanOrEqual(2);
    for (const bloque of bloques) {
      const resultado =
        bloque.formato === 'ladder-lab.export'
          ? envoltorioExportSchema.safeParse(bloque)
          : 'id' in bloque
            ? documentoExportadoSchema.safeParse(bloque)
            : documentoEstampaSchema.safeParse(bloque);
      expect(resultado.success, JSON.stringify(bloque).slice(0, 80)).toBe(true);
    }
  });

  it('la especificación nombra los cuatro fixtures publicados y existen', () => {
    for (const nombre of [
      'estampa-fps.json',
      'estampa-rts-no-aplica.json',
      'export-vigentes.json',
      'export-con-versiones.json',
    ]) {
      expect(ESPECIFICACION).toContain(nombre);
      expect(() => leerEjemplo(nombre)).not.toThrow();
    }
  });
});
