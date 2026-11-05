import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import {
  GENEROS,
  LISTADO_LIMITE_MAXIMO,
  LISTADO_LIMITE_POR_DEFECTO,
} from '@domain/estampa/index.js';
import { buscarMatchesPerfectos, presentarMatch } from './matches.js';
import { ANOTACIONES_LECTURA, protegido } from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

export function registerMatchesPerfectosTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    'matches_perfectos',
    {
      title: 'Matches perfectos',
      description:
        'Lista las estampas cuyo resultado está marcado como match perfecto, con su configuración (sistema y en el juego) y su resultado (rango en texto y certeza). ' +
        'Se puede filtrar por juego y género. Las archivadas no salen salvo con incluirArchivadas. No compara rangos ni juzga: solo muestra lo registrado.',
      inputSchema: {
        juego: z
          .string()
          .min(1)
          .optional()
          .describe('Nombre del juego (sin distinguir mayúsculas)'),
        genero: z.enum(GENEROS).optional(),
        incluirArchivadas: z.boolean().default(false),
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
    (filtro) =>
      protegido(deps.logger, async () => {
        const { estampas, hayMas } = await buscarMatchesPerfectos(
          deps.repository,
          filtro,
        );
        return toolJson({
          devueltas: estampas.length,
          limite: filtro.limite,
          desplazamiento: filtro.desplazamiento,
          hayMas,
          estampas: estampas.map(presentarMatch),
        });
      }),
  );
}
