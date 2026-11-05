import { describe, expect, it } from 'vitest';
import { extractBearerToken, isAuthorized } from '../auth.js';

const TOKEN = 'k'.repeat(40);

const REJECTED_HEADERS: ReadonlyArray<[string, string | undefined]> = [
  ['missing header', undefined],
  ['empty header', ''],
  ['scheme only', 'Bearer'],
  ['scheme and blank', 'Bearer '],
  ['token without scheme', TOKEN],
  ['wrong scheme', `Basic ${TOKEN}`],
  ['wrong token, same length', `Bearer ${'x'.repeat(TOKEN.length)}`],
  ['token with extra char (longer)', `Bearer ${TOKEN}x`],
  ['token missing a char (shorter)', `Bearer ${TOKEN.slice(1)}`],
  ['two tokens', `Bearer ${TOKEN} ${TOKEN}`],
  ['token inside a longer string', `Bearer a${TOKEN}`],
  ['bearer glued to token', `Bearer${TOKEN}`],
];

describe('isAuthorized', () => {
  it.each(REJECTED_HEADERS)('rejects: %s', (_label, header) => {
    expect(isAuthorized(header, TOKEN)).toBe(false);
  });

  it('accepts the exact token', () => {
    expect(isAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
  });

  it('accepts the scheme case-insensitively', () => {
    expect(isAuthorized(`bearer ${TOKEN}`, TOKEN)).toBe(true);
  });

  it('keeps token comparison case-sensitive', () => {
    expect(isAuthorized(`Bearer ${TOKEN.toUpperCase()}`, TOKEN)).toBe(false);
  });
});

describe('extractBearerToken', () => {
  it('returns the token of a well-formed header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('returns undefined for a malformed header', () => {
    expect(extractBearerToken('Token abc123')).toBeUndefined();
  });
});
