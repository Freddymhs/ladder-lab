import { describe, expect, it } from 'vitest';
import { ImportacionInvalidaError } from '../errors.js';
import { planificarImportacion, validarEnvoltorio } from '../import.js';
import { clonar, leerEjemplo } from './fixtures.js';

type Envoltorio = { estampas: Array<Record<string, unknown>> } & Record<
  string,
  unknown
>;
const fixture = (nombre: string): Envoltorio =>
  clonar(leerEjemplo(nombre)) as Envoltorio;

const ID_A = '7d1c2f4e-0000-4000-8000-000000000001';
const ID_B = '7d1c2f4e-0000-4000-8000-000000000002';

describe('validarEnvoltorio', () => {
  it.each(['export-vigentes.json', 'export-con-versiones.json'])(
    'acepta el fixture %s',
    (n) => {
      expect(() => validarEnvoltorio(leerEjemplo(n))).not.toThrow();
    },
  );

  it('rechaza otro formato con un mensaje que dice cuál llegó', () => {
    const otro = { ...fixture('export-vigentes.json'), formato: 'otra-cosa' };

    expect(() => validarEnvoltorio(otro)).toThrow(
      /No es una exportación de ladder-lab.*otra-cosa/,
    );
  });

  it('rechaza una versión de formato desconocida con un mensaje claro', () => {
    const futura = { ...fixture('export-vigentes.json'), version: 2 };

    expect(() => validarEnvoltorio(futura)).toThrow(
      /Versión de formato no soportada: 2.*versión 1/,
    );
  });

  it.each([null, undefined, 'texto', 42, []])(
    'rechaza una entrada que no es un envoltorio: %j',
    (entrada) => {
      expect(() => validarEnvoltorio(entrada)).toThrow(
        ImportacionInvalidaError,
      );
    },
  );

  it('rechaza un documento que no cumple el esquema y dice dónde', () => {
    const roto = fixture('export-vigentes.json');
    roto.estampas[0] = {
      ...roto.estampas[0],
      juego: { nombre: 'X', genero: 'MOBA', fecha: '2025-01-01' },
    };

    expect(() => validarEnvoltorio(roto)).toThrow(/estampas\.0\.juego\.genero/);
  });
});

describe('planificarImportacion', () => {
  it('sin numeroVersion: una estampa por documento, versión 1, con su archivada', () => {
    const plan = planificarImportacion(
      validarEnvoltorio(leerEjemplo('export-vigentes.json')),
    );

    expect(
      plan.estampas.map((e) => [
        e.id,
        e.versiones.map((v) => v.numero),
        e.archivada,
      ]),
    ).toEqual([
      [ID_A, [1], false],
      [ID_B, [1], true],
    ]);
  });

  it('con numeroVersion: agrupa por id y ordena las versiones', () => {
    const entrada = fixture('export-con-versiones.json');
    entrada.estampas.reverse();

    const plan = planificarImportacion(validarEnvoltorio(entrada));

    expect(plan.estampas).toHaveLength(1);
    expect(plan.estampas[0]?.versiones.map((v) => v.numero)).toEqual([1, 2]);
    expect(plan.estampas[0]?.versiones[0]?.datos.sistema.dpi).toBe(400);
  });

  it('los datos del plan no llevan id, numeroVersion ni archivada', () => {
    const plan = planificarImportacion(
      validarEnvoltorio(leerEjemplo('export-con-versiones.json')),
    );
    const datos = plan.estampas[0]!.versiones[0]!.datos as Record<
      string,
      unknown
    >;

    expect(datos).not.toHaveProperty('id');
    expect(datos).not.toHaveProperty('numeroVersion');
    expect(datos).not.toHaveProperty('archivada');
    expect(datos).not.toHaveProperty('formato');
  });

  it('rechaza versiones con un salto (1 y 3)', () => {
    const entrada = fixture('export-con-versiones.json');
    entrada.estampas[1] = { ...entrada.estampas[1], numeroVersion: 3 };

    expect(() => planificarImportacion(validarEnvoltorio(entrada))).toThrow(
      /incompletas o repetidas/,
    );
  });

  it('rechaza versiones repetidas (1 y 1)', () => {
    const entrada = fixture('export-con-versiones.json');
    entrada.estampas[1] = { ...entrada.estampas[1], numeroVersion: 1 };

    expect(() => planificarImportacion(validarEnvoltorio(entrada))).toThrow(
      /incompletas o repetidas/,
    );
  });

  it('rechaza versiones que no empiezan en 1', () => {
    const entrada = fixture('export-con-versiones.json');
    entrada.estampas = [{ ...entrada.estampas[1], numeroVersion: 2 }];

    expect(() => planificarImportacion(validarEnvoltorio(entrada))).toThrow(
      /se esperaba la 1/,
    );
  });

  it('rechaza el mismo id repetido sin numeroVersion', () => {
    const entrada = fixture('export-vigentes.json');
    entrada.estampas = [entrada.estampas[0]!, entrada.estampas[0]!];

    expect(() => planificarImportacion(validarEnvoltorio(entrada))).toThrow(
      /sin numeroVersion/,
    );
  });

  it('rechaza mezclar documentos con y sin numeroVersion para un mismo id', () => {
    const entrada = fixture('export-con-versiones.json');
    const { numeroVersion: _quitado, ...sinNumero } = entrada.estampas[1]!;
    entrada.estampas[1] = sinNumero;

    expect(() => planificarImportacion(validarEnvoltorio(entrada))).toThrow(
      /mezcla/,
    );
  });

  it('rechaza una estampa que deriva de sí misma', () => {
    const entrada = fixture('export-vigentes.json');
    entrada.estampas[0] = { ...entrada.estampas[0], derivadaDe: ID_A };

    expect(() => planificarImportacion(validarEnvoltorio(entrada))).toThrow(
      /deriva de sí misma/,
    );
  });

  it('un envoltorio vacío da un plan vacío', () => {
    const plan = planificarImportacion(
      validarEnvoltorio({
        formato: 'ladder-lab.export',
        version: 1,
        estampas: [],
      }),
    );

    expect(plan.estampas).toEqual([]);
  });
});
