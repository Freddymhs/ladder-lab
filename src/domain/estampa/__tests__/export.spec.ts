import { describe, expect, it } from 'vitest';
import {
  aDocumentoExportado,
  construirEnvoltorio,
  derivadasSinResolver,
} from '../export.js';
import type { EstampaGuardada } from '../model.js';
import { datosEstampaSchema, envoltorioExportSchema } from '../schema.js';
import { leerEjemplo } from './fixtures.js';

const ID_A = '7d1c2f4e-0000-4000-8000-000000000001';
const ID_B = '7d1c2f4e-0000-4000-8000-000000000002';

const datosDe = (documento: Record<string, unknown>) => {
  const {
    formato: _f,
    version: _v,
    id: _i,
    numeroVersion: _n,
    archivada: _a,
    ...datos
  } = documento;
  return datosEstampaSchema.parse(datos);
};

const guardadas = (): EstampaGuardada[] => {
  const envoltorio = envoltorioExportSchema.parse(
    leerEjemplo('export-vigentes.json'),
  );
  return envoltorio.estampas.map((documento) => ({
    id: documento.id,
    numeroVersion: 1,
    totalVersiones: 1,
    archivada: documento.archivada === true,
    creadaEn: '2026-01-01T00:00:00.000Z',
    versionCreadaEn: '2026-01-01T00:00:00.000Z',
    datos: datosDe(documento),
  }));
};

describe('construirEnvoltorio — contrato con el fixture publicado', () => {
  it('sin versiones reproduce exactamente el fixture export-vigentes.json', () => {
    const envoltorio = construirEnvoltorio(guardadas(), {
      incluirVersiones: false,
    });

    expect(envoltorio).toEqual(leerEjemplo('export-vigentes.json'));
  });

  it('con versiones agrega numeroVersion a cada documento', () => {
    const envoltorio = construirEnvoltorio(guardadas(), {
      incluirVersiones: true,
    });

    expect(envoltorio.estampas.map((e) => e.numeroVersion)).toEqual([1, 1]);
  });

  it('todo documento lleva id, también sin versiones', () => {
    const envoltorio = construirEnvoltorio(guardadas(), {
      incluirVersiones: false,
    });

    expect(envoltorio.estampas.every((e) => typeof e.id === 'string')).toBe(
      true,
    );
    expect(
      envoltorio.estampas.every((e) => e.numeroVersion === undefined),
    ).toBe(true);
  });

  it('marca archivada solo cuando lo está', () => {
    const [a, b] = construirEnvoltorio(guardadas(), {
      incluirVersiones: false,
    }).estampas;

    expect(a?.archivada).toBeUndefined();
    expect(b?.archivada).toBe(true);
  });

  it('un documento exportado se valida antes de salir: datos corruptos fallan', () => {
    const corrupta = {
      ...guardadas()[0]!,
      datos: { juego: 'roto' },
    } as unknown as EstampaGuardada;

    expect(() =>
      aDocumentoExportado(corrupta, { incluirVersiones: false }),
    ).toThrow();
  });
});

describe('derivadasSinResolver', () => {
  it('todo derivadaDe del fixture se resuelve contra un id del mismo envoltorio', () => {
    const envoltorio = envoltorioExportSchema.parse(
      leerEjemplo('export-vigentes.json'),
    );

    expect(envoltorio.estampas.some((e) => e.derivadaDe === ID_A)).toBe(true);
    expect(derivadasSinResolver(envoltorio)).toEqual([]);
  });

  it('detecta una referencia colgante', () => {
    const envoltorio = envoltorioExportSchema.parse(
      leerEjemplo('export-vigentes.json'),
    );
    const sinOrigen = {
      ...envoltorio,
      estampas: envoltorio.estampas.filter((e) => e.id === ID_B),
    };

    expect(derivadasSinResolver(sinOrigen)).toEqual([ID_A]);
  });
});
