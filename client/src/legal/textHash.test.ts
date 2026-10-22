import { describe, expect, it } from 'vitest';
import { legalTexts } from '../i18n/legal';
import { docPlainText, sha256Fallback, sha256Hex } from './textHash';

describe('sha256Hex', () => {
  it('matches the known SHA-256 vectors as 64 lowercase hex', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
  it('hashes UTF-8, and a one-character change gives another hash', async () => {
    const a = await sha256Hex('Умови');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex('Умови.')).not.toBe(a);
  });
});

describe('sha256Fallback (no WebCrypto, e.g. an http page on a LAN address)', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it('gives the same hash as WebCrypto for edge lengths, UTF-8 and a whole document', async () => {
    const texts = [
      '',
      'abc',
      'a'.repeat(55),
      'a'.repeat(56),
      'a'.repeat(63),
      'a'.repeat(64),
      'a'.repeat(65),
      'Умови використання ✓',
      docPlainText(legalTexts('uk').terms),
    ];
    for (const t of texts) expect(sha256Fallback(enc(t))).toBe(await sha256Hex(t));
  });
  it('is what sha256Hex returns when crypto.subtle is missing', async () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
    try {
      expect(await sha256Hex('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    } finally {
      if (real) Object.defineProperty(globalThis, 'crypto', real);
    }
  });
});

describe('docPlainText', () => {
  it('is deterministic and carries the title and every section', () => {
    const doc = legalTexts('en').terms;
    const text = docPlainText(doc);
    expect(text).toBe(docPlainText(doc));
    expect(text.startsWith(doc.title)).toBe(true);
    for (const s of doc.sections) expect(text).toContain(s.title);
  });
  it('differs between languages', () => {
    expect(docPlainText(legalTexts('en').privacy)).not.toBe(docPlainText(legalTexts('uk').privacy));
  });
});
