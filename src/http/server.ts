import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Logger } from 'pino';
import { MIN_AUTH_TOKEN_LENGTH } from '@config/constants.js';
import { isAuthorized } from './auth.js';
import { readJsonBody } from './body.js';
import {
  CONTENT_TYPE_JSON,
  HEALTH_PATH,
  HTTP_STATUS,
  JSON_RPC_CODE,
  MAX_BODY_BYTES,
  MCP_PATH,
  URL_PARSE_BASE,
} from './constants.js';
import {
  HttpError,
  badRequest,
  methodNotAllowed,
  notFound,
  unauthorized,
} from './errors.js';

export interface HttpAppOptions {
  readonly authToken: string;
  readonly logger: Logger;
  /** Fábrica: se crea un servidor MCP por petición (modo sin estado). */
  readonly createMcpServer: () => McpServer;
  readonly maxBodyBytes?: number;
}

interface RequestContext {
  readonly authToken: string;
  readonly logger: Logger;
  readonly createMcpServer: () => McpServer;
  readonly maxBodyBytes: number;
}

function requestPath(req: IncomingMessage): string {
  try {
    return new URL(req.url ?? '/', URL_PARSE_BASE).pathname;
  } catch {
    throw badRequest('Malformed request URL');
  }
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
  headers: Readonly<Record<string, string>> = {},
): void {
  res
    .writeHead(status, { 'Content-Type': CONTENT_TYPE_JSON, ...headers })
    .end(JSON.stringify(payload));
}

function sendError(
  res: ServerResponse,
  status: number,
  rpcCode: number,
  message: string,
  headers: Readonly<Record<string, string>> = {},
): void {
  sendJson(
    res,
    status,
    { jsonrpc: '2.0', error: { code: rpcCode, message }, id: null },
    headers,
  );
}

function handleHealth(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET') {
    throw methodNotAllowed('GET');
  }
  sendJson(res, HTTP_STATUS.OK, { status: 'ok' });
}

/**
 * Modo sin estado: cada petición lleva su propio servidor y transporte.
 * Así un segundo cliente o un reinicio de Claude Code nunca choca con una
 * sesión previa (ver docs/decisions/DECISION_TRANSPORTE_HTTP.md).
 */
async function handleStateless(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  context: RequestContext,
): Promise<void> {
  const mcpServer = context.createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on('close', () => {
    Promise.all([transport.close(), mcpServer.close()]).catch(
      (error: unknown) => {
        context.logger.error({ err: error }, 'Failed to close MCP request');
      },
    );
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, body);
}

async function handleMcp(
  req: IncomingMessage,
  res: ServerResponse,
  context: RequestContext,
): Promise<void> {
  // La autenticación va primero: sin token válido no se revela ni el método
  // admitido ni nada más del servicio.
  if (!isAuthorized(req.headers.authorization, context.authToken)) {
    context.logger.warn(
      { method: req.method, path: MCP_PATH, ip: req.socket.remoteAddress },
      'Rejected unauthorized request',
    );
    throw unauthorized();
  }

  if (req.method !== 'POST') {
    throw methodNotAllowed('POST');
  }

  const body = await readJsonBody(req, context.maxBodyBytes);
  await handleStateless(req, res, body, context);
}

async function route(
  req: IncomingMessage,
  res: ServerResponse,
  context: RequestContext,
): Promise<void> {
  const path = requestPath(req);

  if (path === HEALTH_PATH) {
    return handleHealth(req, res);
  }
  if (path === MCP_PATH) {
    return handleMcp(req, res, context);
  }
  throw notFound();
}

function respondWithError(
  error: unknown,
  res: ServerResponse,
  logger: Logger,
): void {
  if (res.headersSent) {
    logger.error({ err: error }, 'Error after response started');
    res.end();
    return;
  }

  if (error instanceof HttpError) {
    sendError(res, error.status, error.rpcCode, error.message, error.headers);
    return;
  }

  logger.error({ err: error }, 'Unhandled HTTP error');
  sendError(
    res,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    JSON_RPC_CODE.INTERNAL_ERROR,
    'Internal server error',
  );
}

export function createHttpApp(options: HttpAppOptions): Server {
  const { authToken, logger, createMcpServer } = options;
  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;

  if (authToken.length < MIN_AUTH_TOKEN_LENGTH) {
    throw new Error(
      `Auth token must have at least ${MIN_AUTH_TOKEN_LENGTH} characters`,
    );
  }

  const context: RequestContext = {
    authToken,
    logger,
    createMcpServer,
    maxBodyBytes,
  };

  return createHttpServer((req, res) => {
    route(req, res, context).catch((error: unknown) => {
      respondWithError(error, res, logger);
    });
  });
}

export function listen(
  server: Server,
  host: string,
  port: number,
): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('HTTP server has no TCP address'));
        return;
      }
      resolve(address);
    });
  });
}

export function closeOnSignals(server: Server, logger: Logger): void {
  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'Shutting down HTTP server');
    server.close(() => process.exit(0));
    server.closeIdleConnections();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
