import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import {
  EstampaNoEncontradaError,
  SinCambiosError,
  cambiosSchema,
  fusionar,
  parsearDatos,
  sonIguales,
} from '@domain/estampa/index.js';
import {
  ANOTACIONES_ESCRITURA,
  presentarEstampa,
  protegido,
} from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

export function registerCorregirEstampaTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    'corregir_estampa',
    {
      title: 'Corregir estampa',
      description:
        'Corrige un dato equivocado de una estampa existente. Crea una versión nueva y conserva la anterior (nada se borra). ' +
        'Envía solo los campos que cambian, dentro de "cambios", con la misma forma que crear_estampa. ' +
        'Si la configuración es distinta en otra etapa, usa crear_estampa en vez de corregir. No se puede quitar un campo opcional ya registrado.',
      inputSchema: {
        id: z.string().uuid().describe('Id de la estampa'),
        cambios: cambiosSchema.describe('Solo los campos a corregir'),
      },
      annotations: ANOTACIONES_ESCRITURA,
    },
    ({ id, cambios }) =>
      protegido(deps.logger, async () => {
        const actual = await deps.repository.obtener(id);
        if (!actual) {
          throw new EstampaNoEncontradaError(id);
        }
        const corregidos = parsearDatos(fusionar(actual.datos, cambios));
        if (sonIguales(corregidos, actual.datos)) {
          throw new SinCambiosError();
        }
        const nueva = await deps.repository.corregir(
          id,
          actual.numeroVersion,
          corregidos,
        );
        return toolJson({
          mensaje: `Corregida: ahora va en la versión ${nueva.numeroVersion}; la versión ${actual.numeroVersion} se conserva.`,
          ...presentarEstampa(nueva),
        });
      }),
  );
}
