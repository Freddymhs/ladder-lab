import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  crearBaseTemporal,
  ejecutarSql,
  literalJson,
  sqlQueFalla,
  urlDeAdministracion,
  VARIABLE_BASE_DE_PRUEBAS,
} from './psql.js';
import type { BaseTemporal } from './psql.js';

const urlAdmin = urlDeAdministracion();

const datos = (juego = 'StarCraft II', notas?: string) => ({
  juego: { nombre: juego, genero: 'RTS', etapa: 'Temporada 3' },
  sistema: { mouse: 'Marca Modelo', dpi: 800 },
  enJuego: { sensibilidad: 'no_aplica', rawInput: 'no_aplica' },
  resultado: { rango: 'Diamante', certeza: 'medido' },
  ...(notas !== undefined && { notas }),
});

interface Marcado {
  juego: string;
  id: string;
  numeroVersion: number;
  anterior: { id: string; numeroVersion: number } | null;
}

// Si no hay base de pruebas, el resumen de vitest muestra «skipped»: el denominador.
describe.skipIf(!urlAdmin)(
  `SQL real: estampa activa (${VARIABLE_BASE_DE_PRUEBAS})`,
  () => {
    const contexto: { base?: BaseTemporal } = {};
    const url = (): string => contexto.base!.url;
    const sql = (consulta: string) => ejecutarSql(url(), consulta).salida;
    const falla = (consulta: string) => sqlQueFalla(url(), consulta);
    const crear = (d: unknown = datos()): string =>
      (
        JSON.parse(
          sql(`select public.crear_estampa(${literalJson(d)}, 1)`),
        ) as {
          id: string;
        }
      ).id;
    const marcar = (id: string, version: number | null = null): Marcado =>
      JSON.parse(
        sql(`select public.marcar_estampa_activa('${id}', ${version})`),
      ) as Marcado;
    const juegoUnico = (): string => `RTS-${randomUUID().slice(0, 8)}`;

    beforeAll(() => {
      contexto.base = crearBaseTemporal(urlAdmin!);
    });
    afterAll(() => contexto.base?.eliminar());

    it('sin versión fija la última y la vista devuelve esa versión', () => {
      const juego = juegoUnico();
      const id = crear(datos(juego));
      sql(
        `select public.corregir_estampa('${id}', 1, ${literalJson(datos(juego, 'dos'))}, 1)`,
      );

      const marcado = marcar(id);

      expect(marcado).toMatchObject({ juego, id, numeroVersion: 2 });
      expect(marcado.anterior).toBeNull();
      expect(
        sql(
          `select numero_version, total_versiones from estampas_activas_detalle where juego = '${juego}'`,
        ),
      ).toBe('2|2');
    });

    it('otra del mismo juego, con otras mayúsculas, reemplaza la fila y devuelve la anterior', () => {
      const juego = juegoUnico();
      const primera = crear(datos(juego));
      const segunda = crear(datos(juego.toUpperCase()));
      marcar(primera);

      const marcado = marcar(segunda);

      expect(marcado.anterior).toEqual({ id: primera, numeroVersion: 1 });
      expect(
        sql(
          `select count(*), max(estampa_id::text) from estampas_activas where lower(juego) = lower('${juego}')`,
        ),
      ).toBe(`1|${segunda}`);
    });

    it('renombrar el juego y marcar la versión nueva borra la fila del nombre viejo: una estampa, un solo juego', () => {
      const viejo = juegoUnico();
      const nuevoNombre = juegoUnico();
      const id = crear(datos(viejo));
      marcar(id);
      sql(
        `select public.corregir_estampa('${id}', 1, ${literalJson(datos(nuevoNombre))}, 1)`,
      );

      const marcado = marcar(id);

      expect(marcado).toMatchObject({ juego: nuevoNombre, numeroVersion: 2 });
      expect(marcado.anterior).toBeNull();
      expect(
        sql(`select juego from estampas_activas where estampa_id = '${id}'`),
      ).toBe(nuevoNombre);
    });

    it('rechaza una archivada (LL005), una versión inexistente (LL006) y una estampa inexistente (LL001)', () => {
      const archivada = crear(datos(juegoUnico()));
      sql(`select public.archivar_estampa('${archivada}')`);
      const viva = crear(datos(juegoUnico()));

      expect(
        falla(`select public.marcar_estampa_activa('${archivada}')`),
      ).toContain('LL005');
      expect(
        falla(`select public.marcar_estampa_activa('${viva}', 9)`),
      ).toContain('LL006');
      expect(
        falla(
          `select public.marcar_estampa_activa('7d1c2f4e-0000-4000-8000-0000000000ff')`,
        ),
      ).toContain('LL001');
    });

    it('archivar la activa la saca de la vista sin borrar la fila', () => {
      const juego = juegoUnico();
      const id = crear(datos(juego));
      marcar(id);

      sql(`select public.archivar_estampa('${id}')`);

      expect(
        sql(
          `select count(*) from estampas_activas_detalle where juego = '${juego}'`,
        ),
      ).toBe('0');
      expect(
        sql(`select count(*) from estampas_activas where juego = '${juego}'`),
      ).toBe('1');
    });

    it('el trigger protege las escrituras directas: juego distinto (LL007) o archivada (LL005)', () => {
      const juego = juegoUnico();
      const id = crear(datos(juego));
      const archivada = crear(datos(juegoUnico()));
      sql(`select public.archivar_estampa('${archivada}')`);

      expect(
        falla(
          `insert into estampas_activas (juego, estampa_id, numero_version) values ('Otro juego', '${id}', 1)`,
        ),
      ).toContain('LL007');
      expect(
        falla(
          `insert into estampas_activas (juego, estampa_id, numero_version) select juego, estampa_id, 1 from estampa_versiones where estampa_id = '${archivada}'`,
        ),
      ).toContain('LL005');
    });

    it('juegos_registrados trae cada nombre una vez y sin los solo archivados', () => {
      const juego = juegoUnico();
      crear(datos(juego));
      crear(datos(juego));
      const archivado = juegoUnico();
      sql(`select public.archivar_estampa('${crear(datos(archivado))}')`);

      expect(
        sql(
          `select count(*) from juegos_registrados where juego in ('${juego}', '${archivado}')`,
        ),
      ).toBe('1');
    });

    describe('permisos (solo con roles de Supabase)', () => {
      const hayRoles = (): boolean =>
        sql(
          `select count(*) = 2 from pg_roles where rolname in ('anon','service_role')`,
        ) === 't';
      const DENEGADO = /permission denied|permiso denegado/i;
      /** Resultado de la última sentencia (psql imprime antes el «SET» del rol). */
      const comoServicio = (consulta: string): string =>
        sql(`set role service_role; ${consulta}`).split('\n').at(-1) ?? '';

      it('anon no accede a nada; service_role marca y lee pero no borra', (ctx) => {
        if (!hayRoles()) ctx.skip();
        const id = crear(datos(juegoUnico()));

        for (const consulta of [
          'select count(*) from estampas_activas',
          'select count(*) from estampas_activas_detalle',
          'select count(*) from juegos_registrados',
          `select public.marcar_estampa_activa('${id}')`,
        ]) {
          expect(falla(`set role anon; ${consulta}`), consulta).toMatch(
            DENEGADO,
          );
        }
        expect(
          sql(
            `set role service_role; select public.marcar_estampa_activa('${id}')`,
          ),
        ).toContain('numeroVersion');
        expect(
          comoServicio(
            `select count(*) from estampas_activas_detalle where id = '${id}'`,
          ),
        ).toBe('1');
        expect(
          comoServicio(`select count(*) >= 1 from juegos_registrados`),
        ).toBe('t');
        expect(
          falla(`set role service_role; delete from estampas_activas`),
        ).toMatch(DENEGADO);
        expect(
          falla(`set role service_role; truncate estampas_activas`),
        ).toMatch(DENEGADO);
      });

      it('service_role renombra y marca: la RPC borra la fila vieja aunque él no pueda borrar', (ctx) => {
        if (!hayRoles()) ctx.skip();
        const viejo = juegoUnico();
        const nuevoNombre = juegoUnico();
        const id = crear(datos(viejo));
        marcar(id);
        sql(
          `select public.corregir_estampa('${id}', 1, ${literalJson(datos(nuevoNombre))}, 1)`,
        );

        sql(
          `set role service_role; select public.marcar_estampa_activa('${id}')`,
        );

        expect(
          sql(`select juego from estampas_activas where estampa_id = '${id}'`),
        ).toBe(nuevoNombre);
      });
    });
  },
);
