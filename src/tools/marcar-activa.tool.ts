import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import {
  COMANDO_REPLICAR_RTS,
  DIFERENCIA_ACTIVA_Y_MATCH,
  HERRAMIENTA_ACTIVA_POR_JUEGO,
  HERRAMIENTA_MARCAR_ACTIVA,
} from './constants.js';
import { mensajeDeMarcado, presentarMarcado } from './activa.js';
import {
  ANOTACIONES_ESCRITURA,
  presentarEstampa,
  protegido,
} from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

export function registerMarcarActivaTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    HERRAMIENTA_MARCAR_ACTIVA,
    {
      title: 'Marcar estampa activa',
      description:
        'Marca una estampa como la ACTIVA de su juego: la configuración que Freddy usa hoy, la fuente de verdad que lee ' +
        `${COMANDO_REPLICAR_RTS} para replicarla. Hay una sola por juego (sin distinguir mayúsculas): marcar otra la reemplaza. ` +
        'Queda fijada a una versión: sin numeroVersion, la última que tenga ahora; corregir la estampa después NO mueve la activa. ' +
        'Una estampa archivada no se puede marcar. No borra ni cambia ninguna estampa. ' +
        `${DIFERENCIA_ACTIVA_Y_MATCH} Antes de marcar, muestra la activa de hoy con ${HERRAMIENTA_ACTIVA_POR_JUEGO} y pregúntale a Freddy.`,
      inputSchema: {
        id: z.string().uuid().describe('Id de la estampa'),
        numeroVersion: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Versión a fijar; por defecto la última'),
      },
      annotations: { ...ANOTACIONES_ESCRITURA, idempotentHint: true },
    },
    ({ id, numeroVersion }) =>
      protegido(deps.logger, async () => {
        const resultado = await deps.repository.marcarActiva(id, numeroVersion);
        return toolJson({
          mensaje: mensajeDeMarcado(resultado),
          ...presentarEstampa(resultado.activa.estampa),
          ...presentarMarcado(resultado),
        });
      }),
  );
}
