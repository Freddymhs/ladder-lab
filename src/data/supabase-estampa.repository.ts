import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  AlmacenamientoError,
  ConflictoDeVersionError,
  DerivadaInvalidaError,
  EstampaArchivadaError,
  EstampaNoEncontradaError,
  FORMATO_VERSION,
  ImportacionInvalidaError,
  VersionNoEncontradaError,
  datosEstampaSchema,
} from '@domain/estampa/index.js';
import type {
  DatosEstampa,
  EstampaActiva,
  EstampaGuardada,
  PlanImportacion,
  ResultadoMarcarActiva,
} from '@domain/estampa/index.js';
import type {
  EstampaRepository,
  FiltroListado,
  OpcionesImportacion,
  OpcionesTodas,
  ResultadoImportacion,
} from './estampa.repository.js';

/** Códigos SQLSTATE propios de las migraciones (supabase/migrations). */
export const CODIGO_SQL = {
  NO_EXISTE: 'LL001',
  CONFLICTO_DE_VERSION: 'LL002',
  DERIVADA_INVALIDA: 'LL003',
  IMPORTACION_INVALIDA: 'LL004',
  ESTAMPA_ARCHIVADA: 'LL005',
  VERSION_NO_EXISTE: 'LL006',
  UUID_INVALIDO: '22P02',
} as const;

/** Texto para un error de dominio cuando la operación no tenía un id que citar. */
const ID_NO_INFORMADO = '(sin id)';
const VISTA_VIGENTES = 'estampas_vigentes';
const VISTA_HISTORIAL = 'estampas_historial';
const VISTA_ACTIVAS = 'estampas_activas_detalle';
const VISTA_JUEGOS = 'juegos_registrados';
const COLUMNAS =
  'id,numero_version,total_versiones,archivada,creada_en,version_creada_en,datos';
const COLUMNAS_ACTIVA = `${COLUMNAS},juego,elegida_en`;
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

const filaActivaSchema = filaSchema.extend({
  juego: z.string(),
  elegida_en: z.string(),
});

const referenciaVersionSchema = z.object({
  id: z.string().uuid(),
  numeroVersion: z.number().int().positive(),
});

const resultadoMarcarSchema = z.object({
  juego: z.string(),
  anterior: referenciaVersionSchema.nullable(),
});

const filaJuegoSchema = z.object({ juego: z.string() });

const resultadoImportacionSchema = z.object({
  estampasNuevas: z.number().int().nonnegative(),
  versionesNuevas: z.number().int().nonnegative(),
  omitidas: z.array(z.string()),
  aplicada: z.boolean(),
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

function traducirError(
  error: ErrorPostgrest,
  id?: string,
  numeroVersion?: number,
): Error {
  switch (error.code) {
    case CODIGO_SQL.NO_EXISTE:
    case CODIGO_SQL.UUID_INVALIDO:
      return new EstampaNoEncontradaError(id ?? ID_NO_INFORMADO);
    case CODIGO_SQL.CONFLICTO_DE_VERSION:
      return new ConflictoDeVersionError(id ?? ID_NO_INFORMADO);
    case CODIGO_SQL.DERIVADA_INVALIDA:
      return new DerivadaInvalidaError(error.message);
    case CODIGO_SQL.IMPORTACION_INVALIDA:
      return new ImportacionInvalidaError(error.message);
    case CODIGO_SQL.ESTAMPA_ARCHIVADA:
      return new EstampaArchivadaError(id ?? ID_NO_INFORMADO);
    case CODIGO_SQL.VERSION_NO_EXISTE:
      return new VersionNoEncontradaError(id ?? ID_NO_INFORMADO, numeroVersion);
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

function validarFila<T>(esquema: z.ZodType<T>, fila: unknown): T {
  const resultado = esquema.safeParse(fila);
  if (!resultado.success) {
    throw new AlmacenamientoError(
      `La base devolvió una estampa que no cumple el esquema (${identificarFila(fila)})`,
      resultado.error,
    );
  }
  return resultado.data;
}

const filaAEstampa = (f: z.infer<typeof filaSchema>): EstampaGuardada => ({
  id: f.id,
  numeroVersion: f.numero_version,
  totalVersiones: f.total_versiones,
  archivada: f.archivada,
  creadaEn: f.creada_en,
  versionCreadaEn: f.version_creada_en,
  datos: f.datos,
});

const aEstampa = (fila: unknown): EstampaGuardada =>
  filaAEstampa(validarFila(filaSchema, fila));

function aActiva(fila: unknown): EstampaActiva {
  const f = validarFila(filaActivaSchema, fila);
  return { juego: f.juego, elegidaEn: f.elegida_en, estampa: filaAEstampa(f) };
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
    const {
      juego,
      genero,
      incluirArchivadas,
      soloMatchPerfecto,
      limite,
      desplazamiento,
    } = filtro;
    const base = this.client.from(VISTA_VIGENTES).select(COLUMNAS);
    const porJuego =
      juego !== undefined ? base.ilike('juego', escaparPatron(juego)) : base;
    const porGenero =
      genero !== undefined ? porJuego.eq('genero', genero) : porJuego;
    const porArchivo = incluirArchivadas
      ? porGenero
      : porGenero.eq('archivada', false);
    const porMatch = soloMatchPerfecto
      ? porArchivo.eq('match_perfecto', true)
      : porArchivo;
    const { data, error } = await porMatch
      .order('fecha', { ascending: false, nullsFirst: false })
      .order('creada_en', { ascending: false })
      .range(desplazamiento, desplazamiento + limite - 1);
    if (error) throw traducirError(error);
    return (data ?? []).map(aEstampa);
  }

  async versionesDe(id: string): Promise<EstampaGuardada[] | null> {
    const { data, error } = await this.client
      .from(VISTA_HISTORIAL)
      .select(COLUMNAS)
      .eq('id', id)
      .order('numero_version', { ascending: true });
    if (error) {
      if (error.code === CODIGO_SQL.UUID_INVALIDO) return null;
      throw traducirError(error, id);
    }
    return data.length === 0 ? null : data.map(aEstampa);
  }

  async archivar(id: string): Promise<EstampaGuardada> {
    const { error } = await this.client.rpc('archivar_estampa', { p_id: id });
    if (error) throw traducirError(error, id);
    const guardada = await this.obtener(id);
    if (!guardada) {
      throw new AlmacenamientoError(
        'La estampa archivada no se puede leer de vuelta',
      );
    }
    return guardada;
  }

  async importar(
    plan: PlanImportacion,
    opciones: OpcionesImportacion,
  ): Promise<ResultadoImportacion> {
    const { data, error } = await this.client.rpc('importar_estampas', {
      p_plan: plan,
      p_dry_run: opciones.dryRun,
      p_version_formato: FORMATO_VERSION,
    });
    if (error) throw traducirError(error);
    const resultado = resultadoImportacionSchema.safeParse(data);
    if (!resultado.success) {
      throw new AlmacenamientoError(
        'Respuesta inesperada al importar',
        resultado.error,
      );
    }
    return resultado.data;
  }

  async todas(opciones: OpcionesTodas): Promise<EstampaGuardada[]> {
    const vista = opciones.incluirVersiones ? VISTA_HISTORIAL : VISTA_VIGENTES;
    return this.paginar(vista, 0);
  }

  async marcarActiva(
    id: string,
    numeroVersion?: number,
  ): Promise<ResultadoMarcarActiva> {
    const { data, error } = await this.client.rpc('marcar_estampa_activa', {
      p_id: id,
      p_numero_version: numeroVersion ?? null,
    });
    if (error) throw traducirError(error, id, numeroVersion);
    const marcada = resultadoMarcarSchema.safeParse(data);
    if (!marcada.success) {
      throw new AlmacenamientoError(
        'Respuesta inesperada al marcar la activa',
        marcada.error,
      );
    }
    const activa = await this.activaDe(marcada.data.juego);
    if (!activa) {
      throw new AlmacenamientoError(
        'La estampa activa no se puede leer de vuelta',
      );
    }
    return { activa, anterior: marcada.data.anterior };
  }

  async activaDe(juego: string): Promise<EstampaActiva | null> {
    const { data, error } = await this.client
      .from(VISTA_ACTIVAS)
      .select(COLUMNAS_ACTIVA)
      .ilike('juego', escaparPatron(juego))
      .maybeSingle();
    if (error) throw traducirError(error);
    return data ? aActiva(data) : null;
  }

  async activas(): Promise<EstampaActiva[]> {
    const { data, error } = await this.client
      .from(VISTA_ACTIVAS)
      .select(COLUMNAS_ACTIVA)
      .order('juego', { ascending: true });
    if (error) throw traducirError(error);
    return (data ?? []).map(aActiva);
  }

  async juegos(): Promise<string[]> {
    const { data, error } = await this.client
      .from(VISTA_JUEGOS)
      .select('juego')
      .order('juego', { ascending: true });
    if (error) throw traducirError(error);
    const filas = z.array(filaJuegoSchema).safeParse(data ?? []);
    if (!filas.success) {
      throw new AlmacenamientoError(
        'La base devolvió nombres de juego inesperados',
        filas.error,
      );
    }
    return filas.data.map((fila) => fila.juego);
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
