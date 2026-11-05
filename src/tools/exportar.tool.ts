import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import { construirEnvoltorio } from '@domain/estampa/index.js';
import { ANOTACIONES_LECTURA, protegido } from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

export function registerExportarTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    'exportar',
    {
      title: 'Exportar estampas',
      description:
        'Devuelve todas las estampas como JSON versionado ("ladder-lab.export"), cada una con su id. ' +
        'Incluye las archivadas. Con incluirVersiones también salen las versiones anteriores, cada una con su numeroVersion: ' +
        'es la salida que permite reconstruir los datos sin la base. Es la única conexión con el convertidor.',
      inputSchema: {
        incluirVersiones: z
          .boolean()
          .default(false)
          .describe('Incluir también las versiones anteriores de cada estampa'),
      },
      annotations: ANOTACIONES_LECTURA,
    },
    ({ incluirVersiones }) =>
      protegido(deps.logger, async () => {
        const estampas = await deps.repository.todas({ incluirVersiones });
        return toolJson(construirEnvoltorio(estampas, { incluirVersiones }));
      }),
  );
}
