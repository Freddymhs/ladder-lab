import { readFileSync } from 'node:fs';

const EJEMPLOS = new URL('../../../../docs/formato/ejemplos/', import.meta.url);

/** Lee un fixture publicado del formato (SSOT: docs/formato/ejemplos). */
export const leerEjemplo = (nombre: string): unknown =>
  JSON.parse(readFileSync(new URL(nombre, EJEMPLOS), 'utf8'));

export const clonar = <T>(valor: T): T => structuredClone(valor);
