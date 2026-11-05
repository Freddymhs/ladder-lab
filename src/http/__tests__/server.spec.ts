import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';
import { MIN_AUTH_TOKEN_LENGTH } from '@config/constants.js';
import { createHttpApp, listen } from '../server.js';
import { HEALTH_PATH, MCP_PATH } from '../constants.js';

const TOKEN = 'valid-token-'.padEnd(MIN_AUTH_TOKEN_LENGTH + 8, 'x');
const WRONG_TOKEN = 'wrong-token-'.padEnd(MIN_AUTH_TOKEN_LENGTH + 8, 'y');
const MAX_BODY = 256;

const MCP_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};
const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'raw', version: '0.0.1' },
  },
};

const buildMcpServer = (): McpServer => {
  const server = new McpServer({ name: 'test-server', version: '0.0.1' });
  server.registerTool(
    'echo',
    { description: 'echo', inputSchema: { text: z.string() } },
    async ({ text }) => ({ content: [{ type: 'text' as const, text }] }),
  );
  return server;
};

interface Harness {
  readonly baseUrl: string;
  readonly logLines: string[];
  readonly createMcpServer: ReturnType<typeof vi.fn<() => McpServer>>;
  readonly server: Server;
}

const startHarness = async (
  overrides: { createMcpServer?: () => McpServer } = {},
): Promise<Harness> => {
  const logLines: string[] = [];
  const logger = pino(
    { level: 'debug' },
    { write: (chunk: string) => void logLines.push(chunk) },
  );
  const createMcpServer = vi.fn(overrides.createMcpServer ?? buildMcpServer);
  const server = createHttpApp({
    authToken: TOKEN,
    logger,
    createMcpServer,
    maxBodyBytes: MAX_BODY,
  });
  const { port } = await listen(server, '127.0.0.1', 0);
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    logLines,
    createMcpServer,
    server,
  };
};

const authHeaders = { Authorization: `Bearer ${TOKEN}` };

describe('http app', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await startHarness();
  });

  afterEach(async () => {
    harness.server.closeAllConnections();
    await new Promise((resolve) => harness.server.close(resolve));
  });

  const post = (body: string, headers: Record<string, string> = {}) =>
    fetch(`${harness.baseUrl}${MCP_PATH}`, {
      method: 'POST',
      headers: { ...MCP_HEADERS, ...headers },
      body,
    });

  describe('authentication', () => {
    const REJECTED: ReadonlyArray<[string, Record<string, string>]> = [
      ['no Authorization header', {}],
      ['empty bearer', { Authorization: 'Bearer ' }],
      ['wrong token', { Authorization: `Bearer ${WRONG_TOKEN}` }],
      ['token without scheme', { Authorization: TOKEN }],
      ['basic scheme', { Authorization: `Basic ${TOKEN}` }],
      ['invented token', { Authorization: 'Bearer basura' }],
    ];

    it.each(REJECTED)('POST /mcp with %s -> 401', async (_label, headers) => {
      const response = await post(JSON.stringify(INITIALIZE), headers);

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
      expect(harness.createMcpServer).not.toHaveBeenCalled();
    });

    it.each(['GET', 'DELETE', 'PUT'])(
      '%s /mcp without token -> 401, not 405',
      async (method) => {
        const response = await fetch(`${harness.baseUrl}${MCP_PATH}`, {
          method,
        });

        expect(response.status).toBe(401);
      },
    );

    it('a valid token is accepted', async () => {
      const response = await post(JSON.stringify(INITIALIZE), authHeaders);

      expect(response.status).toBe(200);
    });

    it('never writes any token to the logs, accepted or rejected', async () => {
      await post(JSON.stringify(INITIALIZE), authHeaders);
      await post(JSON.stringify(INITIALIZE), {
        Authorization: `Bearer ${WRONG_TOKEN}`,
      });

      const logs = harness.logLines.join('');
      expect(harness.logLines.length).toBeGreaterThan(0);
      expect(logs).toContain('Rejected unauthorized request');
      expect(logs).not.toContain(TOKEN);
      expect(logs).not.toContain(WRONG_TOKEN);
    });
  });

  describe('request hardening', () => {
    it('invalid JSON -> 400 parse error, and the server keeps serving', async () => {
      const bad = await post('{not json', authHeaders);
      const badBody = await bad.json();

      expect(bad.status).toBe(400);
      expect(badBody.error.code).toBe(-32700);

      const next = await post(JSON.stringify(INITIALIZE), authHeaders);
      expect(next.status).toBe(200);
    });

    it('empty body -> 400', async () => {
      const response = await post('', authHeaders);

      expect(response.status).toBe(400);
    });

    it('body over the limit -> 413', async () => {
      const oversized = JSON.stringify({
        ...INITIALIZE,
        pad: 'x'.repeat(MAX_BODY),
      });
      const response = await post(oversized, authHeaders);

      expect(response.status).toBe(413);
    });

    it.each(['GET', 'DELETE', 'PUT'])(
      '%s /mcp with token -> 405 with Allow: POST',
      async (method) => {
        const response = await fetch(`${harness.baseUrl}${MCP_PATH}`, {
          method,
          headers: authHeaders,
        });

        expect(response.status).toBe(405);
        expect(response.headers.get('allow')).toBe('POST');
      },
    );

    it('unknown path -> 404', async () => {
      const response = await fetch(`${harness.baseUrl}/otra-cosa`, {
        headers: authHeaders,
      });

      expect(response.status).toBe(404);
    });

    it('an unexpected failure -> 500 without leaking details, logged, server survives', async () => {
      const failing = await startHarness({
        createMcpServer: () => {
          throw new Error('detalle-interno-secreto');
        },
      });

      try {
        const response = await fetch(`${failing.baseUrl}${MCP_PATH}`, {
          method: 'POST',
          headers: { ...MCP_HEADERS, ...authHeaders },
          body: JSON.stringify(INITIALIZE),
        });
        const text = await response.text();

        expect(response.status).toBe(500);
        expect(text).not.toContain('detalle-interno-secreto');
        expect(failing.logLines.join('')).toContain('detalle-interno-secreto');

        const health = await fetch(`${failing.baseUrl}${HEALTH_PATH}`);
        expect(health.status).toBe(200);
      } finally {
        failing.server.closeAllConnections();
        await new Promise((resolve) => failing.server.close(resolve));
      }
    });
  });

  describe('health', () => {
    it('GET /healthz answers 200 without a token and without data', async () => {
      const response = await fetch(`${harness.baseUrl}${HEALTH_PATH}`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });
    });

    it('POST /healthz -> 405', async () => {
      const response = await fetch(`${harness.baseUrl}${HEALTH_PATH}`, {
        method: 'POST',
      });

      expect(response.status).toBe(405);
    });
  });

  describe('MCP over real HTTP (stateless)', () => {
    const connect = async (token: string = TOKEN): Promise<Client> => {
      const transport = new StreamableHTTPClientTransport(
        new URL(`${harness.baseUrl}${MCP_PATH}`),
        { requestInit: { headers: { Authorization: `Bearer ${token}` } } },
      );
      const client = new Client({ name: 'http-client', version: '0.0.1' });
      await client.connect(transport);
      return client;
    };

    it('lists and calls a tool through the real transport', async () => {
      const client = await connect();

      const { tools } = await client.listTools();
      const result = await client.callTool({
        name: 'echo',
        arguments: { text: 'hola' },
      });

      expect(tools.map((tool) => tool.name)).toEqual(['echo']);
      expect(result.content).toEqual([{ type: 'text', text: 'hola' }]);
      await client.close();
    });

    it('two clients can be connected at the same time', async () => {
      const first = await connect();
      const second = await connect();

      const [a, b] = await Promise.all([first.listTools(), second.listTools()]);

      expect(a.tools).toHaveLength(1);
      expect(b.tools).toHaveLength(1);
      await Promise.all([first.close(), second.close()]);
    });

    it('a client can reconnect after another one went away', async () => {
      const first = await connect();
      await first.close();

      const second = await connect();
      const { tools } = await second.listTools();

      expect(tools).toHaveLength(1);
      await second.close();
    });

    it('a client with the wrong token cannot initialize', async () => {
      await expect(connect(WRONG_TOKEN)).rejects.toThrow();
    });
  });
});

describe('createHttpApp', () => {
  it('refuses a token shorter than the minimum, at construction time', () => {
    expect(() =>
      createHttpApp({
        authToken: 'x'.repeat(MIN_AUTH_TOKEN_LENGTH - 1),
        logger: pino({ level: 'silent' }),
        createMcpServer: buildMcpServer,
      }),
    ).toThrow(/at least/);
  });

  it('accepts a token of exactly the minimum length', () => {
    const server = createHttpApp({
      authToken: 'x'.repeat(MIN_AUTH_TOKEN_LENGTH),
      logger: pino({ level: 'silent' }),
      createMcpServer: buildMcpServer,
    });

    expect(server.listening).toBe(false);
  });
});
