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
import type { EstampaActiva, EstampaGuardada } from '@domain/estampa/index.js';
import { mensajeDeMarcado, presentarMarcado } from './activa.js';
import {
  HERRAMIENTA_MARCAR_ACTIVA,
  PREGUNTAR_ANTES_DE_MARCAR,
  SIGUIENTE_MARCADA,
  SIGUIENTE_SIN_MARCAR,
} from './constants.js';
import {
  ANOTACIONES_ESCRITURA,
  presentarEstampa,
  protegido,
} from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

/** Si la estampa corregida era la activa, la activa NO se mueve sola: se dice. */
const avisoDeActivaFija = (
  activa: EstampaActiva | undefined,
  nueva: EstampaGuardada,
): string =>
  activa === undefined
    ? ''
    : ` La activa de "${activa.juego}" sigue siendo la versión ${activa.estampa.numeroVersion} hasta que marques la ${nueva.numeroVersion} con ${HERRAMIENTA_MARCAR_ACTIVA}.`;

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
        'Si la configuración es distinta en otra etapa, usa crear_estampa en vez de corregir. No se puede quitar un campo opcional ya registrado. ' +
        'Las listas (exclusionesAntivirus, archivosConfig) se reemplazan enteras: envía la lista completa. ' +
        'Si la estampa era la activa de su juego, la activa sigue en la versión anterior; marcarActiva=true deja activa la versión nueva. ' +
        PREGUNTAR_ANTES_DE_MARCAR,
      inputSchema: {
        id: z.string().uuid().describe('Id de la estampa'),
        cambios: cambiosSchema.describe('Solo los campos a corregir'),
        marcarActiva: z
          .boolean()
          .optional()
          .describe(
            'true: además deja la versión nueva como la activa de su juego. Solo con el sí de Freddy',
          ),
      },
      annotations: ANOTACIONES_ESCRITURA,
    },
    ({ id, cambios, marcarActiva }) =>
      protegido(deps.logger, async () => {
        const actual = await deps.repository.obtener(id);
        if (!actual) {
          throw new EstampaNoEncontradaError(id);
        }
        const corregidos = parsearDatos(fusionar(actual.datos, cambios));
        if (sonIguales(corregidos, actual.datos)) {
          throw new SinCambiosError();
        }
        const activaPrevia = (await deps.repository.activas()).find(
          (a) => a.estampa.id === id,
        );
        const nueva = await deps.repository.corregir(
          id,
          actual.numeroVersion,
          corregidos,
        );
        const mensaje = `Corregida: ahora va en la versión ${nueva.numeroVersion}; la versión ${actual.numeroVersion} se conserva.`;
        if (!marcarActiva) {
          return toolJson({
            mensaje: mensaje + avisoDeActivaFija(activaPrevia, nueva),
            ...presentarEstampa(nueva),
            siguiente: SIGUIENTE_SIN_MARCAR,
          });
        }
        const marcado = await deps.repository.marcarActiva(
          id,
          nueva.numeroVersion,
        );
        return toolJson({
          mensaje: `${mensaje} ${mensajeDeMarcado(marcado)}`,
          ...presentarEstampa(nueva),
          activa: presentarMarcado(marcado),
          siguiente: SIGUIENTE_MARCADA,
        });
      }),
  );
}
