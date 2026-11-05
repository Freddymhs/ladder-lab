import { beforeEach, describe, expect, it } from 'vitest';
import type { DatosEstampa } from '@domain/estampa/index.js';
import {
  crearHarness,
  datosRts,
  datosValidos,
  jsonDe,
  textoDe,
} from './harness.js';
import type { Harness } from './harness.js';

type Vista = { id: string };
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
const corregir = (id: string, cambios: unknown) =>
  llamar('corregir_estampa', { id, cambios });
const conMatch = (datos: DatosEstampa, valor: boolean): DatosEstampa => ({
  ...datos,
  resultado: { ...datos.resultado, matchPerfecto: valor },
});
const conJuego = (datos: DatosEstampa, nombre: string): DatosEstampa => ({
  ...datos,
  juego: { ...datos.juego, nombre },
});
const FALTANTE = '7d1c2f4e-0000-4000-8000-0000000000ff';

describe('historial_versiones', () => {
  type Historial = {
    totalVersiones: number;
    archivada: boolean;
    versiones: Array<{
      numeroVersion: number;
      inicial?: boolean;
      cambios?: Array<{ campo: string; antes: unknown; despues: unknown }>;
    }>;
  };
  const historial = async (id: string) =>
    jsonDe<Historial>(await llamar('historial_versiones', { id }));

  it('una estampa sin correcciones tiene solo la versión inicial', async () => {
    const { id } = await crear();

    const h1 = await historial(id);

    expect(h1.totalVersiones).toBe(1);
    expect(h1.versiones).toHaveLength(1);
    expect(h1.versiones[0]).toMatchObject({ numeroVersion: 1, inicial: true });
    expect(h1.versiones[0]?.cambios).toBeUndefined();
  });

  it('cada versión dice qué campos cambiaron respecto de la anterior', async () => {
    const { id } = await crear();
    await corregir(id, { sistema: { dpi: 800 } });
    await corregir(id, { resultado: { rango: 'Águila' }, notas: 'tercera' });

    const { versiones } = await historial(id);

    expect(versiones.map((v) => v.numeroVersion)).toEqual([1, 2, 3]);
    expect(versiones[1]?.cambios).toEqual([
      { campo: 'sistema.dpi', antes: 450, despues: 800 },
    ]);
    expect(versiones[2]?.cambios).toEqual([
      { campo: 'notas', antes: null, despues: 'tercera' },
      { campo: 'resultado.rango', antes: 'Global', despues: 'Águila' },
    ]);
  });

  it('pasar de "desconocido" a un valor se ve como cambio', async () => {
    const { id } = await crear(datosRts());
    await corregir(id, { sistema: { dpi: 450 } });

    const { versiones } = await historial(id);

    expect(versiones[1]?.cambios).toEqual([
      { campo: 'sistema.dpi', antes: 'desconocido', despues: 450 },
    ]);
  });

  it('funciona con una estampa archivada y lo indica', async () => {
    const { id } = await crear();
    await corregir(id, { notas: 'x' });
    await llamar('archivar_estampa', { id });

    const resultado = await historial(id);

    expect(resultado.archivada).toBe(true);
    expect(resultado.totalVersiones).toBe(2);
  });

  it('una estampa inexistente da un error claro', async () => {
    const respuesta = await llamar('historial_versiones', { id: FALTANTE });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('No existe una estampa');
  });

  it('no emite juicios sobre qué versión es mejor', async () => {
    const { id } = await crear();
    await corregir(id, { sistema: { dpi: 800 } });

    expect(
      textoDe(await llamar('historial_versiones', { id })).toLowerCase(),
    ).not.toMatch(/mejor|peor|recomend/);
  });
});

describe('comparar_estampas', () => {
  type Comparacion = {
    estampas: Array<{ id: string }>;
    diferencias: Array<{ campo: string; valores: Record<string, unknown> }>;
    incompletos: Array<{ campo: string; sinDato: string[] }>;
  };
  const comparar = async (ids: string[]) =>
    jsonDe<Comparacion>(await llamar('comparar_estampas', { ids }));

  it('lista las diferencias reales con el valor de cada estampa', async () => {
    const a = await crear();
    const b = await crear(
      conMatch(
        { ...datosValidos(), sistema: { ...datosValidos().sistema, dpi: 800 } },
        false,
      ),
    );

    const resultado = await comparar([a.id, b.id]);

    expect(resultado.estampas.map((e) => e.id)).toEqual([a.id, b.id]);
    const dpi = resultado.diferencias.find((d) => d.campo === 'sistema.dpi');
    expect(dpi?.valores).toEqual({ [a.id]: 450, [b.id]: 800 });
    expect(resultado.diferencias.map((d) => d.campo)).toContain(
      'resultado.matchPerfecto',
    );
  });

  it('"desconocido" contra un valor es un campo incompleto, no una diferencia', async () => {
    const a = await crear();
    const b = await crear({
      ...datosValidos(),
      sistema: { ...datosValidos().sistema, dpi: 'desconocido' },
    });

    const resultado = await comparar([a.id, b.id]);

    expect(resultado.diferencias.map((d) => d.campo)).not.toContain(
      'sistema.dpi',
    );
    expect(resultado.incompletos).toContainEqual({
      campo: 'sistema.dpi',
      sinDato: [b.id],
    });
  });

  it('compara la versión vigente de cada estampa', async () => {
    const a = await crear();
    const b = await crear();
    await corregir(b.id, { sistema: { dpi: 1600 } });

    const resultado = await comparar([a.id, b.id]);

    expect(
      resultado.diferencias.find((d) => d.campo === 'sistema.dpi')?.valores[
        b.id
      ],
    ).toBe(1600);
  });

  it('dos estampas idénticas no dan diferencias', async () => {
    const a = await crear();
    const b = await crear();

    const resultado = await comparar([a.id, b.id]);

    expect(resultado.diferencias).toEqual([]);
    expect(resultado.incompletos).toEqual([]);
  });

  it('compara estampas de distintos juegos y también archivadas', async () => {
    const a = await crear();
    const b = await crear(datosRts());
    await llamar('archivar_estampa', { id: b.id });

    const resultado = await comparar([a.id, b.id]);

    expect(resultado.diferencias.map((d) => d.campo)).toContain('juego.nombre');
  });

  it('rechaza ids repetidos', async () => {
    const a = await crear();

    const respuesta = await llamar('comparar_estampas', { ids: [a.id, a.id] });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain('repetidos');
  });

  it('un id inexistente se nombra en el error', async () => {
    const a = await crear();

    const respuesta = await llamar('comparar_estampas', {
      ids: [a.id, FALTANTE],
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toContain(FALTANTE);
  });

  it.each([[0], [1], [11]])(
    'rechaza %i estampas (se aceptan de 2 a 10)',
    async (cantidad) => {
      const ids = Array.from(
        { length: cantidad },
        (_, i) => `7d1c2f4e-0000-4000-8000-0000000000${(i + 10).toString(16)}`,
      );

      const respuesta = await llamar('comparar_estampas', { ids }).catch(
        () => ({ isError: true }),
      );

      expect(respuesta.isError).toBe(true);
    },
  );

  it('no emite juicios: la salida no habla de "mejor"', async () => {
    const a = await crear();
    const b = await crear(conMatch(datosValidos(), false));

    const texto = textoDe(
      await llamar('comparar_estampas', { ids: [a.id, b.id] }),
    );

    expect(texto.toLowerCase()).not.toMatch(/"mejor"|recomend|ganad/);
  });
});

describe('matches_perfectos', () => {
  type Matches = {
    devueltas: number;
    hayMas: boolean;
    estampas: Array<{
      id: string;
      juego: string;
      archivada: boolean;
      resultado: { rango: string; certeza: string; matchPerfecto: boolean };
      configuracion: { sistema: { dpi: unknown }; enJuego: unknown };
    }>;
  };
  const matches = async (args: Record<string, unknown> = {}) =>
    jsonDe<Matches>(await llamar('matches_perfectos', args));

  it('lista solo las marcadas true, con su configuración, su rango en texto y su certeza', async () => {
    const si = await crear(conMatch(datosValidos(), true));
    await crear(conMatch(datosValidos(), false));
    await crear(datosRts());

    const { estampas } = await matches();

    expect(estampas.map((e) => e.id)).toEqual([si.id]);
    expect(estampas[0]?.resultado).toMatchObject({
      rango: 'Global',
      certeza: 'recordado',
      matchPerfecto: true,
    });
    expect(estampas[0]?.configuracion.sistema.dpi).toBe(450);
  });

  it('una lista vacía no es un error', async () => {
    await crear(conMatch(datosValidos(), false));

    const resultado = await matches();

    expect(resultado.devueltas).toBe(0);
    expect(resultado.estampas).toEqual([]);
  });

  it('filtra por juego (sin distinguir mayúsculas) y por género', async () => {
    await crear(conMatch(conJuego(datosValidos(), 'Juego A'), true));
    await crear(
      conMatch(
        {
          ...datosRts(),
          resultado: { ...datosRts().resultado, matchPerfecto: true },
        },
        true,
      ),
    );

    expect(
      (await matches({ juego: 'juego a' })).estampas.map((e) => e.juego),
    ).toEqual(['Juego A']);
    expect(
      (await matches({ genero: 'RTS' })).estampas.map((e) => e.juego),
    ).toEqual(['StarCraft II']);
  });

  it('oculta las archivadas salvo con incluirArchivadas, y las marca', async () => {
    const { id } = await crear(conMatch(datosValidos(), true));
    await llamar('archivar_estampa', { id });

    expect((await matches()).estampas).toHaveLength(0);
    const incluidas = await matches({ incluirArchivadas: true });
    expect(incluidas.estampas.map((e) => [e.id, e.archivada])).toEqual([
      [id, true],
    ]);
  });

  it('usa la versión vigente: si la corrección quitó la marca, ya no aparece', async () => {
    const { id } = await crear(conMatch(datosValidos(), true));
    await corregir(id, { resultado: { matchPerfecto: false } });

    expect((await matches()).estampas).toHaveLength(0);
  });

  it('pagina y avisa si hay más', async () => {
    await crear(conMatch(datosValidos(), true));
    await crear(conMatch(datosValidos(), true));
    await crear(conMatch(datosValidos(), true));

    const primera = await matches({ limite: 2 });
    const segunda = await matches({ limite: 2, desplazamiento: 2 });

    expect([primera.devueltas, primera.hayMas]).toEqual([2, true]);
    expect([segunda.devueltas, segunda.hayMas]).toEqual([1, false]);
  });
});

describe('mejor_por_juego', () => {
  type Mejor = {
    juego: string;
    criterio: string;
    encontradas: number;
    mensaje?: string;
    estampas: Array<{
      id: string;
      juego: string;
      resultado: { rango: string; certeza: string };
    }>;
  };
  const mejor = async (args: Record<string, unknown>) =>
    jsonDe<Mejor>(await llamar('mejor_por_juego', args));

  it('devuelve las estampas marcadas del juego, con rango en texto y certeza a la vista', async () => {
    const si = await crear(
      conMatch(conJuego(datosValidos(), 'Mi Juego'), true),
    );
    await crear(conMatch(conJuego(datosValidos(), 'Mi Juego'), false));
    await crear(conMatch(conJuego(datosValidos(), 'Otro Juego'), true));

    const resultado = await mejor({ juego: 'mi juego' });

    expect(resultado.encontradas).toBe(1);
    expect(resultado.estampas.map((e) => e.id)).toEqual([si.id]);
    expect(resultado.estampas[0]?.resultado).toMatchObject({
      rango: 'Global',
      certeza: 'recordado',
    });
  });

  it('el criterio dice que no ordena rangos ni afirma causalidad', async () => {
    await crear(conMatch(datosValidos(), true));

    const { criterio } = await mejor({ juego: 'Counter-Strike' });

    expect(criterio).toContain('No se comparan ni se ordenan rangos');
    expect(criterio).toContain(
      'no se afirma que la configuración causó el resultado',
    );
  });

  it('si el juego tiene estampas pero ninguna marcada, lo dice (no es un error)', async () => {
    await crear(conMatch(conJuego(datosValidos(), 'Sin Marca'), false));

    const resultado = await mejor({ juego: 'Sin Marca' });

    expect(resultado.encontradas).toBe(0);
    expect(resultado.mensaje).toBe(
      'Ninguna estampa de "Sin Marca" está marcada como match perfecto.',
    );
  });

  it('si el juego no tiene estampas, lo dice distinto', async () => {
    const resultado = await mejor({ juego: 'No Existe' });

    expect(resultado.encontradas).toBe(0);
    expect(resultado.mensaje).toBe('No hay estampas de "No Existe".');
  });

  it('comparte la implementación con matches_perfectos: mismas estampas para el mismo juego', async () => {
    await crear(conMatch(conJuego(datosValidos(), 'Compartido'), true));
    await crear(conMatch(conJuego(datosValidos(), 'Compartido'), true));

    const deMejor = (await mejor({ juego: 'Compartido' })).estampas.map(
      (e) => e.id,
    );
    const deMatches = jsonDe<{ estampas: Array<{ id: string }> }>(
      await llamar('matches_perfectos', { juego: 'Compartido' }),
    ).estampas.map((e) => e.id);

    expect(deMejor).toEqual(deMatches);
  });

  it('las archivadas no cuentan salvo que se pidan', async () => {
    const { id } = await crear(
      conMatch(conJuego(datosValidos(), 'Archivado'), true),
    );
    await llamar('archivar_estampa', { id });

    expect((await mejor({ juego: 'Archivado' })).encontradas).toBe(0);
    expect(
      (await mejor({ juego: 'Archivado', incluirArchivadas: true }))
        .encontradas,
    ).toBe(1);
  });

  it('sin juego se rechaza en la entrada', async () => {
    const respuesta = await llamar('mejor_por_juego', {}).catch(() => ({
      isError: true,
    }));

    expect(respuesta.isError).toBe(true);
  });
});
