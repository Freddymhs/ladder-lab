// Segunda línea de defensa: el código no debe loguear secretos, y si alguien
// pasa por error el objeto de entorno o las cabeceras, pino los censura.
export const LOGGER_REDACT = {
  paths: [
    'authToken',
    'supabaseServiceKey',
    '*.authToken',
    '*.supabaseServiceKey',
    'headers.authorization',
    '*.headers.authorization',
  ],
  censor: '[REDACTED]',
} as const;
