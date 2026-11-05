import { randomUUID } from 'node:crypto';
import {
  ConflictoDeVersionError,
  DerivadaInvalidaError,
  EstampaNoEncontradaError,
  ImportacionInvalidaError,
  PATRON_FECHA,
} from '@domain/estampa/index.js';
import type {
  DatosEstampa,
  EstampaGuardada,
  PlanImportacion,
} from '@domain/estampa/index.js';
import type {
  EstampaRepository,
  FiltroListado,
  OpcionesImportacion,
  OpcionesTodas,
  ResultadoImportacion,
} from './estampa.repository.js';

interface VersionAlmacenada {
  readonly datos: DatosEstampa;
  readonly creadaEn: string;
}

interface EstampaAlmacenada {
  readonly id: string;
  readonly orden: number;
  readonly creadaEn: string;
  readonly versiones: VersionAlmacenada[];
  archivadaEn: string | undefined;
}

const fechaOrdenable = (datos: DatosEstampa): string | undefined => {
  const { fecha } = datos.juego;
  return fecha !== undefined && PATRON_FECHA.test(fecha) ? fecha : undefined;
};

/** Mayor primero; sin fecha, al final. Misma regla que el listado en SQL. */
const compararPorFechaDesc = (
  a: EstampaGuardada,
  b: EstampaGuardada,
): number => {
  const fechaA = fechaOrdenable(a.datos);
  const fechaB = fechaOrdenable(b.datos);
  if (fechaA !== fechaB) {
    if (fechaA === undefined) return 1;
    if (fechaB === undefined) return -1;
    return fechaA < fechaB ? 1 : -1;
  }
  return b.creadaEn.localeCompare(a.creadaEn);
};

/**
 * Doble de prueba con las mismas reglas que la base real. Guarda y devuelve
 * copias, así que ningún llamador puede alterar lo ya almacenado.
 */
export class InMemoryEstampaRepository implements EstampaRepository {
  private readonly estampas = new Map<string, EstampaAlmacenada>();

  constructor(private readonly ahora: () => Date = () => new Date()) {}

  async crear(datos: DatosEstampa): Promise<EstampaGuardada> {
    const id = randomUUID();
    this.validarDerivada(id, datos);
    const marca = this.ahora().toISOString();
    this.estampas.set(id, {
      id,
      orden: this.estampas.size,
      creadaEn: marca,
      versiones: [{ datos: structuredClone(datos), creadaEn: marca }],
      archivadaEn: undefined,
    });
    return this.vigente(this.requerir(id));
  }

  async corregir(
    id: string,
    versionBase: number,
    datos: DatosEstampa,
  ): Promise<EstampaGuardada> {
    const estampa = this.requerir(id);
    if (estampa.versiones.length !== versionBase) {
      throw new ConflictoDeVersionError(id);
    }
    this.validarDerivada(id, datos);
    estampa.versiones.push({
      datos: structuredClone(datos),
      creadaEn: this.ahora().toISOString(),
    });
    return this.vigente(estampa);
  }

  async obtener(id: string): Promise<EstampaGuardada | null> {
    const estampa = this.estampas.get(id);
    return estampa ? this.vigente(estampa) : null;
  }

  async listar(filtro: FiltroListado): Promise<EstampaGuardada[]> {
    const juegoBuscado = filtro.juego?.toLowerCase();
    return this.todasLasVigentes()
      .filter((e) => filtro.incluirArchivadas || !e.archivada)
      .filter(
        (e) =>
          juegoBuscado === undefined ||
          e.datos.juego.nombre.toLowerCase() === juegoBuscado,
      )
      .filter(
        (e) =>
          filtro.genero === undefined || e.datos.juego.genero === filtro.genero,
      )
      .filter(
        (e) =>
          !filtro.soloMatchPerfecto || e.datos.resultado.matchPerfecto === true,
      )
      .sort(compararPorFechaDesc)
      .slice(filtro.desplazamiento, filtro.desplazamiento + filtro.limite);
  }

  async versionesDe(id: string): Promise<EstampaGuardada[] | null> {
    const estampa = this.estampas.get(id);
    return estampa
      ? estampa.versiones.map((_, i) => this.version(estampa, i + 1))
      : null;
  }

  async archivar(id: string): Promise<EstampaGuardada> {
    const estampa = this.requerir(id);
    estampa.archivadaEn ??= this.ahora().toISOString();
    return this.vigente(estampa);
  }

  async importar(
    plan: PlanImportacion,
    opciones: OpcionesImportacion,
  ): Promise<ResultadoImportacion> {
    const omitidas = plan.estampas
      .filter((e) => this.estampas.has(e.id))
      .map((e) => e.id);
    const nuevas = plan.estampas.filter((e) => !this.estampas.has(e.id));
    const idsDelLote = new Set(nuevas.map((e) => e.id));

    // Se valida TODO antes de escribir algo: o entra todo o no entra nada.
    for (const estampa of nuevas) {
      estampa.versiones.forEach((version, indice) => {
        if (version.numero !== indice + 1) {
          throw new ImportacionInvalidaError(
            `La estampa ${estampa.id} tiene versiones incompletas o repetidas (se esperaba la ${indice + 1}).`,
          );
        }
        const { derivadaDe } = version.datos;
        if (derivadaDe === estampa.id) {
          throw new DerivadaInvalidaError(
            'Una estampa no puede derivar de sí misma.',
          );
        }
        if (
          derivadaDe !== undefined &&
          !this.estampas.has(derivadaDe) &&
          !idsDelLote.has(derivadaDe)
        ) {
          throw new DerivadaInvalidaError(
            `derivadaDe apunta a una estampa que no existe: ${derivadaDe}.`,
          );
        }
      });
      if (estampa.versiones.length === 0) {
        throw new ImportacionInvalidaError(
          `La estampa ${estampa.id} no trae ninguna versión.`,
        );
      }
    }

    const versionesNuevas = nuevas.reduce(
      (suma, e) => suma + e.versiones.length,
      0,
    );
    if (!opciones.dryRun) {
      const marca = this.ahora().toISOString();
      for (const estampa of nuevas) {
        this.estampas.set(estampa.id, {
          id: estampa.id,
          orden: this.estampas.size,
          creadaEn: marca,
          versiones: estampa.versiones.map((v) => ({
            datos: structuredClone(v.datos),
            creadaEn: marca,
          })),
          archivadaEn: estampa.archivada ? marca : undefined,
        });
      }
    }
    return {
      estampasNuevas: nuevas.length,
      versionesNuevas,
      omitidas,
      aplicada: !opciones.dryRun,
    };
  }

  async todas(opciones: OpcionesTodas): Promise<EstampaGuardada[]> {
    const ordenadas = [...this.estampas.values()].sort(
      (a, b) => a.orden - b.orden,
    );
    return opciones.incluirVersiones
      ? ordenadas.flatMap((e) =>
          e.versiones.map((_, i) => this.version(e, i + 1)),
        )
      : ordenadas.map((e) => this.vigente(e));
  }

  private todasLasVigentes(): EstampaGuardada[] {
    return [...this.estampas.values()].map((e) => this.vigente(e));
  }

  private requerir(id: string): EstampaAlmacenada {
    const estampa = this.estampas.get(id);
    if (!estampa) {
      throw new EstampaNoEncontradaError(id);
    }
    return estampa;
  }

  private validarDerivada(id: string, datos: DatosEstampa): void {
    const { derivadaDe } = datos;
    if (derivadaDe === undefined) return;
    if (derivadaDe === id) {
      throw new DerivadaInvalidaError(
        'Una estampa no puede derivar de sí misma.',
      );
    }
    if (!this.estampas.has(derivadaDe)) {
      throw new DerivadaInvalidaError(
        `derivadaDe apunta a una estampa que no existe: ${derivadaDe}.`,
      );
    }
  }

  private vigente(estampa: EstampaAlmacenada): EstampaGuardada {
    return this.version(estampa, estampa.versiones.length);
  }

  private version(estampa: EstampaAlmacenada, numero: number): EstampaGuardada {
    const version = estampa.versiones[numero - 1]!;
    return {
      id: estampa.id,
      numeroVersion: numero,
      totalVersiones: estampa.versiones.length,
      archivada: estampa.archivadaEn !== undefined,
      creadaEn: estampa.creadaEn,
      versionCreadaEn: version.creadaEn,
      datos: structuredClone(version.datos),
    };
  }
}
