import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { env, TRANSPORT_HTTP } from '@config/index.js';
import { logger } from '@common/logger.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  if (env.transport === TRANSPORT_HTTP) {
    const { createHttpApp, listen, closeOnSignals, MCP_PATH } =
      await import('@http/index.js');

    const app = createHttpApp({
      authToken: env.authToken,
      logger,
      createMcpServer: createServer,
    });
    const { address, port } = await listen(app, env.host, env.port);
    closeOnSignals(app, logger);

    logger.info(
      `MCP server (HTTP) listening on http://${address}:${port}${MCP_PATH}`,
    );
    return;
  }

  const transport = new StdioServerTransport();
  await createServer().connect(transport);
  logger.info('MCP server running via stdio');
}

main().catch((error: unknown) => {
  logger.fatal(error, 'Failed to start MCP server');
  process.exit(1);
});
