import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  AlmacenamientoError,
  ConflictoDeVersionError,
  DerivadaInvalidaError,
  EstampaNoEncontradaError,
  FORMATO_VERSION,
  datosEstampaSchema,
} from '@domain/estampa/index.js';
import type { DatosEstampa, EstampaGuardada } from '@domain/estampa/index.js';
import type {
  EstampaRepository,
  FiltroListado,
  OpcionesTodas,
} from './estampa.repository.js';

/** Códigos SQLSTATE propios de las migraciones (supabase/migrations). */
export const CODIGO_SQL = {
  NO_EXISTE: 'LL001',
  CONFLICTO_DE_VERSION: 'LL002',
  DERIVADA_INVALIDA: 'LL003',
  UUID_INVALIDO: '22P02',
} as const;

/** Texto para un error de dominio cuando la operación no tenía un id que citar. */
const ID_NO_INFORMADO = '(sin id)';
const VISTA_VIGENTES = 'estampas_vigentes';
const VISTA_HISTORIAL = 'estampas_historial';
const COLUMNAS =
  'id,numero_version,total_versiones,archivada,creada_en,version_creada_en,datos';
const PAGINA_EXPORTACION = 500;

const filaSchema = z.object({
  id: z.string().uuid(),
  numero_version: z.number().int().positive(),
  total_versiones: z.number().int().positive(),
  archivada: z.boolean(),
  creada_en: z.string(),
  version_creada_en: z.string(),
  datos: datosEstampaSchema,
});

const resultadoEscrituraSchema = z.object({
  id: z.string().uuid(),
  numeroVersion: z.number().int().positive(),
});

interface ErrorPostgrest {
  readonly code?: string;
  readonly message: string;
}

/** Escapa `%`, `_` y `\` para que un nombre de juego no actúe como patrón. */
const escaparPatron = (texto: string): string =>
  texto.replace(/[\\%_]/g, '\\$&');

function traducirError(error: ErrorPostgrest, id?: string): Error {
  switch (error.code) {
    case CODIGO_SQL.NO_EXISTE:
    case CODIGO_SQL.UUID_INVALIDO:
      return new EstampaNoEncontradaError(id ?? ID_NO_INFORMADO);
    case CODIGO_SQL.CONFLICTO_DE_VERSION:
      return new ConflictoDeVersionError(id ?? ID_NO_INFORMADO);
    case CODIGO_SQL.DERIVADA_INVALIDA:
      return new DerivadaInvalidaError(error.message);
    default:
      return new AlmacenamientoError(
        'Fallo al acceder al almacenamiento',
        error,
      );
  }
}

const identificarFila = (fila: unknown): string => {
  const { id, numero_version: version } = (fila ?? {}) as Record<
    string,
    unknown
  >;
  return `id ${String(id)} versión ${String(version)}`;
};

function aEstampa(fila: unknown): EstampaGuardada {
  const resultado = filaSchema.safeParse(fila);
  if (!resultado.success) {
    throw new AlmacenamientoError(
      `La base devolvió una estampa que no cumple el esquema (${identificarFila(fila)})`,
      resultado.error,
    );
  }
  const f = resultado.data;
  return {
    id: f.id,
    numeroVersion: f.numero_version,
    totalVersiones: f.total_versiones,
    archivada: f.archivada,
    creadaEn: f.creada_en,
    versionCreadaEn: f.version_creada_en,
    datos: f.datos,
  };
}

export class SupabaseEstampaRepository implements EstampaRepository {
  constructor(private readonly client: SupabaseClient) {}

  async crear(datos: DatosEstampa): Promise<EstampaGuardada> {
    const { data, error } = await this.client.rpc('crear_estampa', {
      p_datos: datos,
      p_version_formato: FORMATO_VERSION,
    });
    if (error) throw traducirError(error);
    return this.leerEscrita(data);
  }

  async corregir(
    id: string,
    versionBase: number,
    datos: DatosEstampa,
  ): Promise<EstampaGuardada> {
    const { data, error } = await this.client.rpc('corregir_estampa', {
      p_id: id,
      p_version_base: versionBase,
      p_datos: datos,
      p_version_formato: FORMATO_VERSION,
    });
    if (error) throw traducirError(error, id);
    return this.leerEscrita(data);
  }

  async obtener(id: string): Promise<EstampaGuardada | null> {
    const { data, error } = await this.client
      .from(VISTA_VIGENTES)
      .select(COLUMNAS)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      if (error.code === CODIGO_SQL.UUID_INVALIDO) return null;
      throw traducirError(error, id);
    }
    return data ? aEstampa(data) : null;
  }

  async listar(filtro: FiltroListado): Promise<EstampaGuardada[]> {
    const { juego, genero, incluirArchivadas, limite, desplazamiento } = filtro;
    const base = this.client.from(VISTA_VIGENTES).select(COLUMNAS);
    const porJuego =
      juego !== undefined ? base.ilike('juego', escaparPatron(juego)) : base;
    const porGenero =
      genero !== undefined ? porJuego.eq('genero', genero) : porJuego;
    const porArchivo = incluirArchivadas
      ? porGenero
      : porGenero.eq('archivada', false);
    const { data, error } = await porArchivo
      .order('fecha', { ascending: false, nullsFirst: false })
      .order('creada_en', { ascending: false })
      .range(desplazamiento, desplazamiento + limite - 1);
    if (error) throw traducirError(error);
    return (data ?? []).map(aEstampa);
  }

  async todas(opciones: OpcionesTodas): Promise<EstampaGuardada[]> {
    const vista = opciones.incluirVersiones ? VISTA_HISTORIAL : VISTA_VIGENTES;
    return this.paginar(vista, 0);
  }

  /** PostgREST limita las filas por respuesta: se pide por páginas hasta agotar. */
  private async paginar(
    vista: string,
    desde: number,
  ): Promise<EstampaGuardada[]> {
    const { data, error } = await this.client
      .from(vista)
      .select(COLUMNAS)
      .order('creada_en', { ascending: true })
      .order('id', { ascending: true })
      .order('numero_version', { ascending: true })
      .range(desde, desde + PAGINA_EXPORTACION - 1);
    if (error) throw traducirError(error);
    const pagina = (data ?? []).map(aEstampa);
    if (pagina.length < PAGINA_EXPORTACION) return pagina;
    return [
      ...pagina,
      ...(await this.paginar(vista, desde + PAGINA_EXPORTACION)),
    ];
  }

  private async leerEscrita(respuesta: unknown): Promise<EstampaGuardada> {
    const escrita = resultadoEscrituraSchema.safeParse(respuesta);
    if (!escrita.success) {
      throw new AlmacenamientoError(
        'Respuesta inesperada al escribir',
        escrita.error,
      );
    }
    const guardada = await this.obtener(escrita.data.id);
    if (!guardada) {
      throw new AlmacenamientoError(
        'La estampa escrita no se puede leer de vuelta',
      );
    }
    return guardada;
  }
}
