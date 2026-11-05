import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

const PREFIJO_SUPABASE_JS = /^\/rest\/v1/;
const CABECERAS_SOLO_DE_SALTO = [
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
];
const CABECERAS_DE_RESPUESTA_A_QUITAR = [
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
];

export const VARIABLE_REST_URL = 'TEST_REST_URL';
export const VARIABLE_REST_JWT_SECRET = 'TEST_REST_JWT_SECRET';
export const VARIABLE_REST_DB_URL = 'TEST_REST_DB_URL';

const base64url = (valor: object): string =>
  Buffer.from(JSON.stringify(valor)).toString('base64url');

/** JWT HS256 firmado con el secreto DESECHABLE de la prueba. */
export function firmarJwt(secreto: string, rol: string): string {
  const cabecera = base64url({ alg: 'HS256', typ: 'JWT' });
  const carga = base64url({ role: rol });
  const firma = createHmac('sha256', secreto)
    .update(`${cabecera}.${carga}`)
    .digest('base64url');
  return `${cabecera}.${carga}.${firma}`;
}

export interface Proxy {
  readonly url: string;
  readonly cerrar: () => Promise<void>;
}

/**
 * supabase-js habla con `<url>/rest/v1/...`; PostgREST suelto sirve en la raíz.
 * Este proxy quita el prefijo para poder probar el cliente real sin Supabase.
 */
export async function iniciarProxy(destino: string): Promise<Proxy> {
  const servidor = createServer((req, res) => {
    const trozos: Buffer[] = [];
    req.on('data', (trozo: Buffer) => trozos.push(trozo));
    req.on('end', () => {
      const cabeceras = new Headers();
      for (const [nombre, valor] of Object.entries(req.headers)) {
        if (valor !== undefined && !CABECERAS_SOLO_DE_SALTO.includes(nombre)) {
          cabeceras.set(
            nombre,
            Array.isArray(valor) ? valor.join(', ') : valor,
          );
        }
      }
      const cuerpo = Buffer.concat(trozos);
      const sinCuerpo = req.method === 'GET' || req.method === 'HEAD';
      fetch(`${destino}${(req.url ?? '/').replace(PREFIJO_SUPABASE_JS, '')}`, {
        method: req.method,
        headers: cabeceras,
        body: sinCuerpo ? undefined : cuerpo,
      })
        .then(async (respuesta) => {
          const salida = new Map<string, string>();
          respuesta.headers.forEach((valor, nombre) => {
            if (!CABECERAS_DE_RESPUESTA_A_QUITAR.includes(nombre))
              salida.set(nombre, valor);
          });
          res.writeHead(respuesta.status, Object.fromEntries(salida));
          res.end(Buffer.from(await respuesta.arrayBuffer()));
        })
        .catch((error: unknown) => {
          res.writeHead(502).end(String(error));
        });
    });
  });

  await new Promise<void>((resolver) =>
    servidor.listen(0, '127.0.0.1', resolver),
  );
  const { port } = servidor.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    cerrar: () =>
      new Promise<void>((resolver) => {
        servidor.closeAllConnections();
        servidor.close(() => resolver());
      }),
  };
}
