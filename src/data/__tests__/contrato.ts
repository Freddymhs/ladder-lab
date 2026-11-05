import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ConflictoDeVersionError,
  DerivadaInvalidaError,
  EstampaNoEncontradaError,
  ImportacionInvalidaError,
} from '@domain/estampa/index.js';
import type { DatosEstampa, EstampaImportable } from '@domain/estampa/index.js';
import { datosRts, datosValidos } from '../../tools/__tests__/harness.js';
import type { EstampaRepository } from '../estampa.repository.js';

const LISTADO = {
  incluirArchivadas: false,
  limite: 50,
  desplazamiento: 0,
} as const;

/** Un nombre de juego único por prueba: la base real acumula datos entre pruebas. */
const juegoUnico = (): string => `Juego-${randomUUID().slice(0, 8)}`;

const conJuego = (
  datos: DatosEstampa,
  nombre: string,
  fecha?: string,
): DatosEstampa => ({
  ...datos,
  juego: { ...datos.juego, nombre, ...(fecha !== undefined && { fecha }) },
});

/**
 * Contrato que TODO repositorio debe cumplir. Se ejecuta contra el doble en
 * memoria y contra Supabase real: si divergen, una de las dos pruebas falla.
 */
export function describirContratoDeRepositorio(
  nombre: string,
  crearRepositorio: () => Promise<EstampaRepository> | EstampaRepository,
): void {
  describe(`contrato de repositorio — ${nombre}`, () => {
    const nuevo = async (): Promise<EstampaRepository> => crearRepositorio();

    it('crear devuelve la versión 1 y obtener la lee igual', async () => {
      const repo = await nuevo();
      const datos = conJuego(datosValidos(), juegoUnico());

      const creada = await repo.crear(datos);
      const leida = await repo.obtener(creada.id);

      expect(creada.numeroVersion).toBe(1);
      expect(creada.totalVersiones).toBe(1);
      expect(creada.archivada).toBe(false);
      expect(leida).toEqual(creada);
      expect(leida?.datos).toEqual(datos);
    });

    it('conserva desconocido y no_aplica, y no inventa opcionales ausentes', async () => {
      const repo = await nuevo();
      const datos = conJuego(datosRts(), juegoUnico());

      const leida = await repo.obtener((await repo.crear(datos)).id);

      expect(leida?.datos).toEqual(datos);
      expect(leida?.datos.sistema.dpi).toBe('desconocido');
      expect(leida?.datos.enJuego.sensibilidad).toBe('no_aplica');
      expect(leida?.datos.derivadaDe).toBeUndefined();
    });

    it('obtener devuelve null para un id inexistente o que no es uuid', async () => {
      const repo = await nuevo();

      expect(await repo.obtener(randomUUID())).toBeNull();
      expect(await repo.obtener('no-es-un-uuid')).toBeNull();
    });

    it('corregir crea la versión 2 y la versión 1 queda intacta', async () => {
      const repo = await nuevo();
      const v1 = conJuego(datosValidos(), juegoUnico());
      const creada = await repo.crear(v1);
      const v2 = { ...v1, resultado: { ...v1.resultado, rango: 'Águila' } };

      const corregida = await repo.corregir(creada.id, 1, v2);
      const historial = (await repo.todas({ incluirVersiones: true })).filter(
        (e) => e.id === creada.id,
      );

      expect(corregida.numeroVersion).toBe(2);
      expect(corregida.totalVersiones).toBe(2);
      expect((await repo.obtener(creada.id))?.datos).toEqual(v2);
      expect(historial.map((e) => e.numeroVersion)).toEqual([1, 2]);
      expect(historial[0]?.datos).toEqual(v1);
      expect(historial[1]?.datos).toEqual(v2);
    });

    it('corregir con una versión base vieja falla y no crea nada', async () => {
      const repo = await nuevo();
      const datos = conJuego(datosValidos(), juegoUnico());
      const { id } = await repo.crear(datos);
      await repo.corregir(id, 1, { ...datos, notas: 'primera' });

      await expect(
        repo.corregir(id, 1, { ...datos, notas: 'tarde' }),
      ).rejects.toBeInstanceOf(ConflictoDeVersionError);
      expect((await repo.obtener(id))?.numeroVersion).toBe(2);
      expect((await repo.obtener(id))?.datos.notas).toBe('primera');
    });

    it('corregir una estampa inexistente falla con EstampaNoEncontrada', async () => {
      const repo = await nuevo();

      await expect(
        repo.corregir(randomUUID(), 1, datosValidos()),
      ).rejects.toBeInstanceOf(EstampaNoEncontradaError);
    });

    describe('derivadaDe', () => {
      it('acepta una estampa existente, también de otro juego', async () => {
        const repo = await nuevo();
        const origen = await repo.crear(conJuego(datosValidos(), juegoUnico()));

        const derivada = await repo.crear({
          ...conJuego(datosRts(), juegoUnico()),
          derivadaDe: origen.id,
        });

        expect(derivada.datos.derivadaDe).toBe(origen.id);
      });

      it('rechaza una estampa que no existe', async () => {
        const repo = await nuevo();

        await expect(
          repo.crear({ ...datosValidos(), derivadaDe: randomUUID() }),
        ).rejects.toBeInstanceOf(DerivadaInvalidaError);
      });

      it('rechaza la autorreferencia al corregir', async () => {
        const repo = await nuevo();
        const datos = conJuego(datosValidos(), juegoUnico());
        const { id } = await repo.crear(datos);

        await expect(
          repo.corregir(id, 1, { ...datos, derivadaDe: id }),
        ).rejects.toBeInstanceOf(DerivadaInvalidaError);
        expect((await repo.obtener(id))?.numeroVersion).toBe(1);
      });
    });

    describe('listar', () => {
      it('filtra por juego sin distinguir mayúsculas y por género', async () => {
        const repo = await nuevo();
        const juego = juegoUnico();
        await repo.crear(conJuego(datosValidos(), juego));
        await repo.crear(conJuego(datosRts(), `${juego}-otro`));

        const porJuego = await repo.listar({
          ...LISTADO,
          juego: juego.toUpperCase(),
        });
        const rts = await repo.listar({
          ...LISTADO,
          juego: `${juego}-otro`,
          genero: 'RTS',
        });
        const fps = await repo.listar({
          ...LISTADO,
          juego: `${juego}-otro`,
          genero: 'FPS',
        });

        expect(porJuego.map((e) => e.datos.juego.nombre)).toEqual([juego]);
        expect(rts).toHaveLength(1);
        expect(fps).toHaveLength(0);
      });

      it('% y _ no actúan como patrón', async () => {
        const repo = await nuevo();
        const juego = juegoUnico();
        await repo.crear(conJuego(datosValidos(), juego));

        expect(await repo.listar({ ...LISTADO, juego: '%' })).toHaveLength(0);
        expect(
          await repo.listar({ ...LISTADO, juego: juego.replace('-', '_') }),
        ).toHaveLength(0);
      });

      it('ordena por fecha descendente y deja las sin fecha o con "desconocido" al final', async () => {
        const repo = await nuevo();
        const juego = juegoUnico();
        await repo.crear(conJuego(datosValidos(), juego, '2024-01-01'));
        await repo.crear(conJuego(datosValidos(), juego, '2025-09-01'));
        await repo.crear(conJuego(datosValidos(), juego, 'desconocido'));
        const { fecha: _quitada, ...sinFecha } = datosValidos().juego;
        await repo.crear({
          ...datosValidos(),
          juego: { ...sinFecha, nombre: juego, etapa: 'Temporada 1' },
        });

        const lista = await repo.listar({ ...LISTADO, juego });

        expect(lista).toHaveLength(4);
        expect(lista[0]?.datos.juego.fecha).toBe('2025-09-01');
        expect(lista[1]?.datos.juego.fecha).toBe('2024-01-01');
        // Las dos sin fecha válida van al final (su orden entre sí no se promete).
        expect(new Set(lista.slice(2).map((e) => e.datos.juego.fecha))).toEqual(
          new Set(['desconocido', undefined]),
        );
      });

      it('pagina con límite y desplazamiento sin repetir ni saltar', async () => {
        const repo = await nuevo();
        const juego = juegoUnico();
        await Promise.all(
          ['2025-01-01', '2025-02-01', '2025-03-01'].map((f) =>
            repo.crear(conJuego(datosValidos(), juego, f)),
          ),
        );

        const primera = await repo.listar({ ...LISTADO, juego, limite: 2 });
        const segunda = await repo.listar({
          ...LISTADO,
          juego,
          limite: 2,
          desplazamiento: 2,
        });

        expect(primera.map((e) => e.datos.juego.fecha)).toEqual([
          '2025-03-01',
          '2025-02-01',
        ]);
        expect(segunda.map((e) => e.datos.juego.fecha)).toEqual(['2025-01-01']);
      });

      it('muestra la versión vigente', async () => {
        const repo = await nuevo();
        const juego = juegoUnico();
        const datos = conJuego(datosValidos(), juego);
        const { id } = await repo.crear(datos);
        await repo.corregir(id, 1, { ...datos, notas: 'v2' });

        const [unica] = await repo.listar({ ...LISTADO, juego });

        expect(unica?.numeroVersion).toBe(2);
        expect(unica?.datos.notas).toBe('v2');
      });
    });

    describe('todas', () => {
      it('sin versiones: solo la vigente; con versiones: todas, de la 1 en adelante', async () => {
        const repo = await nuevo();
        const datos = conJuego(datosValidos(), juegoUnico());
        const { id } = await repo.crear(datos);
        await repo.corregir(id, 1, { ...datos, notas: 'v2' });
        await repo.corregir(id, 2, { ...datos, notas: 'v3' });

        const vigentes = (await repo.todas({ incluirVersiones: false })).filter(
          (e) => e.id === id,
        );
        const completas = (await repo.todas({ incluirVersiones: true })).filter(
          (e) => e.id === id,
        );

        expect(vigentes.map((e) => e.numeroVersion)).toEqual([3]);
        expect(completas.map((e) => e.numeroVersion)).toEqual([1, 2, 3]);
        expect(completas.every((e) => e.totalVersiones === 3)).toBe(true);
      });
    });

    describe('archivar', () => {
      it('marca la estampa como archivada sin crear versiones ni tocar sus datos', async () => {
        const repo = await nuevo();
        const datos = conJuego(datosValidos(), juegoUnico());
        const { id } = await repo.crear(datos);

        const archivada = await repo.archivar(id);

        expect(archivada.archivada).toBe(true);
        expect(archivada.numeroVersion).toBe(1);
        expect(archivada.totalVersiones).toBe(1);
        expect(archivada.datos).toEqual(datos);
        expect((await repo.obtener(id))?.archivada).toBe(true);
      });

      it('es idempotente', async () => {
        const repo = await nuevo();
        const { id } = await repo.crear(conJuego(datosValidos(), juegoUnico()));

        await repo.archivar(id);
        const otra = await repo.archivar(id);

        expect(otra.archivada).toBe(true);
        expect(otra.totalVersiones).toBe(1);
      });

      it('una estampa inexistente falla con EstampaNoEncontrada', async () => {
        const repo = await nuevo();

        await expect(repo.archivar(randomUUID())).rejects.toBeInstanceOf(
          EstampaNoEncontradaError,
        );
      });

      it('listar la oculta por defecto y la muestra con incluirArchivadas', async () => {
        const repo = await nuevo();
        const juego = juegoUnico();
        const { id } = await repo.crear(conJuego(datosValidos(), juego));
        await repo.archivar(id);

        const oculta = await repo.listar({ ...LISTADO, juego });
        const visible = await repo.listar({
          ...LISTADO,
          juego,
          incluirArchivadas: true,
        });

        expect(oculta).toHaveLength(0);
        expect(visible.map((e) => e.id)).toEqual([id]);
        expect(visible[0]?.archivada).toBe(true);
      });

      it('todas incluye las archivadas, marcadas', async () => {
        const repo = await nuevo();
        const { id } = await repo.crear(conJuego(datosValidos(), juegoUnico()));
        await repo.archivar(id);

        const exportada = (await repo.todas({ incluirVersiones: false })).find(
          (e) => e.id === id,
        );

        expect(exportada?.archivada).toBe(true);
      });

      it('una estampa archivada se puede seguir corrigiendo y conserva el archivo', async () => {
        const repo = await nuevo();
        const datos = conJuego(datosValidos(), juegoUnico());
        const { id } = await repo.crear(datos);
        await repo.archivar(id);

        const corregida = await repo.corregir(id, 1, {
          ...datos,
          notas: 'tras archivar',
        });

        expect(corregida.numeroVersion).toBe(2);
        expect(corregida.archivada).toBe(true);
      });
    });

    describe('importar', () => {
      const ahora = (): string => randomUUID();
      const estampaImportable = (
        versiones: DatosEstampa[],
        extra: { id?: string; archivada?: boolean } = {},
      ): EstampaImportable => ({
        id: extra.id ?? ahora(),
        archivada: extra.archivada ?? false,
        versiones: versiones.map((datos, i) => ({ numero: i + 1, datos })),
      });
      const APLICAR = { dryRun: false } as const;
      const SIMULAR = { dryRun: true } as const;

      it('importa estampas con sus ids, versiones y archivada, y los datos quedan idénticos', async () => {
        const repo = await nuevo();
        const v1 = conJuego(datosValidos(), juegoUnico());
        const v2 = { ...v1, notas: 'segunda' };
        const unica = conJuego(datosRts(), juegoUnico());
        const plan = {
          estampas: [
            estampaImportable([v1, v2]),
            estampaImportable([unica], { archivada: true }),
          ],
        };

        const resultado = await repo.importar(plan, APLICAR);

        expect(resultado).toEqual({
          estampasNuevas: 2,
          versionesNuevas: 3,
          omitidas: [],
          aplicada: true,
        });
        const [conVersiones, archivada] = plan.estampas;
        const historial = (await repo.todas({ incluirVersiones: true })).filter(
          (e) => e.id === conVersiones!.id,
        );
        expect(historial.map((e) => e.numeroVersion)).toEqual([1, 2]);
        expect(historial.map((e) => e.datos)).toEqual([v1, v2]);
        expect((await repo.obtener(archivada!.id))?.archivada).toBe(true);
        expect((await repo.obtener(archivada!.id))?.datos).toEqual(unica);
      });

      it('la simulación reporta lo mismo pero no escribe nada', async () => {
        const repo = await nuevo();
        const plan = {
          estampas: [
            estampaImportable([conJuego(datosValidos(), juegoUnico())]),
          ],
        };

        const simulada = await repo.importar(plan, SIMULAR);

        expect(simulada).toEqual({
          estampasNuevas: 1,
          versionesNuevas: 1,
          omitidas: [],
          aplicada: false,
        });
        expect(await repo.obtener(plan.estampas[0]!.id)).toBeNull();
        expect((await repo.importar(plan, APLICAR)).aplicada).toBe(true);
        expect(await repo.obtener(plan.estampas[0]!.id)).not.toBeNull();
      });

      it('un id que ya existe se omite y nunca se sobrescribe', async () => {
        const repo = await nuevo();
        const original = conJuego(datosValidos(), juegoUnico());
        const { id } = await repo.crear(original);
        const distinta = {
          ...original,
          notas: 'distinta',
          resultado: { ...original.resultado, rango: 'Otro' },
        };

        const resultado = await repo.importar(
          { estampas: [estampaImportable([distinta], { id })] },
          APLICAR,
        );

        expect(resultado).toEqual({
          estampasNuevas: 0,
          versionesNuevas: 0,
          omitidas: [id],
          aplicada: true,
        });
        expect((await repo.obtener(id))?.datos).toEqual(original);
        expect((await repo.obtener(id))?.totalVersiones).toBe(1);
      });

      it('importar dos veces lo mismo es idempotente', async () => {
        const repo = await nuevo();
        const plan = {
          estampas: [
            estampaImportable([conJuego(datosValidos(), juegoUnico())]),
          ],
        };

        await repo.importar(plan, APLICAR);
        const segunda = await repo.importar(plan, APLICAR);

        expect(segunda.estampasNuevas).toBe(0);
        expect(segunda.omitidas).toEqual([plan.estampas[0]!.id]);
      });

      it('es atómico: si una estampa del lote falla, no entra ninguna', async () => {
        const repo = await nuevo();
        const buena = estampaImportable([
          conJuego(datosValidos(), juegoUnico()),
        ]);
        const mala = estampaImportable([
          { ...conJuego(datosRts(), juegoUnico()), derivadaDe: randomUUID() },
        ]);

        await expect(
          repo.importar({ estampas: [buena, mala] }, APLICAR),
        ).rejects.toBeInstanceOf(DerivadaInvalidaError);
        expect(await repo.obtener(buena.id)).toBeNull();
        expect(await repo.obtener(mala.id)).toBeNull();
      });

      it('derivadaDe puede apuntar a otra estampa del mismo lote, aunque venga después', async () => {
        const repo = await nuevo();
        const origen = estampaImportable([
          conJuego(datosValidos(), juegoUnico()),
        ]);
        const derivada = estampaImportable([
          { ...conJuego(datosRts(), juegoUnico()), derivadaDe: origen.id },
        ]);

        await repo.importar({ estampas: [derivada, origen] }, APLICAR);

        expect((await repo.obtener(derivada.id))?.datos.derivadaDe).toBe(
          origen.id,
        );
      });

      it('derivadaDe puede apuntar a una estampa que ya existía', async () => {
        const repo = await nuevo();
        const { id: existente } = await repo.crear(
          conJuego(datosValidos(), juegoUnico()),
        );
        const derivada = estampaImportable([
          { ...conJuego(datosRts(), juegoUnico()), derivadaDe: existente },
        ]);

        await repo.importar({ estampas: [derivada] }, APLICAR);

        expect((await repo.obtener(derivada.id))?.datos.derivadaDe).toBe(
          existente,
        );
      });

      it('rechaza la autorreferencia', async () => {
        const repo = await nuevo();
        const id = randomUUID();
        const propia = estampaImportable(
          [{ ...conJuego(datosValidos(), juegoUnico()), derivadaDe: id }],
          { id },
        );

        await expect(
          repo.importar({ estampas: [propia] }, APLICAR),
        ).rejects.toBeInstanceOf(DerivadaInvalidaError);
        expect(await repo.obtener(id)).toBeNull();
      });

      it('rechaza versiones con un salto y no escribe nada', async () => {
        const repo = await nuevo();
        const datos = conJuego(datosValidos(), juegoUnico());
        const id = randomUUID();
        const conSalto = {
          id,
          archivada: false,
          versiones: [
            { numero: 1, datos },
            { numero: 3, datos },
          ],
        };

        await expect(
          repo.importar({ estampas: [conSalto] }, APLICAR),
        ).rejects.toBeInstanceOf(ImportacionInvalidaError);
        expect(await repo.obtener(id)).toBeNull();
      });
    });

    describe('versionesDe', () => {
      it('devuelve todas las versiones en orden, de la 1 en adelante, con sus datos', async () => {
        const repo = await nuevo();
        const v1 = conJuego(datosValidos(), juegoUnico());
        const v2 = { ...v1, notas: 'dos' };
        const v3 = { ...v1, notas: 'tres' };
        const { id } = await repo.crear(v1);
        await repo.corregir(id, 1, v2);
        await repo.corregir(id, 2, v3);

        const versiones = await repo.versionesDe(id);

        expect(versiones?.map((v) => v.numeroVersion)).toEqual([1, 2, 3]);
        expect(versiones?.map((v) => v.datos)).toEqual([v1, v2, v3]);
        expect(versiones?.every((v) => v.totalVersiones === 3)).toBe(true);
      });

      it('una estampa sin correcciones tiene una sola versión', async () => {
        const repo = await nuevo();
        const { id } = await repo.crear(conJuego(datosValidos(), juegoUnico()));

        expect(
          (await repo.versionesDe(id))?.map((v) => v.numeroVersion),
        ).toEqual([1]);
      });

      it('devuelve null si la estampa no existe o el id no es un uuid', async () => {
        const repo = await nuevo();

        expect(await repo.versionesDe(randomUUID())).toBeNull();
        expect(await repo.versionesDe('no-es-un-uuid')).toBeNull();
      });

      it('incluye las versiones de una estampa archivada', async () => {
        const repo = await nuevo();
        const datos = conJuego(datosValidos(), juegoUnico());
        const { id } = await repo.crear(datos);
        await repo.corregir(id, 1, { ...datos, notas: 'dos' });
        await repo.archivar(id);

        expect(
          (await repo.versionesDe(id))?.map((v) => v.numeroVersion),
        ).toEqual([1, 2]);
      });
    });

    describe('listar con soloMatchPerfecto', () => {
      const conMatch = (
        datos: DatosEstampa,
        valor: boolean | undefined,
      ): DatosEstampa => ({
        ...datos,
        resultado: { ...datos.resultado, matchPerfecto: valor },
      });

      it('trae solo las marcadas true: ni las false ni las sin marcar', async () => {
        const repo = await nuevo();
        const juego = juegoUnico();
        const base = conJuego(datosValidos(), juego);
        const si = await repo.crear(conMatch(base, true));
        await repo.crear(conMatch(base, false));
        const { matchPerfecto: _quitado, ...resultadoSinMarca } =
          base.resultado;
        await repo.crear({ ...base, resultado: resultadoSinMarca });

        const lista = await repo.listar({
          ...LISTADO,
          juego,
          soloMatchPerfecto: true,
        });

        expect(lista.map((e) => e.id)).toEqual([si.id]);
      });

      it('se combina con el filtro de juego y respeta las archivadas', async () => {
        const repo = await nuevo();
        const juego = juegoUnico();
        const archivada = await repo.crear(
          conMatch(conJuego(datosValidos(), juego), true),
        );
        await repo.archivar(archivada.id);
        const otroJuego = await repo.crear(
          conMatch(conJuego(datosValidos(), juegoUnico()), true),
        );

        const sinArchivadas = await repo.listar({
          ...LISTADO,
          juego,
          soloMatchPerfecto: true,
        });
        const conArchivadas = await repo.listar({
          ...LISTADO,
          juego,
          soloMatchPerfecto: true,
          incluirArchivadas: true,
        });

        expect(sinArchivadas).toHaveLength(0);
        expect(conArchivadas.map((e) => e.id)).toEqual([archivada.id]);
        expect(conArchivadas.map((e) => e.id)).not.toContain(otroJuego.id);
      });

      it('usa la versión vigente: si la corrección quitó la marca, ya no aparece', async () => {
        const repo = await nuevo();
        const juego = juegoUnico();
        const datos = conMatch(conJuego(datosValidos(), juego), true);
        const { id } = await repo.crear(datos);
        await repo.corregir(id, 1, conMatch(datos, false));

        expect(
          await repo.listar({ ...LISTADO, juego, soloMatchPerfecto: true }),
        ).toHaveLength(0);
      });
    });
  });
}
