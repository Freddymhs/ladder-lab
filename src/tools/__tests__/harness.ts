import pino from 'pino';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { InMemoryEstampaRepository } from '@data/index.js';
import type { EstampaRepository } from '@data/index.js';
import { datosEstampaSchema } from '@domain/estampa/index.js';
import type { DatosEstampa } from '@domain/estampa/index.js';
import {
  clonar,
  leerEjemplo,
} from '../../domain/estampa/__tests__/fixtures.js';
import { createServer } from '../../server.js';

export interface Harness {
  readonly client: Client;
  readonly repository: EstampaRepository;
  readonly lineasDeLog: string[];
}

export async function crearHarness(
  repository: EstampaRepository = new InMemoryEstampaRepository(),
): Promise<Harness> {
  const lineasDeLog: string[] = [];
  const logger = pino(
    { level: 'debug' },
    { write: (c: string) => void lineasDeLog.push(c) },
  );
  const server = createServer({ repository, logger });

  const [transporteCliente, transporteServidor] =
    InMemoryTransport.createLinkedPair();
  await server.connect(transporteServidor);
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  await client.connect(transporteCliente);

  return { client, repository, lineasDeLog };
}

/** Datos válidos de una estampa de FPS (el fixture publicado, sin cabecera). */
export function datosValidos(): DatosEstampa {
  const {
    formato: _f,
    version: _v,
    ...datos
  } = clonar(leerEjemplo('estampa-fps.json')) as Record<string, unknown>;
  return datosEstampaSchema.parse(datos);
}

export function datosRts(): DatosEstampa {
  const {
    formato: _f,
    version: _v,
    derivadaDe: _d,
    ...datos
  } = clonar(leerEjemplo('estampa-rts-no-aplica.json')) as Record<
    string,
    unknown
  >;
  return datosEstampaSchema.parse(datos);
}

type Contenido = Array<{ type: string; text: string }>;

export const textoDe = (resultado: Record<string, unknown>): string =>
  (resultado.content as Contenido)[0]?.text ?? '';

export const jsonDe = <T = Record<string, unknown>>(
  resultado: Record<string, unknown>,
): T => JSON.parse(textoDe(resultado)) as T;

/** Estampa con todos los campos opcionales de configuración (fixture publicado, sin cabecera). */
export function datosCompletos(): DatosEstampa {
  const {
    formato: _f,
    version: _v,
    ...datos
  } = clonar(leerEjemplo('estampa-completa.json')) as Record<string, unknown>;
  return datosEstampaSchema.parse(datos);
}
