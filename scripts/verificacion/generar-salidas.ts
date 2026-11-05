/**
 * Lado ladder-lab de la verificación con sens-lab (docs/decisions/DECISION_INTEGRACION_CONVERTIDOR.md).
 * 1) Genera salidas REALES de ladder-lab (exportación normal, respaldo, documento) en <directorio>.
 * 2) Comprueba que ladder-lab ACEPTA lo que sens-lab considera una exportación válida y RECHAZA lo
 *    que sens-lab considera inválido (sus fixtures, leídos como datos; no se ejecuta su código aquí).
 * Uso: tsx --tsconfig tsconfig.json scripts/verificacion/generar-salidas.ts <directorio> <ruta-de-sens-lab>
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { InMemoryEstampaRepository } from '../../src/data/index.js';
import {
  construirEnvoltorio,
  documentoEstampaSchema,
  validarEnvoltorio,
} from '../../src/domain/estampa/index.js';
import { datosRts, datosValidos } from '../../src/tools/__tests__/harness.js';

const [directorio, sensLab] = process.argv.slice(2);
assert(directorio && sensLab, 'Uso: generar-salidas <directorio> <ruta-de-sens-lab>');

const repo = new InMemoryEstampaRepository();
const a = await repo.crear(datosValidos());
await repo.corregir(a.id, 1, { ...datosValidos(), notas: 'segunda versión' });
const b = await repo.crear({ ...datosRts(), derivadaDe: a.id });
await repo.archivar(b.id);

const escribir = (nombre: string, valor: unknown): void =>
  writeFileSync(join(directorio, nombre), JSON.stringify(valor, null, 2));
escribir('exportacion-normal.json', construirEnvoltorio(await repo.todas({ incluirVersiones: false }), { incluirVersiones: false }));
escribir('respaldo.json', construirEnvoltorio(await repo.todas({ incluirVersiones: true }), { incluirVersiones: true }));
const { id: _id, ...sinId } = construirEnvoltorio(await repo.todas({ incluirVersiones: false }), { incluirVersiones: false }).estampas[0]!;
escribir('documento.json', sinId);
console.log(`generadas: exportacion-normal (2 estampas), respaldo (3 documentos), documento (1) · ids ${a.id.slice(0, 8)}…, ${b.id.slice(0, 8)}…`);
escribir('ids.json', { a: a.id, b: b.id });

// --- Dirección inversa: lo que sens-lab espera de ladder-lab debe ser coherente con ladder-lab.
const fixtureDeSensLab = (nombre: string): unknown =>
  JSON.parse(readFileSync(join(sensLab, 'src/domain/estampa/fixtures', nombre), 'utf8'));
const resultados: string[] = [];

assert.doesNotThrow(() => validarEnvoltorio(fixtureDeSensLab('exportacion-con-id.json')), 'ladder-lab debe aceptar la exportación que sens-lab usa como válida');
resultados.push('acepta  exportacion-con-id.json (la que sens-lab usa como válida)');
const completa = documentoEstampaSchema.safeParse(fixtureDeSensLab('estampa-completa.json'));
resultados.push(`${completa.success ? 'acepta ' : 'RECHAZA'} estampa-completa.json de sens-lab${completa.success ? '' : ` — ${completa.error.issues.slice(0, 3).map((i) => i.path.join('.')).join(', ')}`}`);
for (const invalido of ['version-futura.json', 'campo-invalido.json']) {
  assert(!documentoEstampaSchema.safeParse(fixtureDeSensLab(invalido)).success, `ladder-lab debe rechazar ${invalido}`);
  resultados.push(`rechaza ${invalido} (inválido también para sens-lab)`);
}
assert.throws(() => validarEnvoltorio(fixtureDeSensLab('formato-equivocado.json')), /No es una exportación/);
resultados.push('rechaza formato-equivocado.json');
console.log(resultados.join('\n'));
