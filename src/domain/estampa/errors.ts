/**
 * Errores esperados del dominio: la herramienta los convierte en un mensaje
 * claro para el usuario. Cualquier otro error es un fallo interno.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class DatosInvalidosError extends DomainError {}

export class EstampaNoEncontradaError extends DomainError {
  constructor(id: string) {
    super(`No existe una estampa con id ${id}.`);
  }
}

export class ConflictoDeVersionError extends DomainError {
  constructor(id: string) {
    super(
      `La estampa ${id} cambió mientras se corregía. Vuelve a verla y repite la corrección.`,
    );
  }
}

export class DerivadaInvalidaError extends DomainError {}

export class SinCambiosError extends DomainError {
  constructor() {
    super('La corrección no cambia ningún dato: no se crea una versión nueva.');
  }
}

export class ImportacionInvalidaError extends DomainError {}

/** Fallo de infraestructura (base de datos): se registra y se responde genérico. */
export class AlmacenamientoError extends Error {
  constructor(
    message: string,
    readonly causa?: unknown,
  ) {
    super(message);
    this.name = 'AlmacenamientoError';
  }
}
