import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import {
  EstampaNoEncontradaError,
  cambiosEntre,
} from '@domain/estampa/index.js';
import { ANOTACIONES_LECTURA, protegido } from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

export function registerHistorialVersionesTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    'historial_versiones',
    {
      title: 'Historial de versiones',
      description:
        'Muestra todas las versiones de una estampa en orden y qué campos cambiaron entre una y la siguiente (de qué valor a cuál). ' +
        'Describe los cambios; no dice cuál versión es mejor. Sirve para ver cómo se fue corrigiendo un dato.',
      inputSchema: { id: z.string().uuid().describe('Id de la estampa') },
      annotations: ANOTACIONES_LECTURA,
    },
    ({ id }) =>
      protegido(deps.logger, async () => {
        const versiones = await deps.repository.versionesDe(id);
        if (!versiones) {
          throw new EstampaNoEncontradaError(id);
        }
        return toolJson({
          id,
          archivada: versiones[0]?.archivada ?? false,
          totalVersiones: versiones.length,
          versiones: versiones.map((version, indice) => {
            const anterior = versiones[indice - 1];
            return {
              numeroVersion: version.numeroVersion,
              creadaEn: version.versionCreadaEn,
              ...(anterior === undefined
                ? { inicial: true }
                : {
                    cambios: cambiosEntre(anterior.datos, version.datos).map(
                      (c) => ({
                        campo: c.campo,
                        antes: c.antes ?? null,
                        despues: c.despues ?? null,
                      }),
                    ),
                  }),
            };
          }),
        });
      }),
  );
}
