import { describe, expect, it } from 'vitest';
import {
  datosEstampaSchema,
  documentoEstampaSchema,
  documentoExportadoSchema,
  envoltorioExportSchema,
} from '../schema.js';
import { clonar, leerEjemplo } from './fixtures.js';

type Registro = Record<string, Record<string, unknown>>;

const sinCabecera = (documento: unknown): Registro => {
  const {
    formato: _formato,
    version: _version,
    ...datos
  } = documento as Registro;
  return datos as Registro;
};
const base = (): Registro => sinCabecera(leerEjemplo('estampa-fps.json'));

const conCambio = (bloque: string, campo: string, valor: unknown): Registro => {
  const datos = base();
  return { ...datos, [bloque]: { ...datos[bloque], [campo]: valor } };
};

describe('fixtures publicados', () => {
  it.each(['estampa-fps.json', 'estampa-rts-no-aplica.json'])(
    '%s es un documento válido',
    (nombre) => {
      expect(
        documentoEstampaSchema.safeParse(leerEjemplo(nombre)).success,
      ).toBe(true);
    },
  );

  it.each(['export-vigentes.json', 'export-con-versiones.json'])(
    '%s es un envoltorio válido',
    (nombre) => {
      const resultado = envoltorioExportSchema.safeParse(leerEjemplo(nombre));
      expect(resultado.success).toBe(true);
    },
  );
});

describe('datosEstampaSchema — obligatorios', () => {
  it('acepta el ejemplo base', () => {
    expect(datosEstampaSchema.safeParse(base()).success).toBe(true);
  });

  const OBLIGATORIOS: ReadonlyArray<[string, string]> = [
    ['juego', 'nombre'],
    ['juego', 'genero'],
    ['sistema', 'mouse'],
    ['sistema', 'dpi'],
    ['sistema', 'polling'],
    ['sistema', 'resolucion'],
    ['sistema', 'hz'],
    ['sistema', 'posicionWindows'],
    ['sistema', 'aceleracionWindows'],
    ['enJuego', 'sensibilidad'],
    ['enJuego', 'rawInput'],
    ['resultado', 'rango'],
    ['resultado', 'certeza'],
  ];

  it.each(OBLIGATORIOS)('rechaza si falta %s.%s', (bloque, campo) => {
    const datos = clonar(base());
    delete datos[bloque]?.[campo];
    expect(datosEstampaSchema.safeParse(datos).success).toBe(false);
  });

  it('exige etapa o fecha: sin ninguna de las dos falla', () => {
    const datos = clonar(base());
    delete datos.juego?.fecha;
    const resultado = datosEstampaSchema.safeParse(datos);
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain(
      'etapa o la fecha',
    );
  });

  it('acepta solo etapa, sin fecha', () => {
    const datos = clonar(base());
    delete datos.juego?.fecha;
    datos.juego = { ...datos.juego, etapa: 'Temporada 1' };
    expect(datosEstampaSchema.safeParse(datos).success).toBe(true);
  });
});

describe('datosEstampaSchema — desconocido', () => {
  const ACEPTAN_DESCONOCIDO: ReadonlyArray<[string, string]> = [
    ['sistema', 'dpi'],
    ['sistema', 'polling'],
    ['sistema', 'resolucion'],
    ['sistema', 'hz'],
    ['sistema', 'posicionWindows'],
    ['sistema', 'aceleracionWindows'],
    ['enJuego', 'sensibilidad'],
    ['enJuego', 'rawInput'],
    ['juego', 'fecha'],
  ];

  it.each(ACEPTAN_DESCONOCIDO)(
    '%s.%s acepta "desconocido"',
    (bloque, campo) => {
      expect(
        datosEstampaSchema.safeParse(conCambio(bloque, campo, 'desconocido'))
          .success,
      ).toBe(true);
    },
  );

  const NO_ACEPTAN_DESCONOCIDO: ReadonlyArray<[string, string]> = [
    ['juego', 'genero'],
    ['resultado', 'certeza'],
  ];

  it.each(NO_ACEPTAN_DESCONOCIDO)(
    '%s.%s rechaza "desconocido"',
    (bloque, campo) => {
      expect(
        datosEstampaSchema.safeParse(conCambio(bloque, campo, 'desconocido'))
          .success,
      ).toBe(false);
    },
  );

  it('el género solo admite FPS o RTS', () => {
    for (const genero of ['MOBA', 'fps', '']) {
      expect(
        datosEstampaSchema.safeParse(conCambio('juego', 'genero', genero))
          .success,
      ).toBe(false);
    }
    expect(
      datosEstampaSchema.safeParse(conCambio('juego', 'genero', 'RTS')).success,
    ).toBe(true);
  });

  it('juego.nombre no puede estar vacío', () => {
    expect(
      datosEstampaSchema.safeParse(conCambio('juego', 'nombre', '')).success,
    ).toBe(false);
  });
});

describe('datosEstampaSchema — no_aplica', () => {
  it.each([
    ['enJuego', 'sensibilidad'],
    ['enJuego', 'rawInput'],
  ])('%s.%s acepta "no_aplica"', (bloque, campo) => {
    expect(
      datosEstampaSchema.safeParse(conCambio(bloque, campo, 'no_aplica'))
        .success,
    ).toBe(true);
  });

  it.each([
    ['sistema', 'dpi'],
    ['sistema', 'polling'],
    ['sistema', 'resolucion'],
    ['sistema', 'hz'],
    ['sistema', 'posicionWindows'],
    ['sistema', 'aceleracionWindows'],
    ['juego', 'fecha'],
    ['resultado', 'certeza'],
  ])('%s.%s rechaza "no_aplica"', (bloque, campo) => {
    expect(
      datosEstampaSchema.safeParse(conCambio(bloque, campo, 'no_aplica'))
        .success,
    ).toBe(false);
  });
});

describe('datosEstampaSchema — tipos y rangos', () => {
  it.each<[string, string, unknown]>([
    ['sistema', 'dpi', 0],
    ['sistema', 'dpi', -400],
    ['sistema', 'dpi', 450.5],
    ['sistema', 'dpi', '450'],
    ['sistema', 'posicionWindows', 0],
    ['sistema', 'posicionWindows', 12],
    ['sistema', 'resolucion', '1920*1080'],
    ['sistema', 'resolucion', '1920x'],
    ['sistema', 'aceleracionWindows', 'on'],
    ['enJuego', 'sensibilidad', 0],
    ['enJuego', 'sensibilidad', null],
    ['enJuego', 'rawInput', 'on'],
    ['juego', 'fecha', '2025-02-30'],
    ['juego', 'fecha', '01/06/2025'],
    ['resultado', 'certeza', 'seguro'],
    ['resultado', 'matchPerfecto', 'si'],
  ])('rechaza %s.%s = %j', (bloque, campo, valor) => {
    expect(
      datosEstampaSchema.safeParse(conCambio(bloque, campo, valor)).success,
    ).toBe(false);
  });

  it('acepta los extremos válidos de posicionWindows', () => {
    for (const posicion of [1, 11]) {
      expect(
        datosEstampaSchema.safeParse(
          conCambio('sistema', 'posicionWindows', posicion),
        ).success,
      ).toBe(true);
    }
  });

  it('rechaza claves desconocidas: juegoDelLogro ya no existe', () => {
    const datos = conCambio('resultado', 'juegoDelLogro', 'x');
    expect(datosEstampaSchema.safeParse(datos).success).toBe(false);
  });

  it('rechaza mouse como objeto marca/modelo (es un solo texto)', () => {
    const datos = conCambio('sistema', 'mouse', { marca: 'A', modelo: 'B' });
    expect(datosEstampaSchema.safeParse(datos).success).toBe(false);
  });

  it('rechaza null en cualquier campo', () => {
    expect(
      datosEstampaSchema.safeParse(conCambio('enJuego', 'sensibilidad', null))
        .success,
    ).toBe(false);
  });
});

describe('derivadaDe', () => {
  it('es opcional y debe ser un uuid', () => {
    expect(datosEstampaSchema.safeParse(base()).success).toBe(true);
    expect(
      datosEstampaSchema.safeParse({ ...base(), derivadaDe: 'no-es-uuid' })
        .success,
    ).toBe(false);
    expect(
      datosEstampaSchema.safeParse({
        ...base(),
        derivadaDe: '7d1c2f4e-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true);
  });
});

describe('documentos de entrada y exportados', () => {
  it('el documento de entrada no acepta id', () => {
    const documento = {
      ...(leerEjemplo('estampa-fps.json') as object),
      id: '7d1c2f4e-0000-4000-8000-000000000001',
    };
    expect(documentoEstampaSchema.safeParse(documento).success).toBe(false);
  });

  it('el documento exportado exige id', () => {
    const sinId = leerEjemplo('estampa-fps.json');
    expect(documentoExportadoSchema.safeParse(sinId).success).toBe(false);
  });

  it('rechaza una versión de formato desconocida', () => {
    const documento = {
      ...(leerEjemplo('estampa-fps.json') as object),
      version: 2,
    };
    expect(documentoEstampaSchema.safeParse(documento).success).toBe(false);
  });

  it('archivada solo puede ser true', () => {
    const exportado = clonar(leerEjemplo('export-vigentes.json')) as {
      estampas: Array<Record<string, unknown>>;
    };
    exportado.estampas[0] = { ...exportado.estampas[0], archivada: false };
    expect(envoltorioExportSchema.safeParse(exportado).success).toBe(false);
  });
});
