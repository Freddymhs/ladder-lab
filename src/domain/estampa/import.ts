import { FORMATO_EXPORT, FORMATO_VERSION } from './constants.js';
import { ImportacionInvalidaError } from './errors.js';
import { envoltorioExportSchema } from './schema.js';
import type {
  DatosEstampa,
  DocumentoExportado,
  EnvoltorioExport,
} from './schema.js';

export interface VersionImportable {
  readonly numero: number;
  readonly datos: DatosEstampa;
}

export interface EstampaImportable {
  readonly id: string;
  readonly archivada: boolean;
  readonly versiones: readonly VersionImportable[];
}

export interface PlanImportacion {
  readonly estampas: readonly EstampaImportable[];
}

/**
 * Valida un envoltorio recibido como dato sin tipo y devuelve un error claro
 * para el caso que más importa: otro formato u otra versión.
 */
export function validarEnvoltorio(entrada: unknown): EnvoltorioExport {
  const { formato, version } = (entrada ?? {}) as Record<string, unknown>;

  if (formato !== FORMATO_EXPORT) {
    throw new ImportacionInvalidaError(
      `No es una exportación de ladder-lab: se esperaba formato "${FORMATO_EXPORT}" y llegó ${JSON.stringify(formato)}.`,
    );
  }
  if (version !== FORMATO_VERSION) {
    throw new ImportacionInvalidaError(
      `Versión de formato no soportada: ${JSON.stringify(version)}. Este servidor solo entiende la versión ${FORMATO_VERSION}.`,
    );
  }

  const resultado = envoltorioExportSchema.safeParse(entrada);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new ImportacionInvalidaError(
      `La exportación no cumple el esquema — ${detalle}`,
    );
  }
  return resultado.data;
}

const agruparPorId = (
  documentos: readonly DocumentoExportado[],
): Map<string, DocumentoExportado[]> => {
  const grupos = new Map<string, DocumentoExportado[]>();
  for (const documento of documentos) {
    grupos.set(documento.id, [...(grupos.get(documento.id) ?? []), documento]);
  }
  return grupos;
};

function versionesDe(
  id: string,
  documentos: readonly DocumentoExportado[],
): VersionImportable[] {
  const conNumero = documentos.filter((d) => d.numeroVersion !== undefined);

  if (conNumero.length === 0) {
    if (documentos.length !== 1) {
      throw new ImportacionInvalidaError(
        `La estampa ${id} aparece ${documentos.length} veces sin numeroVersion: no se sabe el orden de sus versiones.`,
      );
    }
    return [{ numero: 1, datos: aDatos(documentos[0]!) }];
  }
  if (conNumero.length !== documentos.length) {
    throw new ImportacionInvalidaError(
      `La estampa ${id} mezcla documentos con y sin numeroVersion.`,
    );
  }

  const ordenadas = [...conNumero].sort(
    (a, b) => a.numeroVersion! - b.numeroVersion!,
  );
  ordenadas.forEach((documento, indice) => {
    if (documento.numeroVersion !== indice + 1) {
      throw new ImportacionInvalidaError(
        `La estampa ${id} tiene versiones incompletas o repetidas: se esperaba la ${indice + 1} y llegó la ${documento.numeroVersion}.`,
      );
    }
  });
  return ordenadas.map((documento) => ({
    numero: documento.numeroVersion!,
    datos: aDatos(documento),
  }));
}

function aDatos(documento: DocumentoExportado): DatosEstampa {
  const {
    formato: _formato,
    version: _version,
    id: _id,
    numeroVersion: _numeroVersion,
    archivada: _archivada,
    ...datos
  } = documento;
  return datos;
}

/**
 * Convierte un envoltorio en un plan de importación: una estampa por `id`, con
 * sus versiones numeradas desde 1 sin saltos. No consulta la base: qué ids ya
 * existen y si `derivadaDe` apunta a algo que existe lo decide el repositorio.
 */
export function planificarImportacion(
  envoltorio: EnvoltorioExport,
): PlanImportacion {
  const estampas = [...agruparPorId(envoltorio.estampas)].map(
    ([id, documentos]) => {
      const versiones = versionesDe(id, documentos);
      versiones.forEach(({ datos }) => {
        if (datos.derivadaDe === id) {
          throw new ImportacionInvalidaError(
            `La estampa ${id} deriva de sí misma.`,
          );
        }
      });
      return {
        id,
        archivada: documentos.some((documento) => documento.archivada === true),
        versiones,
      };
    },
  );
  return { estampas };
}
