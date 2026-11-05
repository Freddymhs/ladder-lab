import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SERVER_NAME, SERVER_VERSION } from '@config/constants.js';
import { InMemoryEstampaRepository } from '@data/index.js';
import { createServer } from '../server.js';

describe('createServer', () => {
  it('initializes and identifies itself as ladder-lab', async () => {
    const server = createServer({
      repository: new InMemoryEstampaRepository(),
      logger: pino({ level: 'silent' }),
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(clientTransport);

    expect(client.getServerVersion()).toMatchObject({
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });

    await client.close();
  });
});
