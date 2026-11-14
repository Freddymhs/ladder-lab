import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import {
  LISTADO_LIMITE_POR_DEFECTO,
  sugerirJuegos,
} from '@domain/estampa/index.js';
import type { EstampaRepository } from '@data/index.js';
import {
  COMANDO_REPLICAR_RTS,
  DIFERENCIA_ACTIVA_Y_MATCH,
  HERRAMIENTA_ACTIVA_POR_JUEGO,
  HERRAMIENTA_CREAR,
  HERRAMIENTA_MARCAR_ACTIVA,
} from './constants.js';
import {
  avisoDeVersionMasNueva,
  indiceDeActivas,
  resumirParaElegir,
} from './activa.js';
import {
  ANOTACIONES_LECTURA,
  presentarEstampa,
  protegido,
} from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

const COMO_MARCAR = `Márcala con ${HERRAMIENTA_MARCAR_ACTIVA} (id de la estampa; numeroVersion opcional, por defecto la última).`;

/** Sin estampas con ese nombre: sugiere los nombres parecidos que sí existen. */
async function respuestaSinEstampas(
  repository: EstampaRepository,
  juego: string,
) {
  const sugerencias = sugerirJuegos(juego, await repository.juegos());
  const mensaje =
    sugerencias.length > 0
      ? `No hay estampas de "${juego}". ¿Quisiste decir ${sugerencias.map((s) => `"${s}"`).join(', ')}? Repite con ese nombre.`
      : `No hay estampas de "${juego}". Regístrala con ${HERRAMIENTA_CREAR} y después ${COMO_MARCAR.toLowerCase()}`;
  return { juego, activa: null, mensaje, sugerencias, estampasDelJuego: [] };
}

export function registerActivaPorJuegoTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    HERRAMIENTA_ACTIVA_POR_JUEGO,
    {
      title: 'Estampa activa de un juego',
      description:
        'Devuelve la estampa ACTIVA de un juego (la que Freddy usa hoy) con la versión fijada ENTERA: sistema (Windows), ' +
        `en el juego (incluidos ejecutable y archivosConfig con el texto entero de cada archivo) y resultado. Es la fuente de verdad de ${COMANDO_REPLICAR_RTS}. ` +
        'El nombre del juego no distingue mayúsculas ni espacios en los extremos. Trae además estampasDelJuego (las demás, con ✔ en la activa) para elegir otra. ' +
        'Si el juego no tiene activa lo dice: NUNCA elige una por número de versión ni por match perfecto. ' +
        `Si no hay ningún juego con ese nombre, sugiere los parecidos. ${DIFERENCIA_ACTIVA_Y_MATCH}`,
      inputSchema: {
        juego: z
          .string()
          .trim()
          .min(1)
          .describe('Nombre del juego (sin distinguir mayúsculas)'),
      },
      annotations: ANOTACIONES_LECTURA,
    },
    ({ juego }) =>
      protegido(deps.logger, async () => {
        const activa = await deps.repository.activaDe(juego);
        const delJuego = await deps.repository.listar({
          juego,
          incluirArchivadas: false,
          limite: LISTADO_LIMITE_POR_DEFECTO + 1,
          desplazamiento: 0,
        });
        if (activa === null && delJuego.length === 0) {
          return toolJson(await respuestaSinEstampas(deps.repository, juego));
        }
        const indice = indiceDeActivas(activa === null ? [] : [activa]);
        const listado = {
          estampasDelJuego: delJuego
            .slice(0, LISTADO_LIMITE_POR_DEFECTO)
            .map((e) => resumirParaElegir(e, indice)),
          hayMas: delJuego.length > LISTADO_LIMITE_POR_DEFECTO,
        };
        if (activa === null) {
          return toolJson({
            juego,
            activa: null,
            mensaje: `"${juego}" no tiene una estampa activa. No se elige ninguna por versión ni por match perfecto: pregúntale a Freddy cuál usa. ${COMO_MARCAR}`,
            ...listado,
          });
        }
        const aviso = avisoDeVersionMasNueva(activa);
        return toolJson({
          ...(aviso !== undefined && { mensaje: aviso }),
          ...presentarEstampa(activa.estampa),
          juego: activa.juego,
          activa: true,
          elegidaEn: activa.elegidaEn,
          ...listado,
        });
      }),
  );
}
