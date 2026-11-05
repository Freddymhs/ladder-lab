import './respaldo/entorno-cli.js';
import { env } from '@config/index.js';
import { logger } from '@common/logger.js';
import {
  SupabaseEstampaRepository,
  crearClienteSupabase,
} from '@data/index.js';
import {
  ARGUMENTO_VERIFICAR,
  CODIGO_SALIDA,
  ejecutarRespaldo,
  verificarRespaldo,
} from './respaldo/index.js';

/**
 * Uso:
 *   node dist/respaldo.js                     hace un respaldo completo
 *   node dist/respaldo.js --verificar <ruta>  comprueba que un respaldo sirva
 * Sale con 0 si todo bien, 1 si falló y 2 si el respaldo se hizo pero hay una alerta.
 */
async function main(): Promise<number> {
  const [argumento, ruta] = process.argv.slice(2);

  if (argumento === ARGUMENTO_VERIFICAR) {
    if (!ruta)
      throw new Error(`Uso: ${ARGUMENTO_VERIFICAR} <ruta del respaldo>`);
    const { estampas, versiones, archivadas } = await verificarRespaldo(ruta);
    logger.info(
      { ruta, estampas, versiones, archivadas },
      'Respaldo verificado',
    );
    return CODIGO_SALIDA.OK;
  }

  const repository = new SupabaseEstampaRepository(
    crearClienteSupabase({
      url: env.supabaseUrl,
      serviceKey: env.supabaseServiceKey,
    }),
  );
  const resumen = await ejecutarRespaldo(repository, {
    directorio: env.respaldoDir,
    ahora: new Date(),
    retencion: env.respaldoRetencion,
  });

  // Siempre con el denominador: cuántas estampas y versiones respaldó.
  logger.info(resumen, 'Respaldo hecho');
  if (resumen.alerta) {
    logger.warn(
      { alerta: resumen.alerta },
      'Respaldo con alerta: no se eliminó ningún respaldo viejo',
    );
    return CODIGO_SALIDA.ALERTA;
  }
  return CODIGO_SALIDA.OK;
}

main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((error: unknown) => {
    logger.fatal({ err: error }, 'El respaldo falló');
    process.exitCode = CODIGO_SALIDA.FALLO;
  });
