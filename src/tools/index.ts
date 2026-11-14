import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerActivaPorJuegoTool } from './activa-por-juego.tool.js';
import { registerArchivarEstampaTool } from './archivar-estampa.tool.js';
import { registerCompararEstampasTool } from './comparar-estampas.tool.js';
import { registerCorregirEstampaTool } from './corregir-estampa.tool.js';
import { registerCrearEstampaTool } from './crear-estampa.tool.js';
import { registerExportarTool } from './exportar.tool.js';
import { registerHistorialVersionesTool } from './historial-versiones.tool.js';
import { registerImportarJsonTool } from './importar-json.tool.js';
import { registerListarEstampasTool } from './listar-estampas.tool.js';
import { registerMarcarActivaTool } from './marcar-activa.tool.js';
import { registerMatchesPerfectosTool } from './matches-perfectos.tool.js';
import { registerMejorPorJuegoTool } from './mejor-por-juego.tool.js';
import { registerVerEstampaTool } from './ver-estampa.tool.js';
import type { ToolDeps } from './tool-support.js';

export type { ToolDeps } from './tool-support.js';

export function registerTools(server: McpServer, deps: ToolDeps): void {
  registerCrearEstampaTool(server, deps);
  registerCorregirEstampaTool(server, deps);
  registerVerEstampaTool(server, deps);
  registerListarEstampasTool(server, deps);
  registerExportarTool(server, deps);
  registerArchivarEstampaTool(server, deps);
  registerImportarJsonTool(server, deps);
  registerHistorialVersionesTool(server, deps);
  registerCompararEstampasTool(server, deps);
  registerMejorPorJuegoTool(server, deps);
  registerMatchesPerfectosTool(server, deps);
  registerMarcarActivaTool(server, deps);
  registerActivaPorJuegoTool(server, deps);
}
