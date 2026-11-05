import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_NAME, SERVER_VERSION } from '@config/constants.js';
import { registerTools } from '@tools/index.js';
import type { ToolDeps } from '@tools/index.js';
import { registerResources } from '@resources/index.js';
import { registerPrompts } from '@prompts/index.js';

export type ServerDeps = ToolDeps;

export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerTools(server, deps);
  registerResources(server);
  registerPrompts(server);

  return server;
}
