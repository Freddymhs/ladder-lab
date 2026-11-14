import { describe, expect, it } from 'vitest';
import { sugerirJuegos } from '../juegos.js';

describe('sugerirJuegos', () => {
  const conocidos = [
    'StarCraft II',
    'Age of Empires IV',
    'Counter-Strike',
    'Valorant',
  ];

  it('un número arábigo y uno romano son el mismo juego', () => {
    expect(sugerirJuegos('Starcraft 2', conocidos)).toEqual(['StarCraft II']);
    expect(sugerirJuegos('age of empires 4', conocidos)).toEqual([
      'Age of Empires IV',
    ]);
  });

  it('ignora mayúsculas, espacios y signos', () => {
    expect(sugerirJuegos('counter strike', conocidos)).toEqual([
      'Counter-Strike',
    ]);
  });

  it('acepta un error de tipeo pequeño', () => {
    expect(sugerirJuegos('Valoran', conocidos)).toEqual(['Valorant']);
  });

  it('un nombre sin parecido no sugiere nada', () => {
    expect(sugerirJuegos('Dota', conocidos)).toEqual([]);
  });

  it('el nombre buscado vacío o solo signos no sugiere nada', () => {
    expect(sugerirJuegos('  --  ', conocidos)).toEqual([]);
  });
});
