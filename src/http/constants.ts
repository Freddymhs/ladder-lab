export const MCP_PATH = '/mcp';
export const HEALTH_PATH = '/healthz';

export const MAX_BODY_BYTES = 1024 * 1024;

// Base solo para poder parsear `req.url` (que llega como ruta relativa).
export const URL_PARSE_BASE = 'http://localhost';

export const BEARER_PATTERN = /^Bearer +(\S+)$/i;

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const JSON_RPC_CODE = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000,
} as const;

export const CONTENT_TYPE_JSON = 'application/json';
