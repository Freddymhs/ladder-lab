import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { LOGGER_REDACT } from '../redact.js';

const captureLogger = (): { logger: pino.Logger; lines: string[] } => {
  const lines: string[] = [];
  const logger = pino(
    {
      redact: { paths: [...LOGGER_REDACT.paths], censor: LOGGER_REDACT.censor },
    },
    { write: (chunk: string) => void lines.push(chunk) },
  );
  return { logger, lines };
};

describe('logger redaction', () => {
  it('censors secrets when someone logs the env or request headers by mistake', () => {
    const { logger, lines } = captureLogger();

    logger.info({ authToken: 'TOKEN-1', supabaseServiceKey: 'KEY-1' }, 'env');
    logger.info({ env: { authToken: 'TOKEN-2' } }, 'nested env');
    logger.info({ headers: { authorization: 'Bearer TOKEN-3' } }, 'headers');
    logger.info(
      { req: { headers: { authorization: 'Bearer TOKEN-4' } } },
      'req',
    );

    const output = lines.join('');
    expect(lines).toHaveLength(4);
    expect(output).not.toMatch(/TOKEN-\d|KEY-1/);
    expect(output).toContain(LOGGER_REDACT.censor);
  });
});
