import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  AlmacenamientoError,
  ConflictoDeVersionError,
  DerivadaInvalidaError,
  EstampaNoEncontradaError,
} from '@domain/estampa/index.js';
import { datosValidos } from '../../tools/__tests__/harness.js';
import {
  CODIGO_SQL,
  SupabaseEstampaRepository,
} from '../supabase-estampa.repository.js';

type Llamada = readonly [string, readonly unknown[]];
interface Respuesta {
  readonly data: unknown;
  readonly error: { code?: string; message: string } | null;
}

/** Cliente falso: registra la cadena de llamadas y responde lo configurado. */
function clienteFalso(respuestas: { rpc?: Respuesta; consulta?: Respuesta }) {
  const llamadas: Llamada[] = [];
  const consulta: object = new Proxy(
    {},
    {
      get: (_objetivo, propiedad) => {
        if (propiedad === 'then') {
          return (resolver: (valor: Respuesta) => unknown) =>
            resolver(respuestas.consulta ?? { data: [], error: null });
        }
        return (...args: unknown[]) => {
          llamadas.push([String(propiedad), args]);
          return consulta;
        };
      },
    },
  );
  const cliente = {
    from: (vista: string) => {
      llamadas.push(['from', [vista]]);
      return consulta;
    },
    rpc: (nombre: string, args: unknown) => {
      llamadas.push(['rpc', [nombre, args]]);
      return Promise.resolve(respuestas.rpc ?? { data: null, error: null });
    },
  } as unknown as SupabaseClient;
  return { repositorio: new SupabaseEstampaRepository(cliente), llamadas };
}

const filaValida = (id: string = randomUUID()) => ({
  id,
  numero_version: 1,
  total_versiones: 1,
  archivada: false,
  creada_en: '2026-01-01T00:00:00Z',
  version_creada_en: '2026-01-01T00:00:00Z',
  datos: datosValidos(),
});

describe('SupabaseEstampaRepository — traducción de errores', () => {
  it.each([
    [CODIGO_SQL.NO_EXISTE, EstampaNoEncontradaError],
    [CODIGO_SQL.CONFLICTO_DE_VERSION, ConflictoDeVersionError],
    [CODIGO_SQL.DERIVADA_INVALIDA, DerivadaInvalidaError],
  ])(
    'el código SQL %s se vuelve el error de dominio correspondiente',
    async (code, esperado) => {
      const { repositorio } = clienteFalso({
        rpc: { data: null, error: { code, message: 'x' } },
      });

      await expect(
        repositorio.corregir(randomUUID(), 1, datosValidos()),
      ).rejects.toBeInstanceOf(esperado);
    },
  );

  it('un código desconocido es un fallo de almacenamiento con la causa original', async () => {
    const { repositorio } = clienteFalso({
      rpc: {
        data: null,
        error: { code: '57P01', message: 'connection terminated' },
      },
    });

    const error = await repositorio
      .crear(datosValidos())
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AlmacenamientoError);
    expect((error as AlmacenamientoError).causa).toMatchObject({
      code: '57P01',
    });
    expect((error as AlmacenamientoError).message).not.toContain(
      'connection terminated',
    );
  });

  it('un error de red (sin código) también es un fallo de almacenamiento', async () => {
    const { repositorio } = clienteFalso({
      consulta: { data: null, error: { message: 'TypeError: fetch failed' } },
    });

    await expect(repositorio.obtener(randomUUID())).rejects.toBeInstanceOf(
      AlmacenamientoError,
    );
  });
});

describe('SupabaseEstampaRepository — lectura', () => {
  it('obtener: un uuid inválido (22P02) es "no existe", no un fallo', async () => {
    const { repositorio } = clienteFalso({
      consulta: {
        data: null,
        error: { code: CODIGO_SQL.UUID_INVALIDO, message: 'invalid uuid' },
      },
    });

    expect(await repositorio.obtener('abc')).toBeNull();
  });

  it('obtener: una fila ausente es null', async () => {
    const { repositorio } = clienteFalso({
      consulta: { data: null, error: null },
    });

    expect(await repositorio.obtener(randomUUID())).toBeNull();
  });

  it('una fila que no cumple el esquema es un fallo de almacenamiento, no basura al usuario', async () => {
    const { repositorio } = clienteFalso({
      consulta: {
        data: { ...filaValida(), datos: { juego: 'roto' } },
        error: null,
      },
    });

    await expect(repositorio.obtener(randomUUID())).rejects.toBeInstanceOf(
      AlmacenamientoError,
    );
  });

  it('listar: escapa % _ \\ del nombre y pide el rango correcto', async () => {
    const { repositorio, llamadas } = clienteFalso({
      consulta: { data: [filaValida()], error: null },
    });

    await repositorio.listar({
      juego: 'a%b_c\\d',
      genero: 'FPS',
      incluirArchivadas: false,
      limite: 10,
      desplazamiento: 20,
    });

    expect(llamadas).toContainEqual(['ilike', ['juego', 'a\\%b\\_c\\\\d']]);
    expect(llamadas).toContainEqual(['eq', ['genero', 'FPS']]);
    expect(llamadas).toContainEqual(['eq', ['archivada', false]]);
    expect(llamadas).toContainEqual(['range', [20, 29]]);
    expect(
      llamadas
        .filter(([nombre]) => nombre === 'order')
        .map(([, args]) => args[0]),
    ).toEqual(['fecha', 'creada_en']);
  });

  it('listar: sin filtros opcionales no agrega condiciones; incluirArchivadas quita el filtro', async () => {
    const { repositorio, llamadas } = clienteFalso({
      consulta: { data: [], error: null },
    });

    await repositorio.listar({
      incluirArchivadas: true,
      limite: 5,
      desplazamiento: 0,
    });

    expect(
      llamadas.some(([nombre]) => nombre === 'ilike' || nombre === 'eq'),
    ).toBe(false);
  });

  it('todas: pide la vista de historial solo con incluirVersiones', async () => {
    const vigentes = clienteFalso({ consulta: { data: [], error: null } });
    const historial = clienteFalso({ consulta: { data: [], error: null } });

    await vigentes.repositorio.todas({ incluirVersiones: false });
    await historial.repositorio.todas({ incluirVersiones: true });

    expect(vigentes.llamadas[0]).toEqual(['from', ['estampas_vigentes']]);
    expect(historial.llamadas[0]).toEqual(['from', ['estampas_historial']]);
  });
});

describe('SupabaseEstampaRepository — escritura', () => {
  it('crear: llama a la RPC con el documento y la versión del formato, y relee la estampa', async () => {
    const id = randomUUID();
    const { repositorio, llamadas } = clienteFalso({
      rpc: { data: { id, numeroVersion: 1 }, error: null },
      consulta: { data: filaValida(id), error: null },
    });

    const creada = await repositorio.crear(datosValidos());

    expect(llamadas[0]).toEqual([
      'rpc',
      ['crear_estampa', { p_datos: datosValidos(), p_version_formato: 1 }],
    ]);
    expect(creada.id).toBe(id);
  });

  it('corregir: envía id y versión base a la RPC', async () => {
    const id = randomUUID();
    const { repositorio, llamadas } = clienteFalso({
      rpc: { data: { id, numeroVersion: 2 }, error: null },
      consulta: {
        data: { ...filaValida(id), numero_version: 2, total_versiones: 2 },
        error: null,
      },
    });

    await repositorio.corregir(id, 1, datosValidos());

    expect(llamadas[0]).toEqual([
      'rpc',
      [
        'corregir_estampa',
        {
          p_id: id,
          p_version_base: 1,
          p_datos: datosValidos(),
          p_version_formato: 1,
        },
      ],
    ]);
  });

  it('una respuesta de escritura con otra forma es un fallo de almacenamiento', async () => {
    const { repositorio } = clienteFalso({
      rpc: { data: { algo: 'raro' }, error: null },
    });

    await expect(repositorio.crear(datosValidos())).rejects.toBeInstanceOf(
      AlmacenamientoError,
    );
  });
});
