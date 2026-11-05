export const PREFIJO_RESPALDO = 'ladder-lab-';
export const EXTENSION_RESPALDO = '.json';
export const EXTENSION_TEMPORAL = '.tmp';
/** ladder-lab-20261105T143000Z.json */
export const PATRON_ARCHIVO_RESPALDO = /^ladder-lab-\d{8}T\d{6}Z\.json$/;
export const ARGUMENTO_VERIFICAR = '--verificar';

export const CODIGO_SALIDA = {
  OK: 0,
  FALLO: 1,
  ALERTA: 2,
} as const;
