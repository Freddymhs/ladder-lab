import { describe, expect, it } from 'vitest';
import { ARCHIVO_CONFIG_BYTES_MAX, ARCHIVOS_CONFIG_MAX } from '../constants.js';
import { fusionar } from '../merge.js';
import { cambiosSchema, documentoEstampaSchema } from '../schema.js';
import { clonar, leerEjemplo } from './fixtures.js';

type Documento = Record<string, unknown>;

const BASE = 'estampa-completa.json';

/** Copia del fixture completo con un valor puesto en una ruta (`a.b.c`). */
const conValorEn = (ruta: string, valor: unknown): Documento => {
  const copia = clonar(leerEjemplo(BASE)) as Documento;
  const partes = ruta.split('.');
  const ultimo = partes.at(-1)!;
  const padre = partes
    .slice(0, -1)
    .reduce<Documento>((nodo, clave) => nodo[clave] as Documento, copia);
  padre[ultimo] = valor;
  return copia;
};

const acepta = (documento: unknown): boolean =>
  documentoEstampaSchema.safeParse(documento).success;

describe('configuración del sistema y del juego (campos opcionales de v1)', () => {
  it('el fixture completo y las estampas viejas (sin los bloques nuevos) son válidos', () => {
    expect(acepta(leerEjemplo(BASE))).toBe(true);
    expect(acepta(leerEjemplo('estampa-fps.json'))).toBe(true);
    expect(acepta(leerEjemplo('estampa-rts-no-aplica.json'))).toBe(true);
  });

  describe('valores válidos', () => {
    it.each([
      ['sistema.pantalla.escalaPct', 125],
      ['sistema.pantalla.escalaPct', 'desconocido'],
      ['sistema.pantalla.nightLight.intensidad', 0],
      ['sistema.pantalla.nightLight.intensidad', 100],
      ['sistema.entrada.tecladoRetardo', 0],
      ['sistema.entrada.tecladoRetardo', 3],
      ['sistema.entrada.tecladoVelocidad', 0],
      ['sistema.entrada.tecladoVelocidad', 31],
      ['sistema.general.uac', 'nunca'],
      ['sistema.general.exclusionesAntivirus', []],
      ['sistema.general.exclusionesAntivirus', 'desconocido'],
      ['enJuego.topeFps', 144],
      ['enJuego.topeFps', 'sin_tope'],
      ['enJuego.topeFps', 'desconocido'],
      ['enJuego.modoPantalla', 'completa_exclusiva'],
      ['enJuego.ejecutable.dpiOverride', 'sistema_mejorado'],
      ['enJuego.ejecutable.ejecutarComoAdmin', 'desconocido'],
    ])('%s acepta %j', (ruta, valor) => {
      expect(acepta(conValorEn(ruta, valor))).toBe(true);
    });
  });

  describe('valores rechazados', () => {
    it.each([
      ['sistema.pantalla.escalaPct', 0],
      ['sistema.pantalla.escalaPct', 1.5],
      ['sistema.pantalla.hdr', 'si'],
      ['sistema.pantalla.hdr', null],
      ['sistema.pantalla.nightLight.intensidad', 101],
      ['sistema.pantalla.nightLight.intensidad', -1],
      ['sistema.entrada.tecladoRetardo', 4],
      ['sistema.entrada.tecladoRetardo', -1],
      ['sistema.entrada.tecladoVelocidad', 32],
      ['sistema.general.uac', 'siempre'],
      ['sistema.general.exclusionesAntivirus', 'C:\\Juegos'],
      ['sistema.general.exclusionesAntivirus', ['desconocido']],
      ['enJuego.topeFps', 0],
      ['enJuego.topeFps', 'sin tope'],
      ['enJuego.topeFps', null],
      ['enJuego.modoPantalla', 'pantalla_completa'],
      ['enJuego.resolucionJuego', 'grande'],
      ['enJuego.ejecutable.dpiOverride', 'otro'],
      ['enJuego.archivosConfig', null],
    ])('%s rechaza %j', (ruta, valor) => {
      expect(acepta(conValorEn(ruta, valor))).toBe(false);
    });

    it.each([
      ['sistema.pantalla', 'monitorModelo'],
      ['sistema.pantalla', 'gpu'],
      ['sistema.entrada', 'punteroPrecision'],
      ['enJuego.ejecutable', 'versionParche'],
    ])('%s rechaza la clave %s, que no está en el formato', (ruta, clave) => {
      expect(acepta(conValorEn(`${ruta}.${clave}`, 'valor'))).toBe(false);
    });

    it('el ejecutable sin ruta se rechaza', () => {
      const doc = conValorEn('enJuego.ejecutable.ruta', undefined);

      expect(acepta(doc)).toBe(false);
    });

    it('nightLight sin estado se rechaza', () => {
      const doc = conValorEn('sistema.pantalla.nightLight', {
        intensidad: 50,
      });

      expect(acepta(doc)).toBe(false);
    });
  });

  describe('archivosConfig', () => {
    const conArchivos = (archivos: unknown): Documento =>
      conValorEn('enJuego.archivosConfig', archivos);

    it('guarda el texto entero, idéntico: saltos de línea, tabulaciones y acentos', () => {
      const contenido = 'a=1\r\n\tb = "ñandú"\n\n# fin sin salto';

      const resultado = documentoEstampaSchema.parse(
        conArchivos([{ ruta: 'C:\\x\\Variables.txt', contenido }]),
      );

      expect(resultado.enJuego.archivosConfig?.[0]?.contenido).toBe(contenido);
    });

    it('acepta el tope de cantidad y rechaza uno más', () => {
      const archivo = (n: number) => ({
        ruta: `C:\\x\\${n}.cfg`,
        contenido: 'a',
      });
      const justos = Array.from({ length: ARCHIVOS_CONFIG_MAX }, (_, n) =>
        archivo(n),
      );

      expect(acepta(conArchivos(justos))).toBe(true);
      expect(acepta(conArchivos([...justos, archivo(99)]))).toBe(false);
    });

    it('acepta el tope de bytes y rechaza uno más', () => {
      const archivo = (contenido: string) => [{ ruta: 'C:\\x.cfg', contenido }];

      expect(
        acepta(conArchivos(archivo('a'.repeat(ARCHIVO_CONFIG_BYTES_MAX)))),
      ).toBe(true);
      expect(
        acepta(conArchivos(archivo('a'.repeat(ARCHIVO_CONFIG_BYTES_MAX + 1)))),
      ).toBe(false);
    });

    it('el tope cuenta bytes, no letras: una «é» ocupa dos', () => {
      const mitad = ARCHIVO_CONFIG_BYTES_MAX / 2;
      const archivo = (letras: number) => [
        { ruta: 'C:\\x.cfg', contenido: 'é'.repeat(letras) },
      ];

      expect(acepta(conArchivos(archivo(mitad)))).toBe(true);
      expect(acepta(conArchivos(archivo(mitad + 1)))).toBe(false);
    });

    it.each([
      ['sin ruta', [{ contenido: 'a' }]],
      ['sin contenido', [{ ruta: 'C:\\x.cfg' }]],
      ['ruta reservada', [{ ruta: 'desconocido', contenido: 'a' }]],
      ['clave extra', [{ ruta: 'C:\\x.cfg', contenido: 'a', hash: 'z' }]],
    ])('rechaza un archivo %s', (_caso, archivos) => {
      expect(acepta(conArchivos(archivos))).toBe(false);
    });
  });

  describe('corregir un bloque parcial', () => {
    it('cambiar un campo no borra a sus hermanos', () => {
      const base = documentoEstampaSchema.parse(leerEjemplo(BASE));
      const cambios = cambiosSchema.parse({
        sistema: { pantalla: { hdr: 'apagado' } },
      });

      const nueva = documentoEstampaSchema.parse(fusionar(base, cambios));

      expect(nueva.sistema.pantalla?.hdr).toBe('apagado');
      expect(nueva.sistema.pantalla?.escalaPct).toBe(100);
      expect(nueva.sistema.pantalla?.nightLight?.estado).toBe('apagado');
      expect(nueva.sistema.entrada?.tecladoVelocidad).toBe(31);
    });
  });
});
