import { beforeEach, describe, expect, it } from 'vitest';
import type { DatosEstampa } from '@domain/estampa/index.js';
import {
  clonar,
  leerEjemplo,
} from '../../domain/estampa/__tests__/fixtures.js';
import {
  crearHarness,
  datosRts,
  datosValidos,
  jsonDe,
  textoDe,
} from './harness.js';
import type { Harness } from './harness.js';

type Vista = {
  id: string;
  archivada: boolean;
  numeroVersion: number;
  totalVersiones: number;
  mensaje?: string;
};
type Envoltorio = {
  formato: string;
  version: number;
  estampas: Array<Record<string, unknown>>;
};

let h: Harness;
beforeEach(async () => {
  h = await crearHarness();
});

const crear = async (datos: DatosEstampa = datosValidos()): Promise<Vista> =>
  jsonDe<Vista>(
    await h.client.callTool({
      name: 'crear_estampa',
      arguments: datos as never,
    }),
  );
const llamar = (name: string, args: Record<string, unknown>) =>
  h.client.callTool({ name, arguments: args as never });
const exportar = async (client = h.client, incluirVersiones = false) =>
  jsonDe<Envoltorio>(
    await client.callTool({
      name: 'exportar',
      arguments: { incluirVersiones },
    }),
  );

describe('archivar_estampa', () => {
  it('archiva sin borrar: conserva las versiones y sale en exportar con archivada: true', async () => {
    const { id } = await crear();
    await llamar('corregir_estampa', {
      id,
      cambios: { sistema: { dpi: 800 } },
    });

    const respuesta = jsonDe<Vista>(await llamar('archivar_estampa', { id }));
    const exportada = await exportar(h.client, true);

    expect(respuesta.archivada).toBe(true);
    expect(respuesta.totalVersiones).toBe(2);
    expect(respuesta.mensaje).toContain('No se borró nada');
    expect(exportada.estampas).toHaveLength(2);
    expect(exportada.estampas.every((e) => e.archivada === true)).toBe(true);
  });

  it('es idempotente y lo dice', async () => {
    const { id } = await crear();
    await llamar('archivar_estampa', { id });

    const otra = jsonDe<Vista>(await llamar('archivar_estampa', { id }));

    expect(otra.mensaje).toContain('Ya estaba archivada');
    expect(otra.totalVersiones).toBe(1);
  });

  it('una estampa inexistente da un error claro', async () => {
    const respuesta = await llamar('archivar_estampa', {
      id: '7d1c2f4e-0000-4000-8000-0000000000ff',
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('No existe una estampa');
  });

  it('la estampa archivada sigue accesible con ver_estampa, y marcada', async () => {
    const { id } = await crear();
    await llamar('archivar_estampa', { id });

    const vista = jsonDe<Vista>(await llamar('ver_estampa', { id }));

    expect(vista.archivada).toBe(true);
  });

  it('listar_estampas la oculta por defecto y la muestra con incluirArchivadas', async () => {
    const { id } = await crear();
    await crear(datosRts());
    await llamar('archivar_estampa', { id });
    const lista = async (args: Record<string, unknown>) =>
      jsonDe<{ estampas: Array<{ id: string; archivada: boolean }> }>(
        await llamar('listar_estampas', args),
      ).estampas;

    expect((await lista({})).map((e) => e.id)).not.toContain(id);
    const todas = await lista({ incluirArchivadas: true });
    expect(todas.map((e) => e.id)).toContain(id);
    expect(todas.find((e) => e.id === id)?.archivada).toBe(true);
  });

  it('no hay ninguna herramienta que borre o desarchive', async () => {
    const { tools } = await h.client.listTools();

    expect(
      tools
        .map((t) => t.name)
        .filter((n) => /borrar|eliminar|delete|desarchivar/i.test(n)),
    ).toEqual([]);
  });
});

describe('importar_json', () => {
  it('por defecto es una simulación: reporta pero no escribe', async () => {
    const envoltorio = leerEjemplo('export-vigentes.json') as Record<
      string,
      unknown
    >;

    const respuesta = jsonDe<{
      mensaje: string;
      aplicada: boolean;
      estampasNuevas: number;
    }>(await llamar('importar_json', { envoltorio }));

    expect(respuesta.aplicada).toBe(false);
    expect(respuesta.estampasNuevas).toBe(2);
    expect(respuesta.mensaje).toContain('Simulación: no se escribió nada');
    expect((await exportar()).estampas).toHaveLength(0);
  });

  it('con dryRun=false aplica, y los ids y la marca archivada se conservan', async () => {
    const envoltorio = leerEjemplo('export-vigentes.json') as Record<
      string,
      unknown
    >;

    const respuesta = jsonDe<{
      aplicada: boolean;
      estampasNuevas: number;
      versionesNuevas: number;
    }>(await llamar('importar_json', { envoltorio, dryRun: false }));

    expect(respuesta).toMatchObject({
      aplicada: true,
      estampasNuevas: 2,
      versionesNuevas: 2,
    });
    const exportada = await exportar();
    expect(exportada.estampas.map((e) => e.id).sort()).toEqual([
      '7d1c2f4e-0000-4000-8000-000000000001',
      '7d1c2f4e-0000-4000-8000-000000000002',
    ]);
    expect(
      exportada.estampas.find(
        (e) => e.id === '7d1c2f4e-0000-4000-8000-000000000002',
      )?.archivada,
    ).toBe(true);
  });

  it('un envoltorio con activas las repone al aplicar; en simulación no escribe; sin el campo no falla', async () => {
    const envoltorio = clonar(
      leerEjemplo('export-vigentes.json'),
    ) as Envoltorio & { activas?: unknown[] };
    const [primera] = envoltorio.estampas;
    const juego = (primera!.juego as { nombre: string }).nombre;
    envoltorio.activas = [{ juego, estampaId: primera!.id, numeroVersion: 1 }];
    const activaDeHoy = async () =>
      jsonDe<{ activa: unknown }>(await llamar('activa_por_juego', { juego }))
        .activa;

    const simulada = jsonDe<{ activas: { repuestas: string[] } }>(
      await llamar('importar_json', { envoltorio }),
    );
    expect(simulada.activas.repuestas).toEqual([juego]);
    expect(await activaDeHoy()).toBeFalsy();

    const aplicada = jsonDe<{ activas: { repuestas: string[] } }>(
      await llamar('importar_json', { envoltorio, dryRun: false }),
    );
    expect(aplicada.activas.repuestas).toEqual([juego]);
    expect(await activaDeHoy()).toBeTruthy();

    const { activas: _sinCampo, ...viejo } = envoltorio;
    const sinActivas = jsonDe<{ activas: { repuestas: string[] } }>(
      await llamar('importar_json', { envoltorio: viejo, dryRun: false }),
    );
    expect(sinActivas.activas.repuestas).toEqual([]);
  });

  it('importar de nuevo omite lo existente y no cambia nada', async () => {
    const envoltorio = leerEjemplo('export-vigentes.json') as Record<
      string,
      unknown
    >;
    await llamar('importar_json', { envoltorio, dryRun: false });

    const segunda = jsonDe<{ estampasNuevas: number; omitidas: string[] }>(
      await llamar('importar_json', { envoltorio, dryRun: false }),
    );

    expect(segunda.estampasNuevas).toBe(0);
    expect(segunda.omitidas).toHaveLength(2);
  });

  it('rechaza otro formato y una versión desconocida con un mensaje claro, sin escribir', async () => {
    const base = clonar(leerEjemplo('export-vigentes.json')) as Record<
      string,
      unknown
    >;

    const otroFormato = await llamar('importar_json', {
      envoltorio: { ...base, formato: 'otra-cosa' },
      dryRun: false,
    });
    const futura = await llamar('importar_json', {
      envoltorio: { ...base, version: 2 },
      dryRun: false,
    });

    expect(textoDe(otroFormato)).toContain(
      'No es una exportación de ladder-lab',
    );
    expect(textoDe(futura)).toContain('Versión de formato no soportada: 2');
    expect((await exportar()).estampas).toHaveLength(0);
  });

  it.each([
    {},
    { estampas: 'no es un arreglo' },
    { formato: 'ladder-lab.export' },
  ])(
    'rechaza una entrada que no es una exportación: %j',
    async (envoltorio) => {
      const respuesta = await llamar('importar_json', {
        envoltorio,
        dryRun: false,
      });

      expect(respuesta.isError).toBe(true);
    },
  );

  it('es todo o nada: un derivadaDe que no existe rechaza el lote entero', async () => {
    const envoltorio = clonar(
      leerEjemplo('export-vigentes.json'),
    ) as Envoltorio;
    envoltorio.estampas[1] = {
      ...envoltorio.estampas[1],
      derivadaDe: '7d1c2f4e-0000-4000-8000-0000000000ff',
    };

    const respuesta = await llamar('importar_json', {
      envoltorio: envoltorio as never,
      dryRun: false,
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('no existe');
    expect((await exportar()).estampas).toHaveLength(0);
  });

  it('declara que no es destructiva', async () => {
    const { tools } = await h.client.listTools();

    expect(
      tools.find((t) => t.name === 'importar_json')?.annotations
        ?.destructiveHint,
    ).toBe(false);
  });
});

describe('exportar → importar entre dos servidores (restauración por herramientas)', () => {
  it('un servidor vacío queda idéntico al original, versiones y archivadas incluidas', async () => {
    const a = await crear();
    await llamar('corregir_estampa', {
      id: a.id,
      cambios: { notas: 'segunda' },
    });
    const b = await crear({ ...datosRts(), derivadaDe: a.id });
    await llamar('archivar_estampa', { id: b.id });
    const respaldo = await exportar(h.client, true);

    const vacio = await crearHarness();
    const resultado = jsonDe<{
      estampasNuevas: number;
      versionesNuevas: number;
      aplicada: boolean;
    }>(
      await vacio.client.callTool({
        name: 'importar_json',
        arguments: { envoltorio: respaldo as never, dryRun: false },
      }),
    );

    expect(resultado).toMatchObject({
      estampasNuevas: 2,
      versionesNuevas: 3,
      aplicada: true,
    });
    expect(await exportar(vacio.client, true)).toEqual(respaldo);
  });
});
