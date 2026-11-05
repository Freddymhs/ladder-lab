import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

const DIRECTORIO_MIGRACIONES = new URL(
  '../../../supabase/migrations/',
  import.meta.url,
);
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1']);

/** Variable con la URL de administración de un Postgres DESECHABLE de pruebas. */
export const VARIABLE_BASE_DE_PRUEBAS = 'TEST_DATABASE_URL';
export const VARIABLE_PERMITIR_REMOTA = 'TEST_DATABASE_ALLOW_REMOTE';

export const urlDeAdministracion = (): string | undefined => {
  const url = process.env[VARIABLE_BASE_DE_PRUEBAS];
  if (!url) return undefined;
  const { hostname } = new URL(url);
  if (
    !HOSTS_LOCALES.has(hostname) &&
    process.env[VARIABLE_PERMITIR_REMOTA] !== '1'
  ) {
    throw new Error(
      `${VARIABLE_BASE_DE_PRUEBAS} apunta a ${hostname}: solo se aceptan bases locales (o ${VARIABLE_PERMITIR_REMOTA}=1)`,
    );
  }
  return url;
};

const conBase = (urlAdmin: string, base: string): string => {
  const url = new URL(urlAdmin);
  url.pathname = `/${base}`;
  return url.toString();
};

interface Resultado {
  readonly salida: string;
}

/** Ejecuta SQL con psql (sin shell). Lanza con el stderr si el SQL falla. */
export function ejecutarSql(url: string, sql: string): Resultado {
  const salida = execFileSync(
    'psql',
    [
      url,
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-v',
      'VERBOSITY=verbose',
      '-tA',
      '-c',
      sql,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return { salida: salida.trim() };
}

/** Devuelve el stderr de un SQL que DEBE fallar; si no falla, lanza. */
export function sqlQueFalla(url: string, sql: string): string {
  try {
    ejecutarSql(url, sql);
  } catch (error) {
    return String((error as { stderr?: unknown }).stderr ?? error);
  }
  throw new Error(`Se esperaba un error y el SQL pasó: ${sql}`);
}

export const literalJson = (valor: unknown): string =>
  `'${JSON.stringify(valor).replaceAll("'", "''")}'::jsonb`;

export interface BaseTemporal {
  readonly url: string;
  readonly eliminar: () => void;
}

/** Crea una base nueva con todas las migraciones aplicadas; nunca toca una existente. */
export function crearBaseTemporal(urlAdmin: string): BaseTemporal {
  const nombre = `ladder_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  ejecutarSql(conBase(urlAdmin, 'postgres'), `create database ${nombre}`);
  const url = conBase(urlAdmin, nombre);

  const archivos = readdirSync(DIRECTORIO_MIGRACIONES)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const archivo of archivos) {
    execFileSync(
      'psql',
      [
        url,
        '-X',
        '-q',
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        new URL(archivo, DIRECTORIO_MIGRACIONES).pathname,
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  }
  // Una migración sin ningún archivo sería un verde vacío.
  if (archivos.length === 0) throw new Error('No hay migraciones que aplicar');

  return {
    url,
    eliminar: () =>
      void ejecutarSql(
        conBase(urlAdmin, 'postgres'),
        `drop database if exists ${nombre} with (force)`,
      ),
  };
}

export const leerMigracion = (archivo: string): string =>
  readFileSync(new URL(archivo, DIRECTORIO_MIGRACIONES), 'utf8');
