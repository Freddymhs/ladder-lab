import { describe, expect, it } from 'vitest';
import { parseEnv } from '../env.js';
import { MIN_AUTH_TOKEN_LENGTH } from '../constants.js';

const VALID_TOKEN = 'a'.repeat(MIN_AUTH_TOKEN_LENGTH);
const SUPABASE = {
  SUPABASE_URL: 'https://example.invalid',
  SUPABASE_SERVICE_KEY: 'service-key-placeholder',
};

describe('parseEnv', () => {
  it('applies safe defaults in test (loopback host, stdio, no Supabase needed)', () => {
    const env = parseEnv({ NODE_ENV: 'test' });

    expect(env.transport).toBe('stdio');
    expect(env.host).toBe('127.0.0.1');
    expect(env.port).toBe(3000);
    expect(env.supabaseUrl).toBeUndefined();
  });

  it.each(['development', 'production'])(
    'requires Supabase variables when NODE_ENV=%s',
    (nodeEnv) => {
      expect(() => parseEnv({ NODE_ENV: nodeEnv })).toThrow(/SUPABASE_URL/);
    },
  );

  it('treats an empty SUPABASE_URL (copied from .env.example) as missing', () => {
    expect(() =>
      parseEnv({ NODE_ENV: 'production', ...SUPABASE, SUPABASE_URL: '' }),
    ).toThrow(/SUPABASE_URL" is required/);
  });

  it('rejects a Supabase URL that is not http(s)', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        ...SUPABASE,
        SUPABASE_URL: 'ftp://x.y',
      }),
    ).toThrow(/SUPABASE_URL/);
  });

  describe('http transport', () => {
    const httpBase = { NODE_ENV: 'test', MCP_TRANSPORT: 'http' };

    it('requires the auth token', () => {
      expect(() => parseEnv(httpBase)).toThrow(/MCP_AUTH_TOKEN/);
    });

    it('treats an empty token as missing', () => {
      expect(() => parseEnv({ ...httpBase, MCP_AUTH_TOKEN: '' })).toThrow(
        /MCP_AUTH_TOKEN" is required/,
      );
    });

    it('rejects a short token without echoing its value', () => {
      const shortToken = 'short-secret-token';
      const attempt = (): unknown =>
        parseEnv({ ...httpBase, MCP_AUTH_TOKEN: shortToken });

      expect(attempt).toThrow(/MCP_AUTH_TOKEN/);
      expect(attempt).not.toThrow(shortToken);
    });

    it('exposes a string token when valid', () => {
      const env = parseEnv({ ...httpBase, MCP_AUTH_TOKEN: VALID_TOKEN });

      expect(env.transport).toBe('http');
      expect(env.authToken).toBe(VALID_TOKEN);
    });

    it('does not require the token on stdio', () => {
      expect(() => parseEnv({ NODE_ENV: 'test' })).not.toThrow();
    });
  });

  describe('host', () => {
    it.each(['127.0.0.1', '0.0.0.0', '100.101.102.103', '::1', 'localhost'])(
      'accepts %s',
      (host) => {
        expect(parseEnv({ NODE_ENV: 'test', MCP_HOST: host }).host).toBe(host);
      },
    );

    it.each(['', 'not a host', 'http://127.0.0.1', '999.999.999.999'])(
      'rejects %j',
      (host) => {
        expect(() => parseEnv({ NODE_ENV: 'test', MCP_HOST: host })).toThrow(
          /MCP_HOST/,
        );
      },
    );
  });

  it('never echoes the service key in an error message', () => {
    const secretKey = 'super-secret-service-key';
    const attempt = (): unknown =>
      parseEnv({
        NODE_ENV: 'production',
        SUPABASE_SERVICE_KEY: secretKey,
        SUPABASE_URL: 'not-a-uri',
      });

    expect(attempt).toThrow(/SUPABASE_URL/);
    expect(attempt).not.toThrow(secretKey);
  });

  it('reports every invalid variable at once', () => {
    expect(() =>
      parseEnv({ NODE_ENV: 'test', PORT: '70000', MCP_TRANSPORT: 'smoke' }),
    ).toThrow(/PORT.*MCP_TRANSPORT|MCP_TRANSPORT.*PORT/s);
  });
});
