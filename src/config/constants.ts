export const SERVER_NAME = 'ladder-lab';
export const SERVER_VERSION = '0.1.0';

export const ENV_KEYS = {
  NODE_ENV: 'NODE_ENV',
  MCP_TRANSPORT: 'MCP_TRANSPORT',
  MCP_HOST: 'MCP_HOST',
  MCP_AUTH_TOKEN: 'MCP_AUTH_TOKEN',
  PORT: 'PORT',
  LOG_LEVEL: 'LOG_LEVEL',
  SUPABASE_URL: 'SUPABASE_URL',
  SUPABASE_SERVICE_KEY: 'SUPABASE_SERVICE_KEY',
} as const;

export type EnvKey = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];

export const TRANSPORT_STDIO = 'stdio' as const;
export const TRANSPORT_HTTP = 'http' as const;

export const NODE_ENV_DEVELOPMENT = 'development' as const;
export const NODE_ENV_PRODUCTION = 'production' as const;
export const NODE_ENV_TEST = 'test' as const;
export const NODE_ENVS = [
  NODE_ENV_DEVELOPMENT,
  NODE_ENV_PRODUCTION,
  NODE_ENV_TEST,
] as const;

export const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
] as const;
export const DEFAULT_LOG_LEVEL = 'info' as const;

export const DEFAULT_PORT = 3000;
// Loopback por defecto: exponer el servidor en otra interfaz (p. ej. la de
// Tailscale) es una decisión explícita de despliegue, nunca el default.
export const DEFAULT_HOST = '127.0.0.1';

// 32 caracteres: un token generado con `openssl rand -hex 16` o más.
export const MIN_AUTH_TOKEN_LENGTH = 32;
