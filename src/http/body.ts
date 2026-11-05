import type { IncomingMessage } from 'node:http';
import { parseError, payloadTooLarge } from './errors.js';

const totalBytes = (chunks: readonly Buffer[]): number =>
  chunks.reduce((sum, chunk) => sum + chunk.length, 0);

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw parseError();
  }
}

/**
 * Lee el cuerpo completo con un tope de tamaño y lo parsea como JSON.
 * Un cuerpo inválido o vacío es un 400, no una excepción sin atrapar.
 */
export async function readJsonBody(
  req: IncomingMessage,
  maxBytes: number,
): Promise<unknown> {
  const declaredLength = Number(req.headers['content-length']);
  if (declaredLength > maxBytes) {
    throw payloadTooLarge();
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
    if (totalBytes(chunks) > maxBytes) {
      throw payloadTooLarge();
    }
  }

  return parseJson(Buffer.concat(chunks).toString('utf8'));
}
