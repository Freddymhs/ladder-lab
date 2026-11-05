import { createHash, timingSafeEqual } from 'node:crypto';
import { BEARER_PATTERN } from './constants.js';

const sha256 = (value: string): Buffer =>
  createHash('sha256').update(value).digest();

export function extractBearerToken(
  authorizationHeader: string | undefined,
): string | undefined {
  if (authorizationHeader === undefined) {
    return undefined;
  }
  return BEARER_PATTERN.exec(authorizationHeader)?.[1];
}

/**
 * Compara en tiempo constante. Se comparan los digests SHA-256 (siempre de
 * 32 bytes) para que la longitud del token no se filtre por el tiempo de
 * respuesta y `timingSafeEqual` nunca reciba buffers de largo distinto.
 */
export function isAuthorized(
  authorizationHeader: string | undefined,
  expectedToken: string,
): boolean {
  const providedToken = extractBearerToken(authorizationHeader);
  if (providedToken === undefined) {
    return false;
  }
  return timingSafeEqual(sha256(providedToken), sha256(expectedToken));
}
