import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import { EstampaNoEncontradaError } from '@domain/estampa/index.js';
import { HERRAMIENTA_MARCAR_ACTIVA } from './constants.js';
import {
  ANOTACIONES_ESCRITURA,
  presentarEstampa,
  protegido,
} from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

export function registerArchivarEstampaTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    'archivar_estampa',
    {
      title: 'Archivar estampa',
      description:
        'Archiva una estampa: deja de salir en listar_estampas (salvo con incluirArchivadas) pero NO se borra nada: ' +
        'conserva todas sus versiones y sigue en exportar. Es la forma de "quitar" una estampa que ya no interesa. ' +
        'Es idempotente. En esta versión no hay herramienta para desarchivar. Si era la estampa activa de su juego, el juego queda sin activa.',
      inputSchema: { id: z.string().uuid().describe('Id de la estampa') },
      annotations: { ...ANOTACIONES_ESCRITURA, idempotentHint: true },
    },
    ({ id }) =>
      protegido(deps.logger, async () => {
        const actual = await deps.repository.obtener(id);
        if (!actual) {
          throw new EstampaNoEncontradaError(id);
        }
        if (actual.archivada) {
          return toolJson({
            mensaje: 'Ya estaba archivada: no se cambió nada.',
            ...presentarEstampa(actual),
          });
        }
        const eraActiva = (await deps.repository.activas()).find(
          (a) => a.estampa.id === id,
        );
        const archivada = await deps.repository.archivar(id);
        const mensaje = `Archivada. No se borró nada: sus ${archivada.totalVersiones} versión(es) se conservan.`;
        if (eraActiva === undefined) {
          return toolJson({ mensaje, ...presentarEstampa(archivada) });
        }
        const { juego } = eraActiva;
        return toolJson({
          mensaje: `${mensaje} Era la estampa activa: "${juego}" queda sin estampa activa hasta que marques otra con ${HERRAMIENTA_MARCAR_ACTIVA}.`,
          juegoSinActiva: juego,
          ...presentarEstampa(archivada),
        });
      }),
  );
}
