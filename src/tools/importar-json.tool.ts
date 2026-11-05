import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolJson } from '@common/errors.js';
import {
  planificarImportacion,
  validarEnvoltorio,
} from '@domain/estampa/index.js';
import { ANOTACIONES_ESCRITURA, protegido } from './tool-support.js';
import type { ToolDeps } from './tool-support.js';

export function registerImportarJsonTool(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    'importar_json',
    {
      title: 'Importar JSON',
      description:
        'Carga estampas desde el JSON que devuelve exportar ("ladder-lab.export", versión 1). Las estampas cuyo id ya existe se OMITEN: nunca se sobrescribe nada. ' +
        'Es todo o nada: si algo falla no entra nada. Por defecto es una SIMULACIÓN (dryRun=true) que hace todas las comprobaciones y no escribe: ' +
        'revisa el resultado y repite con dryRun=false para aplicar. Con la exportación sin incluirVersiones, cada estampa se restaura como versión 1.',
      inputSchema: {
        envoltorio: z
          .record(z.unknown())
          .describe('El objeto completo que devolvió exportar, tal cual'),
        dryRun: z
          .boolean()
          .default(true)
          .describe('true (por defecto): simula sin escribir. false: aplica'),
      },
      annotations: { ...ANOTACIONES_ESCRITURA, idempotentHint: true },
    },
    ({ envoltorio, dryRun }) =>
      protegido(deps.logger, async () => {
        const plan = planificarImportacion(validarEnvoltorio(envoltorio));
        const resultado = await deps.repository.importar(plan, { dryRun });
        const mensaje = dryRun
          ? `Simulación: no se escribió nada. Con dryRun=false entrarían ${resultado.estampasNuevas} estampa(s) nueva(s) y ${resultado.versionesNuevas} versión(es); ${resultado.omitidas.length} ya existían y se omitirían.`
          : `Importado: ${resultado.estampasNuevas} estampa(s) nueva(s), ${resultado.versionesNuevas} versión(es); ${resultado.omitidas.length} ya existían y se omitieron.`;
        return toolJson({ mensaje, ...resultado });
      }),
  );
}
