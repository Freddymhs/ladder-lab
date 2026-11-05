import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ConflictoDeVersionError,
  DerivadaInvalidaError,
  EstampaNoEncontradaError,
} from '@domain/estampa/index.js';
import type { DatosEstampa } from '@domain/estampa/index.js';
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
  });
}
