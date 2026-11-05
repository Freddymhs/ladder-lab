import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import { EstampaNoEncontradaError } from '@domain/estampa/index.js';
import {
  ANOTACIONES_LECTURA,
  presentarEstampa,
  protegido,
} from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

export function registerVerEstampaTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    'ver_estampa',
    {
      title: 'Ver estampa',
      description:
        'Muestra la versión vigente de una estampa, con su número de versión y cuántas versiones tiene.',
      inputSchema: { id: z.string().uuid().describe('Id de la estampa') },
      annotations: ANOTACIONES_LECTURA,
    },
    ({ id }) =>
      protegido(deps.logger, async () => {
        const estampa = await deps.repository.obtener(id);
        if (!estampa) {
          throw new EstampaNoEncontradaError(id);
        }
        return toolJson(presentarEstampa(estampa));
      }),
  );
}
