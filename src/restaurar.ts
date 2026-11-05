import './respaldo/entorno-cli.js';
import { env } from '@config/index.js';
import { logger } from '@common/logger.js';
import {
  SupabaseEstampaRepository,
  crearClienteSupabase,
} from '@data/index.js';
import { planificarImportacion } from '@domain/estampa/index.js';
import { CODIGO_SALIDA, verificarRespaldo } from './respaldo/index.js';

const ARGUMENTO_APLICAR = '--aplicar';

/**
 * Uso:
 *   node dist/restaurar.js <ruta>              SIMULA: verifica el respaldo y dice qué entraría
 *   node dist/restaurar.js <ruta> --aplicar    restaura de verdad
 * Es la misma lógica que la herramienta importar_json, sin pasar el JSON por el chat.
 * Los ids existentes se omiten: nunca se sobrescribe nada.
 */
async function main(): Promise<number> {
  const [ruta, bandera] = process.argv.slice(2);
  if (!ruta) {
    throw new Error(
      `Uso: restaurar <ruta del respaldo> [${ARGUMENTO_APLICAR}]`,
    );
  }

  // Un respaldo roto falla aquí, antes de tocar la base.
  const { envoltorio, estampas, versiones } = await verificarRespaldo(ruta);
  const repository = new SupabaseEstampaRepository(
    crearClienteSupabase({
      url: env.supabaseUrl,
      serviceKey: env.supabaseServiceKey,
    }),
  );
  const dryRun = bandera !== ARGUMENTO_APLICAR;
  const resultado = await repository.importar(
    planificarImportacion(envoltorio),
    { dryRun },
  );

  logger.info(
    { ruta, enElRespaldo: { estampas, versiones }, ...resultado },
    dryRun
      ? 'Simulación de restauración (no se escribió nada)'
      : 'Restauración aplicada',
  );
  return CODIGO_SALIDA.OK;
}

main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((error: unknown) => {
    logger.fatal({ err: error }, 'La restauración falló: no se cambió nada');
    process.exitCode = CODIGO_SALIDA.FALLO;
  });
