import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { toolJson } from '@common/errors.js';
import { datosBaseSchema, parsearDatos } from '@domain/estampa/index.js';
import {
  ANOTACIONES_ESCRITURA,
  presentarEstampa,
  protegido,
} from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

export function registerCrearEstampaTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    'crear_estampa',
    {
      title: 'Crear estampa',
      description:
        'Registra una estampa nueva: una foto de la configuración de Windows y del juego ligada a un juego y a un resultado. ' +
        'Úsala para una configuración distinta o una etapa nueva (una configuración distinta en otra etapa es OTRA estampa, no una corrección). ' +
        'Los campos obligatorios aceptan "desconocido" cuando no se sabe (menos juego.nombre, juego.genero y resultado.certeza); ' +
        'sensibilidad y rawInput aceptan además "no_aplica" si el juego no los tiene. Nunca uses null. Al menos juego.etapa o juego.fecha.',
      inputSchema: datosBaseSchema,
      annotations: ANOTACIONES_ESCRITURA,
    },
    (args) =>
      protegido(deps.logger, async () => {
        const creada = await deps.repository.crear(parsearDatos(args));
        return toolJson({
          mensaje: 'Estampa creada.',
          ...presentarEstampa(creada),
        });
      }),
  );
}
