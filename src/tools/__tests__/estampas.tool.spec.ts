import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryEstampaRepository } from '@data/index.js';
import type { DatosEstampa } from '@domain/estampa/index.js';
import { clonar } from '../../domain/estampa/__tests__/fixtures.js';
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
  numeroVersion: number;
  totalVersiones: number;
  archivada: boolean;
  estampa: DatosEstampa;
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

const corregir = (id: string, cambios: unknown) =>
  h.client.callTool({
    name: 'corregir_estampa',
    arguments: { id, cambios } as never,
  });

describe('tools/list', () => {
  it('expone exactamente las herramientas de F1, F2 y F3', async () => {
    const { tools } = await h.client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'archivar_estampa',
        'comparar_estampas',
        'corregir_estampa',
        'crear_estampa',
        'exportar',
        'historial_versiones',
        'importar_json',
        'listar_estampas',
        'matches_perfectos',
        'mejor_por_juego',
        'ver_estampa',
      ].sort(),
    );
  });

  it('las de lectura declaran readOnly y ninguna es destructiva', async () => {
    const { tools } = await h.client.listTools();
    const porNombre = new Map(tools.map((t) => [t.name, t.annotations]));

    for (const lectura of ['ver_estampa', 'listar_estampas', 'exportar']) {
      expect(porNombre.get(lectura)?.readOnlyHint).toBe(true);
    }
    for (const t of tools) {
      expect(t.annotations?.destructiveHint).toBe(false);
    }
  });

  it('crear_estampa advierte que otra etapa es otra estampa', async () => {
    const { tools } = await h.client.listTools();
    const crearTool = tools.find((t) => t.name === 'crear_estampa');

    expect(crearTool?.description).toContain('OTRA estampa');
  });
});

describe('crear_estampa', () => {
  it('crea la versión 1 y devuelve el id', async () => {
    const creada = await crear();

    expect(creada.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(creada.numeroVersion).toBe(1);
    expect(creada.totalVersiones).toBe(1);
    expect(creada.estampa.juego.nombre).toBe('Counter-Strike');
  });

  it('guarda desconocido y no_aplica tal cual', async () => {
    const creada = await crear(datosRts());

    expect(creada.estampa.sistema.dpi).toBe('desconocido');
    expect(creada.estampa.enJuego.sensibilidad).toBe('no_aplica');
    expect(creada.estampa.enJuego.rawInput).toBe('no_aplica');
  });

  it('rechaza una clave que ya no existe (juegoDelLogro) sin guardar nada', async () => {
    const datos = clonar(datosValidos()) as unknown as Record<
      string,
      Record<string, unknown>
    >;
    datos.resultado = { ...datos.resultado, juegoDelLogro: 'x' };

    const respuesta = await h.client
      .callTool({ name: 'crear_estampa', arguments: datos as never })
      .catch((error: unknown) => ({
        isError: true,
        content: [{ type: 'text', text: String(error) }],
      }));

    expect(respuesta.isError).toBe(true);
    expect(await h.repository.todas({ incluirVersiones: false })).toHaveLength(
      0,
    );
  });

  it('rechaza el género desconocido y explica el motivo', async () => {
    const datos = clonar(datosValidos()) as unknown as Record<
      string,
      Record<string, unknown>
    >;
    datos.juego = { ...datos.juego, genero: 'desconocido' };

    const respuesta = await h.client
      .callTool({ name: 'crear_estampa', arguments: datos as never })
      .catch((error: unknown) => ({
        isError: true,
        content: [{ type: 'text', text: String(error) }],
      }));

    expect(respuesta.isError).toBe(true);
    expect(await h.repository.todas({ incluirVersiones: false })).toHaveLength(
      0,
    );
  });

  it('sin etapa ni fecha: error legible del dominio, nada guardado', async () => {
    const datos = clonar(datosValidos()) as unknown as Record<
      string,
      Record<string, unknown>
    >;
    const { fecha: _fecha, ...juegoSinFecha } = datos.juego!;
    datos.juego = juegoSinFecha;

    const respuesta = await h.client.callTool({
      name: 'crear_estampa',
      arguments: datos as never,
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('etapa o la fecha');
    expect(await h.repository.todas({ incluirVersiones: false })).toHaveLength(
      0,
    );
  });

  it('derivadaDe a una estampa inexistente se rechaza', async () => {
    const datos = {
      ...datosValidos(),
      derivadaDe: '7d1c2f4e-0000-4000-8000-0000000000ff',
    };

    const respuesta = await h.client.callTool({
      name: 'crear_estampa',
      arguments: datos as never,
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('no existe');
  });

  it('derivadaDe a una estampa existente se acepta, también de otro juego', async () => {
    const origen = await crear();

    const derivada = await crear({ ...datosRts(), derivadaDe: origen.id });

    expect(derivada.estampa.derivadaDe).toBe(origen.id);
  });
});

describe('ver_estampa', () => {
  it('devuelve la versión vigente con su número y el total', async () => {
    const { id } = await crear();
    await corregir(id, { sistema: { dpi: 800 } });

    const vista = jsonDe<Vista>(
      await h.client.callTool({ name: 'ver_estampa', arguments: { id } }),
    );

    expect(vista.numeroVersion).toBe(2);
    expect(vista.totalVersiones).toBe(2);
    expect(vista.estampa.sistema.dpi).toBe(800);
  });

  it('un id inexistente da un error claro', async () => {
    const respuesta = await h.client.callTool({
      name: 'ver_estampa',
      arguments: { id: '7d1c2f4e-0000-4000-8000-0000000000ff' },
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('No existe una estampa');
  });

  it('un id que no es uuid se rechaza en la entrada', async () => {
    const respuesta = await h.client
      .callTool({ name: 'ver_estampa', arguments: { id: 'abc' } })
      .catch(() => ({ isError: true }));

    expect(respuesta.isError).toBe(true);
  });
});

describe('corregir_estampa', () => {
  it('crea la versión 2 y la versión 1 sigue intacta', async () => {
    const { id } = await crear();

    const respuesta = await corregir(id, { sistema: { dpi: 800 } });
    const corregida = jsonDe<Vista & { mensaje: string }>(respuesta);
    const historial = await h.repository.todas({ incluirVersiones: true });

    expect(corregida.numeroVersion).toBe(2);
    expect(corregida.mensaje).toContain('la versión 1 se conserva');
    expect(historial.map((v) => v.numeroVersion)).toEqual([1, 2]);
    expect(historial[0]?.datos.sistema.dpi).toBe(450);
    expect(historial[1]?.datos.sistema.dpi).toBe(800);
  });

  it('solo cambia lo enviado: el resto se conserva', async () => {
    const { id } = await crear();

    const corregida = jsonDe<Vista>(
      await corregir(id, { resultado: { rango: 'Águila' } }),
    );

    expect(corregida.estampa.resultado.rango).toBe('Águila');
    expect(corregida.estampa.resultado.certeza).toBe('recordado');
    expect(corregida.estampa.sistema.dpi).toBe(450);
  });

  it('una corrección que no cambia nada se rechaza y no crea versión', async () => {
    const { id } = await crear();

    const respuesta = await corregir(id, { sistema: { dpi: 450 } });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('no cambia ningún dato');
    expect((await h.repository.todas({ incluirVersiones: true })).length).toBe(
      1,
    );
  });

  it('cambios vacíos tampoco crean versión', async () => {
    const { id } = await crear();

    const respuesta = await corregir(id, {});

    expect(respuesta.isError).toBe(true);
  });

  it('un cambio que deja la estampa inválida se rechaza sin tocar nada', async () => {
    const { id } = await crear();

    const respuesta = await corregir(id, { juego: { fecha: 'mañana' } }).catch(
      () => ({ isError: true }),
    );

    expect(respuesta.isError).toBe(true);
    expect((await h.repository.obtener(id))?.numeroVersion).toBe(1);
  });

  it('una estampa inexistente da un error claro', async () => {
    const respuesta = await corregir('7d1c2f4e-0000-4000-8000-0000000000ff', {
      sistema: { dpi: 800 },
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('No existe una estampa');
  });

  it('no permite derivar de sí misma', async () => {
    const { id } = await crear();

    const respuesta = await corregir(id, { derivadaDe: id });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('sí misma');
  });

  it('permite agregar derivadaDe a otra estampa existente', async () => {
    const origen = await crear();
    const { id } = await crear(datosRts());

    const corregida = jsonDe<Vista>(
      await corregir(id, { derivadaDe: origen.id }),
    );

    expect(corregida.estampa.derivadaDe).toBe(origen.id);
    expect(corregida.numeroVersion).toBe(2);
  });

  it('una carrera: si la versión cambió entre leer y escribir, falla sin pisar', async () => {
    const { id } = await crear();
    const repo = h.repository;
    const actual = await repo.obtener(id);

    await repo.corregir(id, actual!.numeroVersion, {
      ...actual!.datos,
      notas: 'otra sesión',
    });
    const resultado = repo.corregir(id, actual!.numeroVersion, {
      ...actual!.datos,
      notas: 'tarde',
    });

    await expect(resultado).rejects.toThrow(/cambió mientras se corregía/);
    expect((await repo.obtener(id))?.datos.notas).toBe('otra sesión');
  });
});

describe('listar_estampas', () => {
  const listar = async (args: Record<string, unknown> = {}) =>
    jsonDe<{
      devueltas: number;
      hayMas: boolean;
      estampas: Array<{ juego: string; genero: string; numeroVersion: number }>;
    }>(await h.client.callTool({ name: 'listar_estampas', arguments: args }));

  it('una lista vacía no es un error', async () => {
    const lista = await listar();

    expect(lista.devueltas).toBe(0);
    expect(lista.hayMas).toBe(false);
    expect(lista.estampas).toEqual([]);
  });

  it('filtra por juego sin distinguir mayúsculas y por género', async () => {
    await crear();
    await crear(datosRts());

    expect(
      (await listar({ juego: 'counter-strike' })).estampas.map((e) => e.juego),
    ).toEqual(['Counter-Strike']);
    expect(
      (await listar({ genero: 'RTS' })).estampas.map((e) => e.genero),
    ).toEqual(['RTS']);
    expect((await listar({ juego: 'Dota' })).devueltas).toBe(0);
  });

  it('ordena por fecha, la más reciente primero, y las sin fecha al final', async () => {
    const vieja = datosValidos();
    vieja.juego.fecha = '2024-01-01';
    const nueva = datosValidos();
    nueva.juego.fecha = '2025-09-01';
    await crear(vieja);
    await crear(datosRts());
    await crear(nueva);

    const lista = await listar();

    expect(lista.estampas.map((e) => e.juego)).toEqual([
      'Counter-Strike',
      'Counter-Strike',
      'StarCraft II',
    ]);
    expect(
      (
        await h.repository.listar({
          incluirArchivadas: false,
          limite: 3,
          desplazamiento: 0,
        })
      ).map((e) => e.datos.juego.fecha),
    ).toEqual(['2025-09-01', '2024-01-01', undefined]);
  });

  it('pagina y avisa si hay más', async () => {
    await crear();
    await crear();
    await crear();

    const primera = await listar({ limite: 2 });
    const segunda = await listar({ limite: 2, desplazamiento: 2 });

    expect(primera.devueltas).toBe(2);
    expect(primera.hayMas).toBe(true);
    expect(segunda.devueltas).toBe(1);
    expect(segunda.hayMas).toBe(false);
  });

  it('muestra la versión vigente de cada estampa', async () => {
    const { id } = await crear();
    await corregir(id, { sistema: { dpi: 800 } });

    expect((await listar()).estampas[0]?.numeroVersion).toBe(2);
  });

  it('un juego con % o _ no actúa como patrón', async () => {
    await crear();

    expect((await listar({ juego: '%' })).devueltas).toBe(0);
    expect((await listar({ juego: 'Counter_Strike' })).devueltas).toBe(0);
  });
});

describe('exportar', () => {
  type Envoltorio = {
    formato: string;
    version: number;
    estampas: Array<{
      id: string;
      numeroVersion?: number;
      derivadaDe?: string;
    }>;
  };
  const exportar = async (args: Record<string, unknown> = {}) =>
    jsonDe<Envoltorio>(
      await h.client.callTool({ name: 'exportar', arguments: args }),
    );

  it('devuelve un envoltorio con id en cada documento', async () => {
    const { id } = await crear();

    const envoltorio = await exportar();

    expect(envoltorio.formato).toBe('ladder-lab.export');
    expect(envoltorio.version).toBe(1);
    expect(envoltorio.estampas).toHaveLength(1);
    expect(envoltorio.estampas[0]?.id).toBe(id);
    expect(envoltorio.estampas[0]?.numeroVersion).toBeUndefined();
  });

  it('sin versiones exporta solo la vigente; con versiones, todas con su número', async () => {
    const { id } = await crear();
    await corregir(id, { sistema: { dpi: 800 } });

    const vigentes = await exportar();
    const completo = await exportar({ incluirVersiones: true });

    expect(vigentes.estampas).toHaveLength(1);
    expect(completo.estampas.map((e) => e.numeroVersion)).toEqual([1, 2]);
  });

  it('todo derivadaDe se resuelve contra un id del mismo envoltorio', async () => {
    const origen = await crear();
    await crear({ ...datosRts(), derivadaDe: origen.id });

    const envoltorio = await exportar();
    const ids = new Set(envoltorio.estampas.map((e) => e.id));

    const derivadas = envoltorio.estampas.filter(
      (e) => e.derivadaDe !== undefined,
    );
    expect(derivadas).toHaveLength(1);
    expect(derivadas.every((e) => ids.has(e.derivadaDe!))).toBe(true);
  });

  it('una base vacía exporta un envoltorio vacío válido', async () => {
    expect((await exportar()).estampas).toEqual([]);
  });
});

describe('errores inesperados', () => {
  it('un fallo de la base se registra y el usuario recibe un mensaje genérico', async () => {
    const repositorioRoto = new InMemoryEstampaRepository();
    repositorioRoto.listar = () =>
      Promise.reject(new Error('detalle-interno-secreto'));
    const roto = await crearHarness(repositorioRoto);

    const respuesta = await roto.client.callTool({
      name: 'listar_estampas',
      arguments: {},
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('Error interno');
    expect(textoDe(respuesta)).not.toContain('detalle-interno-secreto');
    expect(roto.lineasDeLog.join('')).toContain('detalle-interno-secreto');
  });
});
