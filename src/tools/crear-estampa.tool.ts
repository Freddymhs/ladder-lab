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
        'sensibilidad y rawInput aceptan además "no_aplica" si el juego no los tiene. Nunca uses null. Al menos juego.etapa o juego.fecha. ' +
        'Opcionales, para poder repetir la configuración en otro equipo: sistema.pantalla (escala, HDR, Auto HDR, Night Light, perfil de color, VRR), ' +
        'sistema.entrada (teclado), sistema.general (UAC, Game Mode, Game DVR, plan de energía, suspensión USB, exclusiones del antivirus) y, en enJuego, ' +
        'modoPantalla, topeFps, vsync, resolucionJuego, ejecutable (ruta y opciones de compatibilidad) y archivosConfig (el texto entero de los archivos de configuración del juego). ' +
        'Lee del equipo lo que puedas y pregunta al usuario lo que no; anota "desconocido" lo que no se sepa. ' +
        'No guardes contraseñas, tokens ni datos de cuenta: revisa el contenido de los archivos antes de enviarlos.',
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
