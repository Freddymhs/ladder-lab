import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import { LISTADO_LIMITE_POR_DEFECTO } from '@domain/estampa/index.js';
import { buscarMatchesPerfectos, presentarMatch } from './matches.js';
import { ANOTACIONES_LECTURA, protegido } from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

const CRITERIO =
  'Estampas de este juego marcadas como match perfecto, con su rango como texto y su certeza. ' +
  'No se comparan ni se ordenan rangos (no hay un orden de rangos) y no se afirma que la configuración causó el resultado.';

export function registerMejorPorJuegoTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    'mejor_por_juego',
    {
      title: 'Mejor por juego',
      description:
        'Devuelve, para un juego, las estampas marcadas como match perfecto: lo mejor que Freddy registró en ese juego, con su configuración. ' +
        '"Mejor" aquí significa solo "marcada como match perfecto": no hay ranking de rangos ni juicio sobre qué configuración es mejor. ' +
        'Si ninguna está marcada, lo dice. Para todos los juegos a la vez usa matches_perfectos.',
      inputSchema: {
        juego: z
          .string()
          .min(1)
          .describe('Nombre del juego (sin distinguir mayúsculas)'),
        incluirArchivadas: z.boolean().default(false),
      },
      annotations: ANOTACIONES_LECTURA,
    },
    ({ juego, incluirArchivadas }) =>
      protegido(deps.logger, async () => {
        const { estampas, hayMas } = await buscarMatchesPerfectos(
          deps.repository,
          {
            juego,
            incluirArchivadas,
            limite: LISTADO_LIMITE_POR_DEFECTO,
            desplazamiento: 0,
          },
        );
        if (estampas.length > 0) {
          return toolJson({
            juego,
            criterio: CRITERIO,
            encontradas: estampas.length,
            hayMas,
            estampas: estampas.map(presentarMatch),
          });
        }
        // Distinguir «no hay estampas del juego» de «hay, pero ninguna marcada».
        const delJuego = await deps.repository.listar({
          juego,
          incluirArchivadas,
          limite: 1,
          desplazamiento: 0,
        });
        return toolJson({
          juego,
          criterio: CRITERIO,
          encontradas: 0,
          estampas: [],
          mensaje:
            delJuego.length === 0
              ? `No hay estampas de "${juego}".`
              : `Ninguna estampa de "${juego}" está marcada como match perfecto.`,
        });
      }),
  );
}
