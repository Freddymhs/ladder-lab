import { HTTP_STATUS, JSON_RPC_CODE } from './constants.js';

/**
 * Error esperado del borde HTTP: lleva el estado y el código JSON-RPC con
 * que se responde. Cualquier otro error es un fallo interno (500).
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly rpcCode: number,
    message: string,
    readonly headers: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const unauthorized = (): HttpError =>
  new HttpError(
    HTTP_STATUS.UNAUTHORIZED,
    JSON_RPC_CODE.SERVER_ERROR,
    'Unauthorized',
    { 'WWW-Authenticate': 'Bearer' },
  );

export const notFound = (): HttpError =>
  new HttpError(HTTP_STATUS.NOT_FOUND, JSON_RPC_CODE.SERVER_ERROR, 'Not found');

export const methodNotAllowed = (allow: string): HttpError =>
  new HttpError(
    HTTP_STATUS.METHOD_NOT_ALLOWED,
    JSON_RPC_CODE.SERVER_ERROR,
    'Method not allowed',
    { Allow: allow },
  );

export const parseError = (): HttpError =>
  new HttpError(
    HTTP_STATUS.BAD_REQUEST,
    JSON_RPC_CODE.PARSE_ERROR,
    'Parse error: invalid JSON',
  );

export const badRequest = (message: string): HttpError =>
  new HttpError(
    HTTP_STATUS.BAD_REQUEST,
    JSON_RPC_CODE.INVALID_REQUEST,
    message,
  );

export const payloadTooLarge = (): HttpError =>
  new HttpError(
    HTTP_STATUS.PAYLOAD_TOO_LARGE,
    JSON_RPC_CODE.INVALID_REQUEST,
    'Payload too large',
    { Connection: 'close' },
  );
