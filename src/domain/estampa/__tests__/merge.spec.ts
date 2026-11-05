import { describe, expect, it } from 'vitest';
import { fusionar, jsonCanonico, sonIguales } from '../merge.js';

describe('fusionar', () => {
  it('pisa solo las hojas que trae el cambio', () => {
    const base = { a: { x: 1, y: 2 }, b: 'k' };
    expect(fusionar(base, { a: { y: 9 } })).toEqual({
      a: { x: 1, y: 9 },
      b: 'k',
    });
  });

  it('no muta la base ni los cambios', () => {
    const base = { a: { x: 1 } };
    const cambios = { a: { x: 2 } };
    fusionar(base, cambios);
    expect(base).toEqual({ a: { x: 1 } });
    expect(cambios).toEqual({ a: { x: 2 } });
  });

  it('agrega claves nuevas y ignora undefined', () => {
    expect(fusionar({ a: 1 }, { b: 2, a: undefined })).toEqual({ a: 1, b: 2 });
  });

  it('los arreglos y primitivos se reemplazan enteros', () => {
    expect(fusionar({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
    expect(fusionar({ a: 1 }, { a: 'x' })).toEqual({ a: 'x' });
  });
});

describe('sonIguales', () => {
  it('ignora el orden de las claves', () => {
    expect(
      sonIguales({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }),
    ).toBe(true);
  });

  it('distingue valores distintos y tipos distintos', () => {
    expect(sonIguales({ a: 1 }, { a: 2 })).toBe(false);
    expect(sonIguales({ a: 1 }, { a: '1' })).toBe(false);
  });

  it('una clave undefined equivale a ausente', () => {
    expect(sonIguales({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });

  it('jsonCanonico es estable', () => {
    expect(jsonCanonico({ b: 1, a: [2, { z: 1, y: 2 }] })).toBe(
      '{"a":[2,{"y":2,"z":1}],"b":1}',
    );
  });
});
