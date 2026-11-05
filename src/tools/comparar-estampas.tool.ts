import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import {
  COMPARAR_MAXIMO,
  COMPARAR_MINIMO,
  DatosInvalidosError,
  EstampaNoEncontradaError,
  compararEstampas,
} from '@domain/estampa/index.js';
import {
  ANOTACIONES_LECTURA,
  protegido,
  resumirEstampa,
} from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

export function registerCompararEstampasTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    'comparar_estampas',
    {
      title: 'Comparar estampas',
      description:
        `Compara entre ${COMPARAR_MINIMO} y ${COMPARAR_MAXIMO} estampas campo por campo (versión vigente de cada una). ` +
        '"diferencias": campos donde dos estampas tienen un dato real y distinto. ' +
        '"incompletos": campos donde alguna estampa no tiene dato ("desconocido", "no_aplica" o sin registrar), así que no se sabe si coinciden. ' +
        'Solo describe: NO dice cuál configuración es mejor ni afirma que una causó el resultado.',
      inputSchema: {
        ids: z
          .array(z.string().uuid())
          .min(COMPARAR_MINIMO)
          .max(COMPARAR_MAXIMO)
          .describe('Ids de las estampas a comparar'),
      },
      annotations: ANOTACIONES_LECTURA,
    },
    ({ ids }) =>
      protegido(deps.logger, async () => {
        if (new Set(ids).size !== ids.length) {
          throw new DatosInvalidosError(
            'Hay ids repetidos: compara estampas distintas.',
          );
        }
        const leidas = await Promise.all(
          ids.map((id) => deps.repository.obtener(id)),
        );
        const faltantes = ids.filter((_, i) => leidas[i] === null);
        if (faltantes.length > 0) {
          throw new EstampaNoEncontradaError(faltantes.join(', '));
        }
        const estampas = leidas.filter((e) => e !== null);
        return toolJson({
          estampas: estampas.map(resumirEstampa),
          ...compararEstampas(
            estampas.map((e) => ({ id: e.id, datos: e.datos })),
          ),
        });
      }),
  );
}
