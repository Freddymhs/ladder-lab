import { afterEach, describe, expect, it, vi } from 'vitest';

describe('entorno-cli', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('fuerza el transporte stdio aunque la imagen traiga http, para no exigir el token HTTP', async () => {
    vi.stubEnv('MCP_TRANSPORT', 'http');

    await import('../entorno-cli.js');

    expect(process.env.MCP_TRANSPORT).toBe('stdio');
  });
});
