import { describe, expect, it } from 'vitest';
import { allowedRelyingParty } from '../functions/src/passkeysPure';

describe('passkey relying party', () => {
  it('allows localhost and Firebase hosting origins, with the page host as RP id', () => {
    expect(allowedRelyingParty('http://localhost:5173')).toEqual({ rpID: 'localhost', origin: 'http://localhost:5173' });
    expect(allowedRelyingParty('https://spotter-64c3b.web.app')?.rpID).toBe('spotter-64c3b.web.app');
    expect(allowedRelyingParty('https://x.firebaseapp.com')?.rpID).toBe('x.firebaseapp.com');
  });
  it('allows an extra origin only when listed', () => {
    expect(allowedRelyingParty('https://myspotter.fit')).toBeNull();
    expect(allowedRelyingParty('https://myspotter.fit', ['https://myspotter.fit'])?.rpID).toBe('myspotter.fit');
  });
  it('rejects look-alike, malformed and missing origins', () => {
    expect(allowedRelyingParty('https://evil.com')).toBeNull();
    expect(allowedRelyingParty('https://localhost.evil.com')).toBeNull();
    expect(allowedRelyingParty('not a url')).toBeNull();
    expect(allowedRelyingParty(undefined)).toBeNull();
  });
});
