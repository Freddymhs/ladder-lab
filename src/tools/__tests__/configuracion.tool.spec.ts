import { beforeEach, describe, expect, it } from 'vitest';
import type { DatosEstampa } from '@domain/estampa/index.js';
import { clonar } from '../../domain/estampa/__tests__/fixtures.js';
import {
  crearHarness,
  datosCompletos as datosCompletosDelHarness,
  jsonDe,
  textoDe,
} from './harness.js';
import type { Harness } from './harness.js';

type Vista = {
  id: string;
  numeroVersion: number;
  totalVersiones: number;
  estampa: DatosEstampa;
};
type Envoltorio = { estampas: Array<Record<string, unknown>> };

let h: Harness;
beforeEach(async () => {
  h = await crearHarness();
});

const datosCompletos = (): DatosEstampa => datosCompletosDelHarness();

const llamar = (name: string, args: Record<string, unknown>) =>
  h.client.callTool({ name, arguments: args as never });

const crearCompleta = async (): Promise<Vista> =>
  jsonDe<Vista>(await llamar('crear_estampa', datosCompletos() as never));

describe('configuración completa por las herramientas', () => {
  it('crear_estampa declara los campos nuevos y avisa que no se guarden credenciales', async () => {
    const { tools } = await h.client.listTools();
    const crear = tools.find((t) => t.name === 'crear_estampa');
    const esquema = JSON.stringify(crear?.inputSchema);

    for (const campo of [
      'pantalla',
      'nightLight',
      'entrada',
      'general',
      'topeFps',
      'ejecutable',
      'archivosConfig',
    ]) {
      expect(esquema).toContain(`"${campo}"`);
    }
    expect(crear?.description).toContain('contraseñas');
  });

  it('crear y ver devuelven lo mismo, con el archivo de configuración idéntico', async () => {
    const creada = await crearCompleta();

    const vista = jsonDe<Vista>(await llamar('ver_estampa', { id: creada.id }));

    expect(vista.estampa).toEqual(datosCompletos());
    expect(vista.estampa.enJuego.archivosConfig?.[0]?.contenido).toBe(
      'sensitivity "1.8"\nm_rawinput "1"\n',
    );
  });

  it('corregir un campo de un bloque no borra a sus hermanos y conserva la versión 1', async () => {
    const { id } = await crearCompleta();

    const nueva = jsonDe<Vista>(
      await llamar('corregir_estampa', {
        id,
        cambios: { sistema: { pantalla: { hdr: 'apagado' } } },
      }),
    );

    expect(nueva.numeroVersion).toBe(2);
    expect(nueva.estampa.sistema.pantalla).toMatchObject({
      hdr: 'apagado',
      escalaPct: 100,
      vrr: 'encendido',
    });
    const historial = jsonDe<{
      versiones: Array<{
        cambios?: Array<{ campo: string; antes: unknown; despues: unknown }>;
      }>;
    }>(await llamar('historial_versiones', { id }));
    expect(historial.versiones[1]?.cambios).toEqual([
      { campo: 'sistema.pantalla.hdr', antes: 'encendido', despues: 'apagado' },
    ]);
  });

  it('corregir una lista exige la lista completa: un archivo sin contenido se rechaza', async () => {
    const { id } = await crearCompleta();

    const respuesta = await llamar('corregir_estampa', {
      id,
      cambios: { enJuego: { archivosConfig: [{ ruta: 'C:\\x.cfg' }] } },
    });

    expect(respuesta.isError).toBe(true);
    const vista = jsonDe<Vista>(await llamar('ver_estampa', { id }));
    expect(vista.numeroVersion).toBe(1);
  });

  it('un valor fuera de rango se rechaza y no escribe nada', async () => {
    const datos = clonar(datosCompletos());
    const respuesta = await llamar('crear_estampa', {
      ...datos,
      sistema: {
        ...datos.sistema,
        entrada: { tecladoRetardo: 9 },
      },
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).not.toBe('');
    const exportada = jsonDe<Envoltorio>(await llamar('exportar', {}));
    expect(exportada.estampas).toHaveLength(0);
  });

  it('exportar e importar en una base vacía conserva todos los campos nuevos', async () => {
    await crearCompleta();
    const envoltorio = jsonDe<Envoltorio>(await llamar('exportar', {}));
    const otro = await crearHarness();

    const simulada = jsonDe<{ aplicada: boolean }>(
      await otro.client.callTool({
        name: 'importar_json',
        arguments: { envoltorio } as never,
      }),
    );
    await otro.client.callTool({
      name: 'importar_json',
      arguments: { envoltorio, dryRun: false } as never,
    });
    const reexportada = jsonDe<Envoltorio>(
      await otro.client.callTool({ name: 'exportar', arguments: {} }),
    );

    expect(simulada.aplicada).toBe(false);
    expect(reexportada).toEqual(envoltorio);
    expect(envoltorio.estampas).toHaveLength(1);
  });
});
