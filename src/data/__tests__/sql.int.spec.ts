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

const datos = (extra: Record<string, unknown> = {}, rango = 'Global') => ({
  juego: { nombre: 'Counter-Strike', genero: 'FPS', fecha: '2025-06-01' },
  sistema: { mouse: 'Marca Modelo', dpi: 450 },
  enJuego: { sensibilidad: 1.8, rawInput: 'encendido' },
  resultado: { rango, certeza: 'medido' },
  ...extra,
});

// Si no hay base de pruebas, el resumen de vitest muestra «skipped»: el denominador.
describe.skipIf(!urlAdmin)(`SQL real (${VARIABLE_BASE_DE_PRUEBAS})`, () => {
  let base: BaseTemporal;
  const sql = (consulta: string) => ejecutarSql(base.url, consulta).salida;
  const falla = (consulta: string) => sqlQueFalla(base.url, consulta);
  const crear = (d: unknown = datos()) =>
    JSON.parse(sql(`select public.crear_estampa(${literalJson(d)}, 1)`)) as {
      id: string;
      numeroVersion: number;
    };
  const corregir = (id: string, base_: number, d: unknown) =>
    sql(
      `select public.corregir_estampa('${id}', ${base_}, ${literalJson(d)}, 1)`,
    );

  beforeAll(() => {
    base = crearBaseTemporal(urlAdmin!);
  });
  afterAll(() => base?.eliminar());

  describe('crear y corregir (atómicos)', () => {
    it('crear deja la versión 1 y la estampa visible como vigente', () => {
      const { id, numeroVersion } = crear();

      expect(numeroVersion).toBe(1);
      expect(
        sql(
          `select numero_version, total_versiones, juego from estampas_vigentes where id='${id}'`,
        ),
      ).toBe('1|1|Counter-Strike');
    });

    it('corregir crea la versión 2 y la versión 1 queda intacta', () => {
      const { id } = crear(datos({}, 'Águila'));

      corregir(id, 1, datos({}, 'Global'));

      expect(
        sql(
          `select numero_version, rango from estampa_versiones where estampa_id='${id}' order by 1`,
        ),
      ).toBe('1|Águila\n2|Global');
      expect(
        sql(
          `select numero_version, total_versiones, datos #>> '{resultado,rango}' from estampas_vigentes where id='${id}'`,
        ),
      ).toBe('2|2|Global');
      expect(
        sql(`select count(*) from estampas_historial where id='${id}'`),
      ).toBe('2');
    });

    it('corregir con una versión base vieja falla con LL002 y no escribe', () => {
      const { id } = crear();
      corregir(id, 1, datos({}, 'A'));

      expect(
        falla(
          `select public.corregir_estampa('${id}', 1, ${literalJson(datos({}, 'B'))}, 1)`,
        ),
      ).toContain('LL002');
      expect(
        sql(`select count(*) from estampa_versiones where estampa_id='${id}'`),
      ).toBe('2');
    });

    it('corregir una estampa inexistente falla con LL001', () => {
      expect(
        falla(
          `select public.corregir_estampa('7d1c2f4e-0000-4000-8000-0000000000ff', 1, ${literalJson(datos())}, 1)`,
        ),
      ).toContain('LL001');
    });

    it('crear con datos inválidos no deja una estampa huérfana (atomicidad)', () => {
      const antes = sql('select count(*) from estampas');

      falla(
        `select public.crear_estampa(${literalJson({ juego: { nombre: 'X' } })}, 1)`,
      );

      expect(sql('select count(*) from estampas')).toBe(antes);
    });
  });

  describe('inmutabilidad: nada se modifica ni se borra', () => {
    it.each([
      [
        'UPDATE de una versión',
        `update estampa_versiones set version_formato = 9`,
      ],
      [
        'UPDATE del documento de una versión',
        `update estampa_versiones set datos = '{}'::jsonb`,
      ],
      ['DELETE de una versión', `delete from estampa_versiones`],
      ['DELETE de una estampa', `delete from estampas`],
      // Con cascade: sin él lo frena antes la clave foránea de estampas_activas.
      ['TRUNCATE de versiones', `truncate estampa_versiones cascade`],
      ['TRUNCATE de estampas', `truncate estampas cascade`],
    ])('%s es rechazado con LL010', (_nombre, consulta) => {
      crear();

      expect(falla(consulta)).toContain('LL010');
    });

    it('de una estampa solo puede cambiar archivada_en', () => {
      const { id } = crear();

      expect(
        falla(
          `update estampas set creada_en = now() - interval '1 day' where id='${id}'`,
        ),
      ).toContain('LL010');
      expect(() =>
        sql(`update estampas set archivada_en = now() where id='${id}'`),
      ).not.toThrow();
    });

    it('tras todos los intentos, los datos siguen ahí', () => {
      const { id } = crear();
      falla(`delete from estampa_versiones where estampa_id='${id}'`);

      expect(
        sql(`select count(*) from estampa_versiones where estampa_id='${id}'`),
      ).toBe('1');
    });
  });

  describe('derivadaDe', () => {
    it('acepta una referencia a una estampa existente', () => {
      const origen = crear();

      const derivada = crear(datos({ derivadaDe: origen.id }));

      expect(derivada.numeroVersion).toBe(1);
    });

    it('rechaza una referencia a una estampa que no existe (LL003)', () => {
      expect(
        falla(
          `select public.crear_estampa(${literalJson(datos({ derivadaDe: '7d1c2f4e-0000-4000-8000-0000000000ff' }))}, 1)`,
        ),
      ).toContain('LL003');
    });

    it('rechaza un derivadaDe que no es un uuid (LL003)', () => {
      expect(
        falla(
          `select public.crear_estampa(${literalJson(datos({ derivadaDe: 'no-es-uuid' }))}, 1)`,
        ),
      ).toContain('LL003');
    });

    it('rechaza la autorreferencia al corregir (LL003)', () => {
      const { id } = crear();

      expect(
        falla(
          `select public.corregir_estampa('${id}', 1, ${literalJson(datos({ derivadaDe: id }))}, 1)`,
        ),
      ).toContain('LL003');
    });

    it('no valida ciclos largos: A→B y luego B→A se permite en v1', () => {
      const a = crear();
      const b = crear(datos({ derivadaDe: a.id }));

      expect(() =>
        corregir(a.id, 1, datos({ derivadaDe: b.id })),
      ).not.toThrow();
    });
  });

  describe('guardas de la tabla', () => {
    it.each([
      [
        'género fuera de FPS/RTS',
        datos({ juego: { nombre: 'X', genero: 'MOBA', fecha: '2025-01-01' } }),
        'estampa_versiones_genero_valido',
      ],
      [
        'género desconocido',
        datos({
          juego: { nombre: 'X', genero: 'desconocido', fecha: '2025-01-01' },
        }),
        'estampa_versiones_genero_valido',
      ],
      [
        'certeza desconocida',
        datos({ resultado: { rango: 'G', certeza: 'desconocido' } }),
        'estampa_versiones_certeza_valida',
      ],
    ])('rechaza %s', (_nombre, d, restriccion) => {
      expect(
        falla(`select public.crear_estampa(${literalJson(d)}, 1)`),
      ).toContain(restriccion);
    });

    it.each([
      [
        'sin juego.nombre',
        datos({ juego: { genero: 'FPS', fecha: '2025-01-01' } }),
      ],
      ['sin resultado.rango', datos({ resultado: { certeza: 'medido' } })],
    ])('rechaza %s (not null)', (_nombre, d) => {
      expect(
        falla(`select public.crear_estampa(${literalJson(d)}, 1)`),
      ).toContain('null value');
    });

    it('rechaza un documento que no es un objeto (por not null o por check)', () => {
      expect(falla(`select public.crear_estampa('[1,2]'::jsonb, 1)`)).toMatch(
        /23502|23514/,
      );
    });
  });

  describe('columnas generadas', () => {
    it('fecha: una fecha válida se conserva y "desconocido" queda en null', () => {
      const conFecha = crear(datos());
      const desconocida = crear(
        datos({ juego: { nombre: 'Y', genero: 'RTS', fecha: 'desconocido' } }),
      );

      expect(
        sql(`select fecha from estampas_vigentes where id='${conFecha.id}'`),
      ).toBe('2025-06-01');
      expect(
        sql(
          `select fecha is null from estampas_vigentes where id='${desconocida.id}'`,
        ),
      ).toBe('t');
    });

    it('match_perfecto es true solo si el documento lo marca true', () => {
      const si = crear(
        datos({
          resultado: { rango: 'G', certeza: 'medido', matchPerfecto: true },
        }),
      );
      const no = crear(
        datos({
          resultado: { rango: 'G', certeza: 'medido', matchPerfecto: false },
        }),
      );
      const ausente = crear();

      const lectura = (id: string) =>
        sql(`select match_perfecto from estampas_vigentes where id='${id}'`);
      expect([lectura(si.id), lectura(no.id), lectura(ausente.id)]).toEqual([
        't',
        'f',
        'f',
      ]);
    });

    it('las columnas generadas no se pueden escribir a mano', () => {
      const { id } = crear();

      expect(
        falla(
          `insert into estampa_versiones (estampa_id, numero_version, version_formato, datos, juego) select '${id}', 9, 1, datos, 'x' from estampa_versiones limit 1`,
        ),
      ).toMatch(/generated column|columna generada/i);
    });
  });

  describe('seguridad (solo si la base tiene los roles de Supabase)', () => {
    const hayRolesDeSupabase = (): boolean =>
      sql(
        `select count(*) = 2 from pg_roles where rolname in ('anon','service_role')`,
      ) === 't';
    const DENEGADO = /permission denied|permiso denegado/i;

    it('anon no accede a nada: ni tablas, ni vistas, ni funciones', (contexto) => {
      if (!hayRolesDeSupabase()) contexto.skip();
      crear();

      for (const consulta of [
        'select count(*) from estampas_vigentes',
        'select count(*) from estampas_historial',
        'select count(*) from estampa_versiones',
        'select count(*) from estampas',
        'insert into estampas default values',
        `select public.crear_estampa(${literalJson(datos())}, 1)`,
      ]) {
        expect(falla(`set role anon; ${consulta}`), consulta).toMatch(DENEGADO);
      }
    });

    it('service_role lee y escribe por las vías previstas, pero no puede borrar', (contexto) => {
      if (!hayRolesDeSupabase()) contexto.skip();
      const { id } = crear();

      expect(
        sql(
          `set role service_role; select count(*) from estampas_vigentes where id='${id}'`,
        ),
      ).toContain('1');
      expect(
        sql(
          `set role service_role; select public.crear_estampa(${literalJson(datos())}, 1)`,
        ),
      ).toContain('numeroVersion');
      expect(
        falla(`set role service_role; delete from estampa_versiones`),
      ).toMatch(DENEGADO);
      expect(
        falla(`set role service_role; truncate estampa_versiones`),
      ).toMatch(DENEGADO);
    });
  });

  describe('archivar_estampa', () => {
    it('marca archivada_en sin crear versiones ni tocar los datos', () => {
      const { id } = crear();

      sql(`select public.archivar_estampa('${id}')`);

      expect(
        sql(
          `select archivada, total_versiones from estampas_vigentes where id='${id}'`,
        ),
      ).toBe('t|1');
      expect(
        sql(`select count(*) from estampa_versiones where estampa_id='${id}'`),
      ).toBe('1');
    });

    it('es idempotente: archivar de nuevo conserva la fecha original', () => {
      const { id } = crear();
      sql(`select public.archivar_estampa('${id}')`);
      const primera = sql(`select archivada_en from estampas where id='${id}'`);

      sql(`select public.archivar_estampa('${id}')`);

      expect(sql(`select archivada_en from estampas where id='${id}'`)).toBe(
        primera,
      );
    });

    it('una estampa inexistente falla con LL001', () => {
      expect(
        falla(
          `select public.archivar_estampa('7d1c2f4e-0000-4000-8000-0000000000ff')`,
        ),
      ).toContain('LL001');
    });
  });

  describe('importar_estampas', () => {
    const ID_A = '7d1c2f4e-0000-4000-8000-0000000000a1';
    const ID_B = '7d1c2f4e-0000-4000-8000-0000000000b2';
    const plan = (estampas: unknown[]) => ({ estampas });
    const estampa = (id: string, versiones: unknown[], archivada = false) => ({
      id,
      archivada,
      versiones,
    });
    const version = (numero: number, d: unknown = datos()) => ({
      numero,
      datos: d,
    });
    const importar = (p: unknown, dryRun: boolean) =>
      JSON.parse(
        sql(`select public.importar_estampas(${literalJson(p)}, ${dryRun}, 1)`),
      ) as {
        estampasNuevas: number;
        versionesNuevas: number;
        omitidas: string[];
        aplicada: boolean;
      };
    const cuenta = (id: string) =>
      sql(`select count(*) from estampa_versiones where estampa_id='${id}'`);

    it('importa con los ids dados, las versiones en orden y la marca archivada', () => {
      const id = '7d1c2f4e-0000-4000-8000-0000000000c3';

      const resultado = importar(
        plan([
          estampa(
            id,
            [version(1, datos({}, 'A')), version(2, datos({}, 'B'))],
            true,
          ),
        ]),
        false,
      );

      expect(resultado).toEqual({
        estampasNuevas: 1,
        versionesNuevas: 2,
        omitidas: [],
        aplicada: true,
      });
      expect(
        sql(
          `select numero_version, datos #>> '{resultado,rango}' from estampa_versiones where estampa_id='${id}' order by 1`,
        ),
      ).toBe('1|A\n2|B');
      expect(
        sql(
          `select archivada, total_versiones from estampas_vigentes where id='${id}'`,
        ),
      ).toBe('t|2');
    });

    it('la simulación ejecuta todo y lo deshace: reporta igual y no deja nada', () => {
      const id = '7d1c2f4e-0000-4000-8000-0000000000d4';

      const resultado = importar(
        plan([estampa(id, [version(1), version(2)])]),
        true,
      );

      expect(resultado).toEqual({
        estampasNuevas: 1,
        versionesNuevas: 2,
        omitidas: [],
        aplicada: false,
      });
      expect(sql(`select count(*) from estampas where id='${id}'`)).toBe('0');
      expect(cuenta(id)).toBe('0');
    });

    it('la simulación también rechaza lo que rechazaría la real', () => {
      const id = '7d1c2f4e-0000-4000-8000-0000000000e5';
      const conSalto = plan([estampa(id, [version(1), version(3)])]);

      expect(
        falla(
          `select public.importar_estampas(${literalJson(conSalto)}, true, 1)`,
        ),
      ).toContain('LL004');
    });

    it('un id que ya existe se omite y no se sobrescribe', () => {
      const existente = crear(datos({}, 'Original'));

      const resultado = importar(
        plan([estampa(existente.id, [version(1, datos({}, 'Otro'))])]),
        false,
      );

      expect(resultado).toMatchObject({
        estampasNuevas: 0,
        versionesNuevas: 0,
        omitidas: [existente.id],
      });
      expect(
        sql(
          `select datos #>> '{resultado,rango}' from estampa_versiones where estampa_id='${existente.id}'`,
        ),
      ).toBe('Original');
    });

    it('rechaza versiones con un salto o que no empiezan en 1 (LL004) y no deja nada', () => {
      for (const versiones of [[version(1), version(3)], [version(2)], []]) {
        const id = crypto.randomUUID();

        expect(
          falla(
            `select public.importar_estampas(${literalJson(plan([estampa(id, versiones)]))}, false, 1)`,
          ),
        ).toContain('LL004');
        expect(sql(`select count(*) from estampas where id='${id}'`)).toBe('0');
      }
    });

    it('rechaza un plan sin el arreglo estampas (LL004)', () => {
      expect(
        falla(`select public.importar_estampas('{}'::jsonb, false, 1)`),
      ).toContain('LL004');
    });

    it('es atómico: si la segunda estampa falla, la primera tampoco entra', () => {
      const buena = '7d1c2f4e-0000-4000-8000-0000000000f6';
      const mala = '7d1c2f4e-0000-4000-8000-0000000000f7';
      const p = plan([
        estampa(buena, [version(1)]),
        estampa(mala, [
          version(
            1,
            datos({ derivadaDe: '7d1c2f4e-0000-4000-8000-0000000000ff' }),
          ),
        ]),
      ]);

      expect(
        falla(`select public.importar_estampas(${literalJson(p)}, false, 1)`),
      ).toContain('LL003');
      expect(
        sql(`select count(*) from estampas where id in ('${buena}','${mala}')`),
      ).toBe('0');
    });

    it('derivadaDe puede apuntar a otra estampa del lote, aunque venga después', () => {
      const p = plan([
        estampa(ID_B, [version(1, datos({ derivadaDe: ID_A }))]),
        estampa(ID_A, [version(1)]),
      ]);

      expect(importar(p, false).estampasNuevas).toBe(2);
      expect(
        sql(
          `select datos ->> 'derivadaDe' from estampa_versiones where estampa_id='${ID_B}'`,
        ),
      ).toBe(ID_A);
    });

    it('rechaza la autorreferencia (LL003)', () => {
      const id = crypto.randomUUID();
      const p = plan([estampa(id, [version(1, datos({ derivadaDe: id }))])]);

      expect(
        falla(`select public.importar_estampas(${literalJson(p)}, false, 1)`),
      ).toContain('LL003');
    });

    it('importar lo mismo dos veces es idempotente', () => {
      const id = crypto.randomUUID();
      const p = plan([estampa(id, [version(1), version(2)])]);

      importar(p, false);
      const segunda = importar(p, false);

      expect(segunda).toMatchObject({ estampasNuevas: 0, omitidas: [id] });
      expect(cuenta(id)).toBe('2');
    });
  });

  describe('permisos de las funciones de F3 (solo con roles de Supabase)', () => {
    const hayRoles = (): boolean =>
      sql(
        `select count(*) = 2 from pg_roles where rolname in ('anon','service_role')`,
      ) === 't';
    const DENEGADO = /permission denied|permiso denegado/i;

    it('anon no puede archivar ni importar; service_role sí', (contexto) => {
      if (!hayRoles()) contexto.skip();
      const { id } = crear();
      const vacio = literalJson({ estampas: [] });

      expect(
        falla(`set role anon; select public.archivar_estampa('${id}')`),
      ).toMatch(DENEGADO);
      expect(
        falla(
          `set role anon; select public.importar_estampas(${vacio}, true, 1)`,
        ),
      ).toMatch(DENEGADO);
      expect(
        sql(`set role service_role; select public.archivar_estampa('${id}')`),
      ).toContain('archivada');
      expect(
        sql(
          `set role service_role; select public.importar_estampas(${vacio}, true, 1)`,
        ),
      ).toContain('estampasNuevas');
    });
  });

  describe('la vista de historial', () => {
    it('total_versiones cuenta por estampa y vigentes trae solo la última', () => {
      const { id } = crear();
      corregir(id, 1, datos({}, 'A'));
      corregir(id, 2, datos({}, 'B'));

      expect(
        sql(`select count(*) from estampas_historial where id='${id}'`),
      ).toBe('3');
      expect(
        sql(`select count(*) from estampas_vigentes where id='${id}'`),
      ).toBe('1');
      expect(
        sql(
          `select numero_version, total_versiones from estampas_vigentes where id='${id}'`,
        ),
      ).toBe('3|3');
    });
  });
});
