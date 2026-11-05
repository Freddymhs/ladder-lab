import { describe, expect, it } from 'vitest';
import { aplanar, cambiosEntre, compararEstampas, esSinDato } from '../diff.js';
import { datosEstampaSchema } from '../schema.js';
import type { DatosEstampa } from '../schema.js';
import { clonar, leerEjemplo } from './fixtures.js';

const base = (): DatosEstampa => {
  const {
    formato: _f,
    version: _v,
    ...datos
  } = clonar(leerEjemplo('estampa-fps.json')) as Record<string, unknown>;
  return datosEstampaSchema.parse(datos);
};
const conDpi = (dpi: DatosEstampa['sistema']['dpi']): DatosEstampa => {
  const datos = base();
  return { ...datos, sistema: { ...datos.sistema, dpi } };
};

describe('esSinDato', () => {
  it.each([undefined, 'desconocido', 'no_aplica'])(
    '%j es "sin dato"',
    (valor) => {
      expect(esSinDato(valor)).toBe(true);
    },
  );
  it.each([0, 450, false, '', 'Global', null])(
    '%j es un dato real',
    (valor) => {
      expect(esSinDato(valor)).toBe(false);
    },
  );
});

describe('aplanar', () => {
  it('convierte objetos anidados en rutas con puntos', () => {
    expect(aplanar({ a: { b: 1, c: { d: 2 } }, e: 'x' })).toEqual({
      'a.b': 1,
      'a.c.d': 2,
      e: 'x',
    });
  });
});

describe('cambiosEntre (historial)', () => {
  it('sin cambios, no hay cambios', () => {
    expect(cambiosEntre(base(), base())).toEqual([]);
  });

  it('muestra qué campo cambió, de qué a qué', () => {
    expect(cambiosEntre(conDpi(400), conDpi(450))).toEqual([
      { campo: 'sistema.dpi', antes: 400, despues: 450 },
    ]);
  });

  it('pasar de desconocido a un valor SÍ es un cambio (es lo que se quiere ver)', () => {
    expect(cambiosEntre(conDpi('desconocido'), conDpi(450))).toEqual([
      { campo: 'sistema.dpi', antes: 'desconocido', despues: 450 },
    ]);
  });

  it('un opcional agregado aparece con antes undefined', () => {
    const despues = { ...base(), notas: 'nueva' };

    expect(cambiosEntre(base(), despues)).toEqual([
      { campo: 'notas', antes: undefined, despues: 'nueva' },
    ]);
  });

  it('varios cambios salen ordenados por campo', () => {
    const despues = {
      ...conDpi(800),
      resultado: { ...base().resultado, rango: 'Águila' },
    };

    expect(cambiosEntre(base(), despues).map((c) => c.campo)).toEqual([
      'resultado.rango',
      'sistema.dpi',
    ]);
  });
});

describe('compararEstampas', () => {
  const A = '7d1c2f4e-0000-4000-8000-00000000000a';
  const B = '7d1c2f4e-0000-4000-8000-00000000000b';
  const C = '7d1c2f4e-0000-4000-8000-00000000000c';

  it('dos estampas iguales: ni diferencias ni incompletos', () => {
    expect(
      compararEstampas([
        { id: A, datos: base() },
        { id: B, datos: base() },
      ]),
    ).toEqual({
      diferencias: [],
      incompletos: [],
    });
  });

  it('dos datos reales distintos son una diferencia, con el valor de cada una', () => {
    const resultado = compararEstampas([
      { id: A, datos: conDpi(400) },
      { id: B, datos: conDpi(800) },
    ]);

    expect(resultado.diferencias).toEqual([
      { campo: 'sistema.dpi', valores: { [A]: 400, [B]: 800 } },
    ]);
    expect(resultado.incompletos).toEqual([]);
  });

  it('un dato real contra "desconocido" NO es una diferencia: es un campo incompleto', () => {
    const resultado = compararEstampas([
      { id: A, datos: conDpi(400) },
      { id: B, datos: conDpi('desconocido') },
    ]);

    expect(resultado.diferencias).toEqual([]);
    expect(resultado.incompletos).toEqual([
      { campo: 'sistema.dpi', sinDato: [B] },
    ]);
  });

  it('no_aplica contra un valor tampoco es una diferencia', () => {
    const rts = base();
    const resultado = compararEstampas([
      {
        id: A,
        datos: { ...rts, enJuego: { ...rts.enJuego, sensibilidad: 1.5 } },
      },
      {
        id: B,
        datos: {
          ...rts,
          enJuego: { ...rts.enJuego, sensibilidad: 'no_aplica' },
        },
      },
    ]);

    expect(resultado.diferencias.map((d) => d.campo)).not.toContain(
      'enJuego.sensibilidad',
    );
    expect(resultado.incompletos).toEqual([
      { campo: 'enJuego.sensibilidad', sinDato: [B] },
    ]);
  });

  it('dos "desconocido" no son diferencia ni incompleto (no hay ningún dato)', () => {
    const resultado = compararEstampas([
      { id: A, datos: conDpi('desconocido') },
      { id: B, datos: conDpi('desconocido') },
    ]);

    expect(resultado).toEqual({ diferencias: [], incompletos: [] });
  });

  it('un campo opcional que solo una estampa registró es incompleto', () => {
    const resultado = compararEstampas([
      { id: A, datos: { ...base(), notas: 'x' } },
      { id: B, datos: base() },
    ]);

    expect(resultado.incompletos).toEqual([{ campo: 'notas', sinDato: [B] }]);
  });

  it('con tres: dos iguales y una distinta es diferencia, y el sin dato aparece como null', () => {
    const resultado = compararEstampas([
      { id: A, datos: conDpi(400) },
      { id: B, datos: conDpi(400) },
      { id: C, datos: conDpi(800) },
    ]);

    expect(resultado.diferencias).toEqual([
      { campo: 'sistema.dpi', valores: { [A]: 400, [B]: 400, [C]: 800 } },
    ]);
  });

  it('no emite ningún juicio: no hay campo de "mejor" en el resultado', () => {
    const resultado = compararEstampas([
      { id: A, datos: conDpi(400) },
      { id: B, datos: conDpi(800) },
    ]);

    expect(Object.keys(resultado).sort()).toEqual([
      'diferencias',
      'incompletos',
    ]);
  });

  it('las diferencias salen ordenadas por campo (resultado estable)', () => {
    const otra = {
      ...conDpi(800),
      resultado: { ...base().resultado, rango: 'Águila' },
    };

    const campos = compararEstampas([
      { id: A, datos: base() },
      { id: B, datos: otra },
    ]).diferencias.map((d) => d.campo);

    expect(campos).toEqual([...campos].sort());
  });
});
