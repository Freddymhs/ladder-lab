const esObjetoPlano = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/** Fusión profunda e inmutable: los cambios pisan a la base solo en las hojas que traen. */
export function fusionar(base: unknown, cambios: unknown): unknown {
  if (!esObjetoPlano(base) || !esObjetoPlano(cambios)) {
    return cambios;
  }
  const resultado: Record<string, unknown> = { ...base };
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor === undefined) {
      continue;
    }
    resultado[clave] = fusionar(base[clave], valor);
  }
  return resultado;
}

/** JSON con las claves ordenadas: dos objetos iguales dan el mismo texto. */
export function jsonCanonico(valor: unknown): string {
  if (Array.isArray(valor)) {
    return `[${valor.map(jsonCanonico).join(',')}]`;
  }
  if (esObjetoPlano(valor)) {
    const partes = Object.keys(valor)
      .sort()
      .filter((clave) => valor[clave] !== undefined)
      .map((clave) => `${JSON.stringify(clave)}:${jsonCanonico(valor[clave])}`);
    return `{${partes.join(',')}}`;
  }
  return JSON.stringify(valor);
}

export const sonIguales = (a: unknown, b: unknown): boolean =>
  jsonCanonico(a) === jsonCanonico(b);
