import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AlmacenamientoError } from '@domain/estampa/index.js';
import { datosValidos } from '../../tools/__tests__/harness.js';
import { crearClienteSupabase } from '../supabase-client.js';
import { SupabaseEstampaRepository } from '../supabase-estampa.repository.js';
import { describirContratoDeRepositorio } from './contrato.js';
import {
  VARIABLE_REST_DB_URL,
  VARIABLE_REST_JWT_SECRET,
  VARIABLE_REST_URL,
  firmarJwt,
  iniciarProxy,
} from './postgrest.js';
import type { Proxy } from './postgrest.js';

const urlRest = process.env[VARIABLE_REST_URL];
const secreto = process.env[VARIABLE_REST_JWT_SECRET];
const urlBase = process.env[VARIABLE_REST_DB_URL];
const ESTAMPAS_SEMBRADAS = 520; // más que una página de exportación (500)

// Sin estas variables el resumen de vitest muestra «skipped»: el denominador.
describe.skipIf(!urlRest || !secreto)(
  `Supabase real vía PostgREST (${VARIABLE_REST_URL})`,
  () => {
    let proxy: Proxy;
    const repositorioCon = (rol: string): SupabaseEstampaRepository =>
      new SupabaseEstampaRepository(
        crearClienteSupabase({
          url: proxy.url,
          serviceKey: firmarJwt(secreto!, rol),
        }),
      );

    beforeAll(async () => {
      proxy = await iniciarProxy(urlRest!);
    });
    afterAll(() => proxy?.cerrar());

    describirContratoDeRepositorio('Supabase (PostgREST)', () =>
      repositorioCon('service_role'),
    );

    describe('permisos', () => {
      it('con el rol anon no se puede leer ni escribir (AlmacenamientoError)', async () => {
        const anon = repositorioCon('anon');

        await expect(
          anon.listar({
            incluirArchivadas: false,
            limite: 5,
            desplazamiento: 0,
          }),
        ).rejects.toBeInstanceOf(AlmacenamientoError);
        await expect(anon.crear(datosValidos())).rejects.toBeInstanceOf(
          AlmacenamientoError,
        );
      });

      it('con una clave inventada tampoco', async () => {
        const inventada = new SupabaseEstampaRepository(
          crearClienteSupabase({ url: proxy.url, serviceKey: 'basura' }),
        );

        await expect(
          inventada.obtener('7d1c2f4e-0000-4000-8000-0000000000ff'),
        ).rejects.toBeInstanceOf(AlmacenamientoError);
      });
    });

    describe.skipIf(!urlBase)(
      `exportación paginada (${VARIABLE_REST_DB_URL})`,
      () => {
        it(`todas() trae las ${ESTAMPAS_SEMBRADAS} estampas sembradas, sin repetir ni perder`, async () => {
          const marca = `Paginacion-${Date.now()}`;
          const documento = JSON.stringify(datosValidos()).replaceAll(
            "'",
            "''",
          );
          // Documentos COMPLETOS: el repositorio valida el esquema entero al leer.
          const sembrar = `do $$ begin for i in 1..${ESTAMPAS_SEMBRADAS} loop perform public.crear_estampa(jsonb_set(jsonb_set('${documento}'::jsonb, '{juego,nombre}', to_jsonb('${marca}'::text)), '{juego,etapa}', to_jsonb(i::text)), 1); end loop; end $$`;
          execFileSync(
            'psql',
            [urlBase!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', sembrar],
            {
              stdio: ['ignore', 'pipe', 'pipe'],
            },
          );

          const todas = await repositorioCon('service_role').todas({
            incluirVersiones: false,
          });
          const sembradas = todas.filter((e) => e.datos.juego.nombre === marca);

          expect(todas.length).toBeGreaterThan(500);
          expect(sembradas).toHaveLength(ESTAMPAS_SEMBRADAS);
          expect(new Set(todas.map((e) => e.id)).size).toBe(todas.length);
        });
      },
    );
  },
);
