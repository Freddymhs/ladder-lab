import { describe, expect, it } from 'vitest';
import { datosValidos } from '../../tools/__tests__/harness.js';
import { InMemoryEstampaRepository } from '../in-memory-estampa.repository.js';
import { describirContratoDeRepositorio } from './contrato.js';

describirContratoDeRepositorio(
  'en memoria',
  () => new InMemoryEstampaRepository(),
);

describe('InMemoryEstampaRepository — aislamiento', () => {
  it('devuelve copias: modificar lo leído no altera lo guardado', async () => {
    const repo = new InMemoryEstampaRepository();
    const { id } = await repo.crear(datosValidos());

    const leida = await repo.obtener(id);
    leida!.datos.sistema.mouse = 'ALTERADO';

    expect((await repo.obtener(id))?.datos.sistema.mouse).toBe('Marca Modelo');
  });

  it('guarda copias: modificar lo enviado después no altera lo guardado', async () => {
    const repo = new InMemoryEstampaRepository();
    const datos = datosValidos();
    const { id } = await repo.crear(datos);

    datos.sistema.mouse = 'ALTERADO';

    expect((await repo.obtener(id))?.datos.sistema.mouse).toBe('Marca Modelo');
  });
});
