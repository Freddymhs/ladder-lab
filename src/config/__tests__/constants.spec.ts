import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SERVER_NAME, SERVER_VERSION } from '../constants.js';

const readPackageJson = (): { name: string; version: string } =>
  JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
  ) as { name: string; version: string };

describe('server identity', () => {
  it('SERVER_NAME matches package.json name', () => {
    expect(SERVER_NAME).toBe(readPackageJson().name);
  });

  it('SERVER_VERSION matches package.json version', () => {
    expect(SERVER_VERSION).toBe(readPackageJson().version);
  });

  it('does not keep the template name anywhere in the identity', () => {
    expect(SERVER_NAME).not.toContain('template');
  });
});
