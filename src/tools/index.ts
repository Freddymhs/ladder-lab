import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCorregirEstampaTool } from './corregir-estampa.tool.js';
import { registerCrearEstampaTool } from './crear-estampa.tool.js';
import { registerExportarTool } from './exportar.tool.js';
import { registerListarEstampasTool } from './listar-estampas.tool.js';
import { registerVerEstampaTool } from './ver-estampa.tool.js';
import type { ToolDeps } from './tool-support.js';

export type { ToolDeps } from './tool-support.js';

export function registerTools(server: McpServer, deps: ToolDeps): void {
  registerCrearEstampaTool(server, deps);
  registerCorregirEstampaTool(server, deps);
  registerVerEstampaTool(server, deps);
  registerListarEstampasTool(server, deps);
  registerExportarTool(server, deps);
}
