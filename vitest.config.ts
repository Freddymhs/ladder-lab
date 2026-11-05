import { defineConfig } from 'vitest/config';
import path from 'path';

const MODO_INTEGRACION = 'integration';

export default defineConfig(({ mode }) => {
  const esIntegracion = mode === MODO_INTEGRACION;

  return {
    resolve: {
      alias: {
        '@config': path.resolve(__dirname, 'src/config'),
        '@common': path.resolve(__dirname, 'src/common'),
        '@tools': path.resolve(__dirname, 'src/tools'),
        '@resources': path.resolve(__dirname, 'src/resources'),
        '@prompts': path.resolve(__dirname, 'src/prompts'),
        '@http': path.resolve(__dirname, 'src/http'),
        '@domain': path.resolve(__dirname, 'src/domain'),
        '@data': path.resolve(__dirname, 'src/data'),
      },
    },
    test: {
      environment: 'node',
      globals: true,
      // `pnpm test` no toca ninguna base; `pnpm test:integration` solo corre *.int.spec.ts.
      include: esIntegracion ? ['src/**/*.int.spec.ts'] : ['src/**/*.spec.ts'],
      exclude: esIntegracion ? [] : ['src/**/*.int.spec.ts', 'node_modules/**'],
      testTimeout: esIntegracion ? 30_000 : 5_000,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.spec.ts', 'src/**/__tests__/**'],
      },
    },
  };
});
