import { describe, expect, it } from 'vitest';
import { legalTexts } from '../i18n/legal';
import { docPlainText, sha256Hex } from './textHash';

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
