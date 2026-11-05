import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InMemoryEstampaRepository } from '@data/index.js';
import {
  planificarImportacion,
  validarEnvoltorio,
} from '@domain/estampa/index.js';
import { ejecutarRespaldo, verificarRespaldo } from '../../respaldo/index.js';
import { datosRts, datosValidos } from '../../tools/__tests__/harness.js';
import {
  crearBaseTemporal,
  ejecutarSql,
  literalJson,
  urlDeAdministracion,
} from './psql.js';
import type { BaseTemporal } from './psql.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const urlAdmin = urlDeAdministracion();

interface Fila {
  id: string;
  numero_version: number;
  archivada: boolean;
  datos: unknown;
}

// Sin base de pruebas el resumen de vitest muestra «skipped»: el denominador.
describe.skipIf(!urlAdmin)(
  'restaurar un respaldo real en una base VACÍA (SQL real)',
  () => {
    let base: BaseTemporal;
    let directorio: string;
    beforeAll(async () => {
      base = crearBaseTemporal(urlAdmin!);
      directorio = await mkdtemp(join(tmpdir(), 'ladder-lab-restauracion-'));
    });
    afterAll(async () => {
      base?.eliminar();
      await rm(directorio, { recursive: true, force: true });
    });

    const leerBase = (): Fila[] =>
      JSON.parse(
        ejecutarSql(
          base.url,
          `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'numero_version', numero_version, 'archivada', archivada, 'datos', datos) order by id, numero_version), '[]') from estampas_historial`,
        ).salida,
      ) as Fila[];

    it('respaldo → verificar → importar con la función SQL real → idéntico, dato por dato', async () => {
      const origen = new InMemoryEstampaRepository();
      const a = await origen.crear(datosValidos());
      await origen.corregir(a.id, 1, {
        ...datosValidos(),
        notas: 'segunda versión',
      });
      const b = await origen.crear({ ...datosRts(), derivadaDe: a.id });
      await origen.archivar(b.id);
      const { archivo, versiones } = await ejecutarRespaldo(origen, {
        directorio,
        ahora: new Date('2026-11-05T10:00:00Z'),
        retencion: 5,
      });

      const { envoltorio } = await verificarRespaldo(archivo);
      const plan = planificarImportacion(validarEnvoltorio(envoltorio));
      const resultado = JSON.parse(
        ejecutarSql(
          base.url,
          `select public.importar_estampas(${literalJson(plan)}, false, 1)`,
        ).salida,
      ) as {
        estampasNuevas: number;
        versionesNuevas: number;
        aplicada: boolean;
      };

      expect(resultado).toMatchObject({
        estampasNuevas: 2,
        versionesNuevas: versiones,
        aplicada: true,
      });
      const esperado = (await origen.todas({ incluirVersiones: true })).map(
        (e) => ({
          id: e.id,
          numero_version: e.numeroVersion,
          archivada: e.archivada,
          datos: e.datos,
        }),
      );
      const obtenido = leerBase();
      const porClave = (f: { id: string; numero_version: number }) =>
        `${f.id}#${f.numero_version}`;
      expect(obtenido.map(porClave).sort()).toEqual(
        esperado.map(porClave).sort(),
      );
      for (const fila of esperado) {
        expect(obtenido.find((o) => porClave(o) === porClave(fila))).toEqual(
          fila,
        );
      }
    });

    it('la base restaurada no pierde la inmutabilidad: no se puede borrar lo restaurado', () => {
      expect(() =>
        ejecutarSql(base.url, 'delete from estampa_versiones'),
      ).toThrow(/LL010/);
    });
  },
);
