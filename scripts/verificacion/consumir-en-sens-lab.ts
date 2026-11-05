/**
 * Lado sens-lab de la verificación (DECISION_INTEGRACION_CONVERTIDOR.md): pasa las salidas REALES de
 * ladder-lab por el importador y el mapeo REALES de sens-lab (se importan desde su carpeta, solo lectura).
 * Uso: tsx --tsconfig <sens-lab>/tsconfig.json scripts/verificacion/consumir-en-sens-lab.ts <directorio> <ruta-de-sens-lab> <ejemplos-de-ladder-lab>
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [directorio, sensLab, ejemplos] = process.argv.slice(2);
assert(directorio && sensLab && ejemplos, 'Uso: consumir-en-sens-lab <directorio> <sens-lab> <ejemplos>');

const cargar = async (ruta: string) => import(pathToFileURL(join(sensLab, ruta)).href);
const { importarEstampa, estampaAOrigen } = await cargar('src/domain/estampa/index.ts');
const { CATALOGO_JUEGOS } = await cargar('src/domain/juegos/index.ts');

const leer = (ruta: string): string => readFileSync(ruta, 'utf8');
const ids = JSON.parse(leer(join(directorio, 'ids.json'))) as { a: string; b: string };
const resumen: string[] = [];

const importar = (nombre: string, texto: string, esperadas: number) => {
  const resultado = importarEstampa(texto);
  assert(resultado.ok, `sens-lab debe importar ${nombre}: ${JSON.stringify(resultado.error)}`);
  assert.equal(resultado.valor.length, esperadas, `${nombre}: estampas importadas`);
  resumen.push(`importa ${nombre.padEnd(34)} → ${resultado.valor.length} estampa(s)`);
  return resultado.valor as Array<{ id?: string; juego: { nombre: string } }>;
};

importar('documento.json', leer(join(directorio, 'documento.json')), 1);
const normal = importar('exportacion-normal.json', leer(join(directorio, 'exportacion-normal.json')), 2);
importar('respaldo.json (cada versión cuenta)', leer(join(directorio, 'respaldo.json')), 3);
for (const archivo of readdirSync(ejemplos).filter((f) => f.endsWith('.json')).sort()) {
  const texto = leer(join(ejemplos, archivo));
  const esperadas = (JSON.parse(texto) as { estampas?: unknown[] }).estampas?.length ?? 1;
  importar(`ejemplos/${archivo}`, texto, esperadas);
}

// El motivo de que la exportación lleve id: sens-lab cita la estampa de origen (derivadaDe).
for (const [indice, estampa] of normal.entries()) {
  const mapeo = estampaAOrigen(estampa, CATALOGO_JUEGOS);
  const esperado = [ids.a, ids.b][indice];
  assert.equal(mapeo.estampaOrigenId, esperado, 'sens-lab debe poder citar el id de la estampa de origen');
  resumen.push(`mapea   ${estampa.juego.nombre.padEnd(20)} id origen ${String(mapeo.estampaOrigenId).slice(0, 8)}… faltantes: [${mapeo.faltantes.join(', ')}]`);
}

// Controles rojos: lo roto o desconocido DEBE ser rechazado; si pasara, la verificación no vale nada.
const base = JSON.parse(leer(join(directorio, 'exportacion-normal.json'))) as Record<string, unknown>;
const rojos: Array<[string, string, string]> = [
  ['versión futura', JSON.stringify({ ...base, version: 2 }), 'version_no_soportada'],
  ['formato equivocado', JSON.stringify({ ...base, formato: 'otra-cosa' }), 'formato_desconocido'],
  ['JSON truncado', leer(join(directorio, 'exportacion-normal.json')).slice(0, 120), 'json_invalido'],
];
for (const [nombre, texto, codigo] of rojos) {
  const resultado = importarEstampa(texto);
  assert(!resultado.ok && resultado.error.codigo === codigo, `control rojo "${nombre}" debía fallar con ${codigo}`);
  resumen.push(`rechaza ${nombre.padEnd(34)} (${codigo})`);
}
console.log(resumen.join('\n'));
console.log(`verificación OK: ${resumen.length} comprobaciones contra el código real de sens-lab`);
