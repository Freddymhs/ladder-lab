import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readRoot = (file: string): string =>
  readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

const REQUIRED_DOCKERIGNORE_ENTRIES = [
  '.env',
  '.env.*',
  '.venv/',
  '__pycache__/',
  '.git/',
  'node_modules',
];

describe('.dockerignore', () => {
  const entries = readRoot('.dockerignore')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

  it.each(REQUIRED_DOCKERIGNORE_ENTRIES)('excludes %s', (entry) => {
    expect(entries).toContain(entry);
  });
});

describe('Dockerfile', () => {
  const lines = readRoot('Dockerfile')
    .split('\n')
    .map((line) => line.trim());
  const finalStage = lines.slice(
    lines.map((line) => line.startsWith('FROM ')).lastIndexOf(true),
  );
  const indexOf = (prefix: string): number =>
    finalStage.findIndex((line) => line.startsWith(prefix));

  it('runs the final stage as a non-root user, before CMD', () => {
    const userLines = finalStage.filter((line) => line.startsWith('USER '));
    const lastUser = userLines.at(-1)?.replace('USER ', '');

    expect(lastUser).toBeDefined();
    expect(['root', '0']).not.toContain(lastUser);
    expect(finalStage.lastIndexOf(`USER ${lastUser}`)).toBeLessThan(
      indexOf('CMD ['),
    );
  });

  it('defines a healthcheck against /healthz', () => {
    expect(finalStage.some((line) => line.includes('/healthz'))).toBe(true);
    expect(indexOf('HEALTHCHECK')).toBeGreaterThanOrEqual(0);
  });

  it('does not use a floating pnpm version', () => {
    expect(lines.join('\n')).not.toMatch(/pnpm@latest/);
  });

  it('does not bake secrets into the image', () => {
    const text = lines.join('\n');
    expect(text).not.toMatch(
      /MCP_AUTH_TOKEN|SUPABASE_SERVICE_KEY|COPY .*\.env/,
    );
  });
});
