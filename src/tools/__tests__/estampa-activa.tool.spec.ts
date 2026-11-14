import { describe, expect, it } from 'vitest';
import type { DatosEstampa } from '@domain/estampa/index.js';
import {
  crearHarness,
  datosCompletos,
  datosRts,
  datosValidos,
  jsonDe,
  textoDe,
} from './harness.js';
import type { Harness } from './harness.js';

const STARCRAFT = 'StarCraft II';

type Vista = {
  id: string;
  numeroVersion: number;
  totalVersiones: number;
  mensaje?: string;
  siguiente?: string;
  estampa: DatosEstampa;
};
type Activa = Vista & {
  juego: string;
  elegidaEn: string;
  anterior?: { id: string; numeroVersion: number } | null;
};
type SinActiva = { juego: string; activa: null; mensaje: string };
type Resumen = { id: string; activa: boolean; versionActiva?: number };

const conJuego = (datos: DatosEstampa, nombre: string): DatosEstampa => ({
  ...datos,
  juego: { ...datos.juego, nombre },
});

const llamar = (h: Harness, name: string, args: Record<string, unknown>) =>
  h.client.callTool({ name, arguments: args as never });

const crear = async (
  h: Harness,
  datos: DatosEstampa = conJuego(datosCompletos(), STARCRAFT),
): Promise<Vista> => jsonDe<Vista>(await llamar(h, 'crear_estampa', datos));

describe('marcar_activa y activa_por_juego', () => {
  it('la activa de un juego trae la versión entera, con archivosConfig, sin distinguir mayúsculas', async () => {
    const h = await crearHarness();
    const { id } = await crear(h);

    const marcada = jsonDe<Activa>(await llamar(h, 'marcar_activa', { id }));
    const leida = jsonDe<Activa>(
      await llamar(h, 'activa_por_juego', { juego: 'starcraft ii' }),
    );

    expect(marcada.juego).toBe(STARCRAFT);
    expect(marcada.numeroVersion).toBe(1);
    expect(leida.id).toBe(id);
    expect(leida.juego).toBe(STARCRAFT);
    expect(leida.estampa).toEqual(conJuego(datosCompletos(), STARCRAFT));
    expect(leida.estampa.enJuego.archivosConfig).toEqual(
      datosCompletos().enJuego.archivosConfig,
    );
  });

  it('sin activa lo dice y explica cómo marcarla: nunca elige una por versión', async () => {
    const h = await crearHarness();
    await crear(h);
    await crear(h);

    const respuesta = await llamar(h, 'activa_por_juego', {
      juego: STARCRAFT,
    });
    const sinActiva = jsonDe<SinActiva>(respuesta);

    expect(respuesta.isError).toBeFalsy();
    expect(sinActiva.activa).toBeNull();
    expect(sinActiva.mensaje).toContain('no tiene una estampa activa');
    expect(sinActiva.mensaje).toContain('marcar_activa');
  });

  it('un juego sin ninguna estampa lo dice distinto', async () => {
    const h = await crearHarness();

    const sinActiva = jsonDe<SinActiva>(
      await llamar(h, 'activa_por_juego', { juego: 'No Existe' }),
    );

    expect(sinActiva.activa).toBeNull();
    expect(sinActiva.mensaje).toContain('No hay estampas de "No Existe"');
  });

  it('marcar otra del mismo juego reemplaza la anterior y lo dice', async () => {
    const h = await crearHarness();
    const primera = await crear(h);
    const segunda = await crear(h);
    await llamar(h, 'marcar_activa', { id: primera.id });

    const marcada = jsonDe<Activa>(
      await llamar(h, 'marcar_activa', { id: segunda.id }),
    );
    const leida = jsonDe<Activa>(
      await llamar(h, 'activa_por_juego', { juego: STARCRAFT }),
    );

    expect(marcada.anterior).toEqual({ id: primera.id, numeroVersion: 1 });
    expect(marcada.mensaje).toContain(primera.id);
    expect(leida.id).toBe(segunda.id);
  });

  it('con numeroVersion fija esa versión y avisa si hay una más nueva sin marcar', async () => {
    const h = await crearHarness();
    const { id } = await crear(h);
    await llamar(h, 'corregir_estampa', {
      id,
      cambios: { notas: 'segunda' },
    });

    const marcada = jsonDe<Activa>(
      await llamar(h, 'marcar_activa', { id, numeroVersion: 1 }),
    );
    const leida = jsonDe<Activa>(
      await llamar(h, 'activa_por_juego', { juego: STARCRAFT }),
    );

    expect(marcada.numeroVersion).toBe(1);
    expect(leida.numeroVersion).toBe(1);
    expect(leida.totalVersiones).toBe(2);
    expect(leida.mensaje).toContain('versión 2');
  });

  it('una estampa archivada no se puede marcar', async () => {
    const h = await crearHarness();
    const { id } = await crear(h);
    await llamar(h, 'archivar_estampa', { id });

    const respuesta = await llamar(h, 'marcar_activa', { id });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('archivada');
  });

  it('una versión que no existe da un error claro', async () => {
    const h = await crearHarness();
    const { id } = await crear(h);

    const respuesta = await llamar(h, 'marcar_activa', {
      id,
      numeroVersion: 5,
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('versión 5');
  });

  it('archivar la activa deja el juego sin activa y lo dice', async () => {
    const h = await crearHarness();
    const { id } = await crear(h);
    await llamar(h, 'marcar_activa', { id });

    const archivada = jsonDe<Vista>(
      await llamar(h, 'archivar_estampa', { id }),
    );
    const sinActiva = jsonDe<SinActiva>(
      await llamar(h, 'activa_por_juego', { juego: STARCRAFT }),
    );

    expect(archivada.mensaje).toContain(
      `"${STARCRAFT}" queda sin estampa activa`,
    );
    expect(sinActiva.activa).toBeNull();
  });

  it('archivar una que no es la activa no habla de activas', async () => {
    const h = await crearHarness();
    const activa = await crear(h);
    const otra = await crear(h);
    await llamar(h, 'marcar_activa', { id: activa.id });

    const archivada = jsonDe<Vista>(
      await llamar(h, 'archivar_estampa', { id: otra.id }),
    );

    expect(archivada.mensaje).not.toContain('activa');
  });
});

describe('listar_estampas y ver_estampa muestran cuál es la activa', () => {
  it('listar marca la activa con su versión y las demás como no activas', async () => {
    const h = await crearHarness();
    const activa = await crear(h);
    const otra = await crear(h);
    await llamar(h, 'marcar_activa', { id: activa.id });

    const { estampas } = jsonDe<{ estampas: Resumen[] }>(
      await llamar(h, 'listar_estampas', { juego: STARCRAFT }),
    );

    expect(estampas.find((e) => e.id === activa.id)).toMatchObject({
      activa: true,
      versionActiva: 1,
    });
    expect(estampas.find((e) => e.id === otra.id)?.activa).toBe(false);
  });

  it('ver_estampa dice si es la activa de su juego', async () => {
    const h = await crearHarness();
    const activa = await crear(h);
    const otra = await crear(h);
    await llamar(h, 'marcar_activa', { id: activa.id });

    const vistaActiva = jsonDe<Resumen>(
      await llamar(h, 'ver_estampa', { id: activa.id }),
    );
    const vistaOtra = jsonDe<Resumen>(
      await llamar(h, 'ver_estampa', { id: otra.id }),
    );

    expect(vistaActiva).toMatchObject({ activa: true, versionActiva: 1 });
    expect(vistaOtra.activa).toBe(false);
  });
});

describe('crear_estampa y corregir_estampa sugieren marcarla', () => {
  it('el texto de éxito nombra marcar_activa y /gameconfig:run-rts', async () => {
    const h = await crearHarness();
    const creada = await crear(h, datosValidos());
    const corregida = jsonDe<Vista>(
      await llamar(h, 'corregir_estampa', {
        id: creada.id,
        cambios: { notas: 'otra' },
      }),
    );

    for (const vista of [creada, corregida]) {
      expect(vista.siguiente).toContain('marcar_activa');
      expect(vista.siguiente).toContain('/gameconfig:run-rts');
    }
  });
});

describe('marcarActiva al crear y corregir', () => {
  it('crear_estampa con marcarActiva la deja como la activa de su juego', async () => {
    const h = await crearHarness();
    const anterior = await crear(h);

    const creada = jsonDe<Vista & { activa: Activa }>(
      await llamar(h, 'crear_estampa', {
        ...conJuego(datosCompletos(), STARCRAFT),
        marcarActiva: true,
      }),
    );
    const leida = jsonDe<Activa>(
      await llamar(h, 'activa_por_juego', { juego: STARCRAFT }),
    );

    expect(creada.activa).toMatchObject({ juego: STARCRAFT, numeroVersion: 1 });
    expect(creada.estampa).toEqual(conJuego(datosCompletos(), STARCRAFT));
    expect(leida.id).toBe(creada.id);
    expect(leida.id).not.toBe(anterior.id);
  });

  it('crear_estampa sin marcarActiva no toca la activa', async () => {
    const h = await crearHarness();
    const activa = await crear(h);
    await llamar(h, 'marcar_activa', { id: activa.id });

    await crear(h);
    const leida = jsonDe<Activa>(
      await llamar(h, 'activa_por_juego', { juego: STARCRAFT }),
    );

    expect(leida.id).toBe(activa.id);
  });

  it('corregir la activa avisa que la activa sigue en la versión anterior', async () => {
    const h = await crearHarness();
    const { id } = await crear(h);
    await llamar(h, 'marcar_activa', { id });

    const corregida = jsonDe<Vista>(
      await llamar(h, 'corregir_estampa', { id, cambios: { notas: 'dos' } }),
    );
    const leida = jsonDe<Activa>(
      await llamar(h, 'activa_por_juego', { juego: STARCRAFT }),
    );

    expect(corregida.numeroVersion).toBe(2);
    expect(corregida.mensaje).toContain(
      `La activa de "${STARCRAFT}" sigue siendo la versión 1`,
    );
    expect(leida.numeroVersion).toBe(1);
  });

  it('corregir con marcarActiva deja activa la versión nueva y no avisa nada', async () => {
    const h = await crearHarness();
    const { id } = await crear(h);
    await llamar(h, 'marcar_activa', { id });

    const corregida = jsonDe<Vista>(
      await llamar(h, 'corregir_estampa', {
        id,
        cambios: { notas: 'dos' },
        marcarActiva: true,
      }),
    );
    const leida = jsonDe<Activa>(
      await llamar(h, 'activa_por_juego', { juego: STARCRAFT }),
    );

    expect(corregida.mensaje).not.toContain('sigue siendo');
    expect(leida.numeroVersion).toBe(2);
  });

  it('corregir una que no es la activa no habla de la activa', async () => {
    const h = await crearHarness();
    const { id } = await crear(h);

    const corregida = jsonDe<Vista>(
      await llamar(h, 'corregir_estampa', { id, cambios: { notas: 'dos' } }),
    );

    expect(corregida.mensaje).not.toContain('activa');
  });

  it('las descripciones piden PREGUNTAR antes de marcar y mostrar la activa de hoy', async () => {
    const h = await crearHarness();
    const { tools } = await h.client.listTools();

    for (const nombre of ['crear_estampa', 'corregir_estampa']) {
      const descripcion = tools.find((t) => t.name === nombre)?.description;
      expect(descripcion, nombre).toContain('¿La marco como la activa de');
      expect(descripcion, nombre).toContain('activa_por_juego');
    }
  });
});

describe('listados listos para elegir', () => {
  type Item = {
    id: string;
    juego: string;
    genero: string;
    etapa?: string;
    numeroVersion: number;
    fecha: string;
    rango: string;
    certeza: string;
    activa: boolean;
    etiqueta: string;
  };

  it('listar_estampas da juego, género, etapa, versión, fecha, rango, certeza y ✔ activa', async () => {
    const h = await crearHarness();
    const activa = await crear(h);
    await llamar(h, 'marcar_activa', { id: activa.id });
    await crear(h, conJuego(datosRts(), STARCRAFT));

    const { estampas } = jsonDe<{ estampas: Item[] }>(
      await llamar(h, 'listar_estampas', { juego: STARCRAFT }),
    );
    const marcada = estampas.find((e) => e.id === activa.id);
    const sinFecha = estampas.find((e) => e.id !== activa.id);

    expect(marcada).toMatchObject({
      juego: STARCRAFT,
      genero: 'FPS',
      numeroVersion: 1,
      fecha: '2025-06-01',
      activa: true,
    });
    expect(marcada?.etiqueta).toContain('✔ activa');
    expect(sinFecha?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sinFecha?.etapa).toBe('Temporada 3');
    expect(sinFecha?.etiqueta).not.toContain('✔');
  });

  it('activa_por_juego trae también las demás del juego para elegir otra', async () => {
    const h = await crearHarness();
    const activa = await crear(h);
    const otra = await crear(h);
    await llamar(h, 'marcar_activa', { id: activa.id });

    const { estampasDelJuego } = jsonDe<{ estampasDelJuego: Item[] }>(
      await llamar(h, 'activa_por_juego', { juego: STARCRAFT }),
    );

    expect(estampasDelJuego.map((e) => e.id).sort()).toEqual(
      [activa.id, otra.id].sort(),
    );
    expect(estampasDelJuego.find((e) => e.id === activa.id)?.activa).toBe(true);
  });

  it('mejor_por_juego marca cuál de las matches perfectos es la activa', async () => {
    const h = await crearHarness();
    const perfecta = (): DatosEstampa => {
      const datos = conJuego(datosValidos(), STARCRAFT);
      return {
        ...datos,
        resultado: { ...datos.resultado, matchPerfecto: true },
      };
    };
    const activa = await crear(h, perfecta());
    await crear(h, perfecta());
    await llamar(h, 'marcar_activa', { id: activa.id });

    const { estampas } = jsonDe<{ estampas: Item[] }>(
      await llamar(h, 'mejor_por_juego', { juego: STARCRAFT }),
    );

    expect(estampas.filter((e) => e.activa).map((e) => e.id)).toEqual([
      activa.id,
    ]);
    expect(estampas.every((e) => typeof e.etiqueta === 'string')).toBe(true);
  });
});

describe('nombres de juego', () => {
  it('activa_por_juego ignora los espacios de los extremos', async () => {
    const h = await crearHarness();
    const { id } = await crear(h);
    await llamar(h, 'marcar_activa', { id });

    const leida = jsonDe<Activa>(
      await llamar(h, 'activa_por_juego', { juego: '  starcraft ii  ' }),
    );

    expect(leida.id).toBe(id);
  });

  it('sin un juego con ese nombre, sugiere los parecidos en vez de responder vacío', async () => {
    const h = await crearHarness();
    await crear(h);

    const respuesta = jsonDe<SinActiva & { sugerencias: string[] }>(
      await llamar(h, 'activa_por_juego', { juego: 'Starcraft 2' }),
    );

    expect(respuesta.activa).toBeNull();
    expect(respuesta.sugerencias).toEqual([STARCRAFT]);
    expect(respuesta.mensaje).toContain(STARCRAFT);
  });
});

describe('activa no es match perfecto', () => {
  it('las descripciones lo distinguen', async () => {
    const h = await crearHarness();
    const { tools } = await h.client.listTools();

    for (const nombre of [
      'marcar_activa',
      'activa_por_juego',
      'mejor_por_juego',
    ]) {
      const descripcion = tools.find((t) => t.name === nombre)?.description;
      expect(descripcion, nombre).toMatch(/match perfecto/);
      expect(descripcion, nombre).toMatch(/activa/);
    }
  });
});
