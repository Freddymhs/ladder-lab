import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import {
  GENEROS,
  LISTADO_LIMITE_MAXIMO,
  LISTADO_LIMITE_POR_DEFECTO,
} from '@domain/estampa/index.js';
import {
  ANOTACIONES_LECTURA,
  protegido,
  resumirEstampa,
} from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

export function registerListarEstampasTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    'listar_estampas',
    {
      title: 'Listar estampas',
      description:
        'Lista un resumen de las estampas vigentes, de la más reciente a la más antigua por fecha. Se puede filtrar por juego (sin distinguir mayúsculas) y por género. Usa ver_estampa para el detalle.',
      inputSchema: {
        juego: z.string().min(1).optional().describe('Nombre exacto del juego'),
        genero: z.enum(GENEROS).optional(),
        limite: z
          .number()
          .int()
          .min(1)
          .max(LISTADO_LIMITE_MAXIMO)
          .default(LISTADO_LIMITE_POR_DEFECTO),
        desplazamiento: z.number().int().min(0).default(0),
      },
      annotations: ANOTACIONES_LECTURA,
    },
    ({ juego, genero, limite, desplazamiento }) =>
      protegido(deps.logger, async () => {
        // Se pide una de más para saber si hay otra página sin contar todo.
        const encontradas = await deps.repository.listar({
          juego,
          genero,
          incluirArchivadas: false,
          limite: limite + 1,
          desplazamiento,
        });
        return toolJson({
          devueltas: Math.min(encontradas.length, limite),
          limite,
          desplazamiento,
          hayMas: encontradas.length > limite,
          estampas: encontradas.slice(0, limite).map(resumirEstampa),
        });
      }),
  );
}
