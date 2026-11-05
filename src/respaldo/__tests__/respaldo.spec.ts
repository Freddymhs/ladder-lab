import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  truncate,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryEstampaRepository } from '@data/index.js';
import { planificarImportacion } from '@domain/estampa/index.js';
import { datosRts, datosValidos } from '../../tools/__tests__/harness.js';
import {
  ejecutarRespaldo,
  nombreDeRespaldo,
  verificarRespaldo,
} from '../respaldo.js';

const MOMENTO = new Date('2026-11-05T14:30:00.000Z');
const ARCHIVO_ESPERADO = 'ladder-lab-20261105T143000Z.json';

let directorio: string;

beforeEach(async () => {
  directorio = await mkdtemp(join(tmpdir(), 'ladder-lab-respaldo-'));
});
afterEach(async () => {
  await rm(directorio, { recursive: true, force: true });
});

/** Dos estampas, una con corrección, una archivada, una derivada de otra. */
async function repositorioConDatos(): Promise<InMemoryEstampaRepository> {
  const repo = new InMemoryEstampaRepository();
  const a = await repo.crear(datosValidos());
  await repo.corregir(a.id, 1, { ...datosValidos(), notas: 'corregida' });
  const b = await repo.crear({ ...datosRts(), derivadaDe: a.id });
  await repo.archivar(b.id);
  return repo;
}

const opciones = (extra: Partial<{ ahora: Date; retencion: number }> = {}) => ({
  directorio,
  ahora: MOMENTO,
  retencion: 30,
  ...extra,
});

describe('nombreDeRespaldo', () => {
  it('sella el nombre en UTC, ordenable y sin caracteres problemáticos', () => {
    expect(nombreDeRespaldo(MOMENTO)).toBe(ARCHIVO_ESPERADO);
  });
});

describe('ejecutarRespaldo', () => {
  it('escribe un respaldo completo con el denominador: estampas y versiones', async () => {
    const resumen = await ejecutarRespaldo(
      await repositorioConDatos(),
      opciones(),
    );

    expect(resumen.archivo).toBe(join(directorio, ARCHIVO_ESPERADO));
    expect(resumen.estampas).toBe(2);
    expect(resumen.versiones).toBe(3);
    expect(resumen.alerta).toBeUndefined();
  });

  it('el sha256 y los bytes del resumen coinciden con el archivo real', async () => {
    const resumen = await ejecutarRespaldo(
      await repositorioConDatos(),
      opciones(),
    );
    const contenido = await readFile(resumen.archivo);

    expect(resumen.bytes).toBe(contenido.length);
    expect(resumen.sha256).toBe(
      createHash('sha256').update(contenido).digest('hex'),
    );
  });

  it('incluye las versiones anteriores, las archivadas y derivadaDe resoluble', async () => {
    const resumen = await ejecutarRespaldo(
      await repositorioConDatos(),
      opciones(),
    );

    const { envoltorio, archivadas } = await verificarRespaldo(resumen.archivo);

    expect(archivadas).toBe(1);
    expect(envoltorio.estampas.map((e) => e.numeroVersion)).toEqual([1, 2, 1]);
    const ids = new Set(envoltorio.estampas.map((e) => e.id));
    const derivadas = envoltorio.estampas.filter(
      (e) => e.derivadaDe !== undefined,
    );
    expect(derivadas).toHaveLength(1);
    expect(derivadas.every((e) => ids.has(e.derivadaDe!))).toBe(true);
  });

  it('crea el directorio si no existe y no deja archivos temporales', async () => {
    const anidado = join(directorio, 'a', 'b');

    await ejecutarRespaldo(await repositorioConDatos(), {
      ...opciones(),
      directorio: anidado,
    });

    expect(await readdir(anidado)).toEqual([ARCHIVO_ESPERADO]);
  });

  it('una base vacía da un respaldo válido con 0 estampas', async () => {
    const resumen = await ejecutarRespaldo(
      new InMemoryEstampaRepository(),
      opciones(),
    );

    expect(resumen.estampas).toBe(0);
    expect((await verificarRespaldo(resumen.archivo)).versiones).toBe(0);
  });

  it('exige una retención de al menos 1, para no borrar el respaldo recién hecho', async () => {
    await expect(
      ejecutarRespaldo(await repositorioConDatos(), opciones({ retencion: 0 })),
    ).rejects.toThrow(/al menos 1/);
    expect(await readdir(directorio)).toEqual([]);
  });

  describe('retención', () => {
    it('conserva solo los N más nuevos y borra los más viejos', async () => {
      const repo = await repositorioConDatos();
      for (const d of [1, 2, 3, 4, 5]) {
        await ejecutarRespaldo(
          repo,
          opciones({
            ahora: new Date(`2026-11-0${d}T10:00:00Z`),
            retencion: 3,
          }),
        );
      }

      expect(await readdir(directorio)).toEqual([
        'ladder-lab-20261103T100000Z.json',
        'ladder-lab-20261104T100000Z.json',
        'ladder-lab-20261105T100000Z.json',
      ]);
    });

    it('nunca toca archivos que no son respaldos', async () => {
      await writeFile(join(directorio, 'otro.txt'), 'importante');
      await writeFile(join(directorio, 'ladder-lab-notas.json'), '{}');
      const repo = await repositorioConDatos();

      for (const d of [1, 2, 3]) {
        await ejecutarRespaldo(
          repo,
          opciones({
            ahora: new Date(`2026-11-0${d}T10:00:00Z`),
            retencion: 1,
          }),
        );
      }

      const quedan = await readdir(directorio);
      expect(quedan).toContain('otro.txt');
      expect(quedan).toContain('ladder-lab-notas.json');
      expect(quedan.filter((n) => /^ladder-lab-\d{8}T/.test(n))).toHaveLength(
        1,
      );
    });
  });

  describe('alerta si el respaldo trae menos datos que el anterior', () => {
    it('avisa, conserva el nuevo y NO poda los viejos', async () => {
      await ejecutarRespaldo(
        await repositorioConDatos(),
        opciones({ ahora: new Date('2026-11-01T10:00:00Z'), retencion: 1 }),
      );

      const resumen = await ejecutarRespaldo(
        new InMemoryEstampaRepository(),
        opciones({ ahora: new Date('2026-11-02T10:00:00Z'), retencion: 1 }),
      );

      expect(resumen.alerta).toMatch(/menos datos/);
      expect(resumen.eliminados).toEqual([]);
      expect(await readdir(directorio)).toHaveLength(2);
    });

    it('si el respaldo anterior está dañado, avisa y no poda', async () => {
      await ejecutarRespaldo(
        await repositorioConDatos(),
        opciones({ ahora: new Date('2026-11-01T10:00:00Z'), retencion: 1 }),
      );
      await truncate(join(directorio, 'ladder-lab-20261101T100000Z.json'), 40);

      const resumen = await ejecutarRespaldo(
        await repositorioConDatos(),
        opciones({ ahora: new Date('2026-11-02T10:00:00Z'), retencion: 1 }),
      );

      expect(resumen.alerta).toMatch(/no se puede verificar/);
      expect(await readdir(directorio)).toHaveLength(2);
    });

    it('con más datos que el anterior no hay alerta y sí se poda', async () => {
      const repo = await repositorioConDatos();
      await ejecutarRespaldo(
        repo,
        opciones({ ahora: new Date('2026-11-01T10:00:00Z'), retencion: 1 }),
      );
      await repo.crear(datosValidos());

      const resumen = await ejecutarRespaldo(
        repo,
        opciones({ ahora: new Date('2026-11-02T10:00:00Z'), retencion: 1 }),
      );

      expect(resumen.alerta).toBeUndefined();
      expect(resumen.eliminados).toEqual(['ladder-lab-20261101T100000Z.json']);
    });
  });
});

describe('verificarRespaldo — el caso rojo: un respaldo roto debe fallar', () => {
  const escribir = async (
    nombre: string,
    contenido: string,
  ): Promise<string> => {
    const ruta = join(directorio, nombre);
    await writeFile(ruta, contenido);
    return ruta;
  };

  it('un respaldo truncado da error y no sirve', async () => {
    const { archivo } = await ejecutarRespaldo(
      await repositorioConDatos(),
      opciones(),
    );
    const tamano = (await stat(archivo)).size;
    await truncate(archivo, Math.floor(tamano / 2));

    await expect(verificarRespaldo(archivo)).rejects.toThrow(
      /no es JSON válido/,
    );
  });

  it('un archivo vacío falla', async () => {
    await expect(
      verificarRespaldo(await escribir('vacio.json', '')),
    ).rejects.toThrow(/no es JSON válido/);
  });

  it('un archivo inexistente falla', async () => {
    await expect(
      verificarRespaldo(join(directorio, 'no-existe.json')),
    ).rejects.toThrow(/ENOENT/);
  });

  it('otro formato falla con un mensaje claro', async () => {
    const ruta = await escribir(
      'otro.json',
      JSON.stringify({ formato: 'x', version: 1, estampas: [] }),
    );

    await expect(verificarRespaldo(ruta)).rejects.toThrow(
      /No es una exportación de ladder-lab/,
    );
  });

  it('un respaldo al que le falta una versión intermedia falla', async () => {
    const { archivo } = await ejecutarRespaldo(
      await repositorioConDatos(),
      opciones(),
    );
    const envoltorio = JSON.parse(await readFile(archivo, 'utf8')) as {
      estampas: Array<{ numeroVersion?: number }>;
    };
    envoltorio.estampas[1]!.numeroVersion = 3;
    const ruta = await escribir('con-salto.json', JSON.stringify(envoltorio));

    await expect(verificarRespaldo(ruta)).rejects.toThrow(
      /incompletas o repetidas/,
    );
  });
});

describe('restaurar un respaldo en una base vacía (3.4)', () => {
  it('el resultado es idéntico: mismos ids, versiones, datos y archivadas', async () => {
    const origen = await repositorioConDatos();
    const { archivo } = await ejecutarRespaldo(origen, opciones());

    const { envoltorio } = await verificarRespaldo(archivo);
    const vacio = new InMemoryEstampaRepository();
    const resultado = await vacio.importar(planificarImportacion(envoltorio), {
      dryRun: false,
    });

    expect(resultado).toEqual({
      estampasNuevas: 2,
      versionesNuevas: 3,
      omitidas: [],
      aplicada: true,
    });
    const comparable = async (repo: InMemoryEstampaRepository) =>
      (await repo.todas({ incluirVersiones: true })).map((e) => ({
        id: e.id,
        numeroVersion: e.numeroVersion,
        totalVersiones: e.totalVersiones,
        archivada: e.archivada,
        datos: e.datos,
      }));
    expect(await comparable(vacio)).toEqual(await comparable(origen));
  });

  it('restaurar dos veces no duplica nada', async () => {
    const origen = await repositorioConDatos();
    const { archivo } = await ejecutarRespaldo(origen, opciones());
    const plan = planificarImportacion(
      (await verificarRespaldo(archivo)).envoltorio,
    );
    const destino = new InMemoryEstampaRepository();

    await destino.importar(plan, { dryRun: false });
    const segunda = await destino.importar(plan, { dryRun: false });

    expect(segunda.estampasNuevas).toBe(0);
    expect((await destino.todas({ incluirVersiones: true })).length).toBe(3);
  });

  it('un respaldo roto no se restaura: falla antes de tocar la base', async () => {
    const { archivo } = await ejecutarRespaldo(
      await repositorioConDatos(),
      opciones(),
    );
    await truncate(archivo, 100);
    const destino = new InMemoryEstampaRepository();

    await expect(verificarRespaldo(archivo)).rejects.toThrow();
    expect(await destino.todas({ incluirVersiones: true })).toHaveLength(0);
  });
});
