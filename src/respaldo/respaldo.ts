import { createHash } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import type { EstampaRepository } from '@data/index.js';
import {
  ImportacionInvalidaError,
  construirEnvoltorio,
  planificarImportacion,
  validarEnvoltorio,
} from '@domain/estampa/index.js';
import type { EnvoltorioExport } from '@domain/estampa/index.js';
import {
  EXTENSION_RESPALDO,
  EXTENSION_TEMPORAL,
  PATRON_ARCHIVO_RESPALDO,
  PREFIJO_RESPALDO,
} from './constants.js';

export interface OpcionesRespaldo {
  readonly directorio: string;
  readonly ahora: Date;
  /** Cuántos respaldos se conservan; los más viejos se eliminan. Mínimo 1. */
  readonly retencion: number;
}

export interface ContenidoVerificado {
  readonly estampas: number;
  readonly versiones: number;
  readonly archivadas: number;
  readonly envoltorio: EnvoltorioExport;
}

export interface ResumenRespaldo {
  readonly archivo: string;
  readonly estampas: number;
  readonly versiones: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly eliminados: readonly string[];
  /** Presente si algo no cuadra; con alerta no se elimina ningún respaldo viejo. */
  readonly alerta?: string;
}

export const nombreDeRespaldo = (ahora: Date): string => {
  const sello = ahora
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `${PREFIJO_RESPALDO}${sello}${EXTENSION_RESPALDO}`;
};

/**
 * Lee un respaldo y comprueba que sirva para restaurar: JSON completo, formato
 * y versión conocidos, esquema válido y versiones consecutivas por estampa.
 * Un respaldo que nunca se verificó no está probado.
 */
export async function verificarRespaldo(
  ruta: string,
): Promise<ContenidoVerificado> {
  const texto = await readFile(ruta, 'utf8');
  const entrada = ((): unknown => {
    try {
      return JSON.parse(texto);
    } catch {
      throw new ImportacionInvalidaError(
        `El respaldo ${ruta} no es JSON válido (¿truncado?): no sirve para restaurar.`,
      );
    }
  })();

  const envoltorio = validarEnvoltorio(entrada);
  const plan = planificarImportacion(envoltorio);
  return {
    estampas: plan.estampas.length,
    versiones: envoltorio.estampas.length,
    archivadas: plan.estampas.filter((e) => e.archivada).length,
    envoltorio,
  };
}

const respaldosExistentes = async (directorio: string): Promise<string[]> =>
  (await readdir(directorio))
    .filter((nombre) => PATRON_ARCHIVO_RESPALDO.test(nombre))
    .sort();

/**
 * Escribe un respaldo completo (todas las versiones y las archivadas), lo
 * relee y lo verifica, y recién entonces poda los viejos. La escritura es
 * atómica (archivo temporal + rename): nunca queda un respaldo a medias con
 * el nombre de uno bueno.
 */
export async function ejecutarRespaldo(
  repository: EstampaRepository,
  opciones: OpcionesRespaldo,
): Promise<ResumenRespaldo> {
  if (opciones.retencion < 1) {
    throw new Error(
      'La retención debe ser al menos 1: de lo contrario se borraría el respaldo recién hecho',
    );
  }
  await mkdir(opciones.directorio, { recursive: true });

  const anteriores = await respaldosExistentes(opciones.directorio);
  const estampas = await repository.todas({ incluirVersiones: true });
  const contenido = JSON.stringify(
    construirEnvoltorio(estampas, { incluirVersiones: true }),
    null,
    2,
  );

  const archivo = nombreDeRespaldo(opciones.ahora);
  const destino = join(opciones.directorio, archivo);
  const temporal = `${destino}${EXTENSION_TEMPORAL}`;
  await writeFile(temporal, contenido, 'utf8');

  const escrito = await verificarRespaldo(temporal).catch(
    async (error: unknown) => {
      await rm(temporal, { force: true });
      throw error;
    },
  );
  if (escrito.versiones !== estampas.length) {
    await rm(temporal, { force: true });
    throw new Error(
      `El respaldo escrito tiene ${escrito.versiones} versiones y se esperaban ${estampas.length}`,
    );
  }
  await rename(temporal, destino);

  const alerta = await compararConElAnterior(
    opciones.directorio,
    anteriores,
    escrito,
  );
  const sobrantes = alerta
    ? []
    : anteriores.slice(
        0,
        Math.max(0, anteriores.length + 1 - opciones.retencion),
      );
  await Promise.all(
    sobrantes.map((nombre) => rm(join(opciones.directorio, nombre))),
  );

  return {
    archivo: destino,
    estampas: escrito.estampas,
    versiones: escrito.versiones,
    bytes: Buffer.byteLength(contenido, 'utf8'),
    sha256: createHash('sha256').update(contenido).digest('hex'),
    eliminados: sobrantes,
    ...(alerta && { alerta }),
  };
}

/**
 * Como nada se borra, el número de estampas y de versiones nunca debería
 * bajar. Si baja, se está respaldando otra base o falta algo: se avisa y NO se
 * poda, para no reemplazar buenos respaldos por uno peor.
 */
async function compararConElAnterior(
  directorio: string,
  anteriores: readonly string[],
  actual: ContenidoVerificado,
): Promise<string | undefined> {
  const ultimo = anteriores.at(-1);
  if (ultimo === undefined) return undefined;

  const previo = await verificarRespaldo(join(directorio, ultimo)).catch(
    () => undefined,
  );
  if (previo === undefined) {
    return `El respaldo anterior ${ultimo} no se puede verificar: no se elimina ninguno.`;
  }
  if (
    actual.estampas < previo.estampas ||
    actual.versiones < previo.versiones
  ) {
    return `Este respaldo tiene menos datos que ${ultimo} (${actual.estampas}/${actual.versiones} contra ${previo.estampas}/${previo.versiones} estampas/versiones): ¿otra base?`;
  }
  return undefined;
}
