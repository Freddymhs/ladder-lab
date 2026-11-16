import {
  FORMATO_ESTAMPA,
  FORMATO_EXPORT,
  FORMATO_VERSION,
} from './constants.js';
import type { EstampaActiva, EstampaGuardada } from './model.js';
import { documentoExportadoSchema, envoltorioExportSchema } from './schema.js';
import type {
  ActivaExportada,
  DocumentoExportado,
  EnvoltorioExport,
} from './schema.js';

export interface OpcionesExportacion {
  readonly incluirVersiones: boolean;
  /**
   * Las activas de hoy. Si se pasa (aunque sea vacío) el envoltorio lleva
   * `activas`; si no, el campo no aparece.
   */
  readonly activas?: readonly EstampaActiva[];
}

const aActivaExportada = (activa: EstampaActiva): ActivaExportada => ({
  juego: activa.juego,
  estampaId: activa.estampa.id,
  numeroVersion: activa.estampa.numeroVersion,
});

/**
 * Documento exportado = datos + id (siempre). `numeroVersion` solo con
 * `incluirVersiones`; `archivada` solo si lo está (DECISION_FORMATO_ESTAMPA_V1).
 */
export function aDocumentoExportado(
  estampa: EstampaGuardada,
  opciones: OpcionesExportacion,
): DocumentoExportado {
  return documentoExportadoSchema.parse({
    formato: FORMATO_ESTAMPA,
    version: FORMATO_VERSION,
    id: estampa.id,
    ...(opciones.incluirVersiones && { numeroVersion: estampa.numeroVersion }),
    ...(estampa.archivada && { archivada: true }),
    ...estampa.datos,
  });
}

export function construirEnvoltorio(
  estampas: readonly EstampaGuardada[],
  opciones: OpcionesExportacion,
): EnvoltorioExport {
  return envoltorioExportSchema.parse({
    formato: FORMATO_EXPORT,
    version: FORMATO_VERSION,
    estampas: estampas.map((estampa) => aDocumentoExportado(estampa, opciones)),
    ...(opciones.activas && {
      activas: opciones.activas.map(aActivaExportada),
    }),
  });
}

/** Todo `derivadaDe` presente debe resolverse contra un `id` del mismo envoltorio. */
export function derivadasSinResolver(envoltorio: EnvoltorioExport): string[] {
  const ids = new Set(envoltorio.estampas.map((documento) => documento.id));
  return envoltorio.estampas
    .map((documento) => documento.derivadaDe)
    .filter(
      (derivada): derivada is string =>
        derivada !== undefined && !ids.has(derivada),
    );
}
