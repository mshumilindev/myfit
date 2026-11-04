import { describe, expect, it } from 'vitest';
import { clientIp, placeFromIp } from '../functions/src/geoip';

describe('clientIp', () => {
  it('takes the last forwarded entry: earlier ones are client-supplied', () => {
    expect(clientIp({ 'x-forwarded-for': '1.2.3.4, 8.8.8.8' })).toBe('8.8.8.8');
    expect(clientIp({ 'x-forwarded-for': ['9.9.9.9'] })).toBe('9.9.9.9');
  });
  it('falls back to the socket address, unwraps mapped IPv4 and rejects junk', () => {
    expect(clientIp({}, '::ffff:8.8.4.4')).toBe('8.8.4.4');
    expect(clientIp(undefined, '2001:4860:4860::8888')).toBe('2001:4860:4860::8888');
    expect(clientIp({ 'x-forwarded-for': 'not an ip!' })).toBeNull();
    expect(clientIp({})).toBeNull();
  });
});

describe('placeFromIp', () => {
  it('finds a country (and a city) in the offline database, IPv4 and IPv6', () => {
    expect(placeFromIp('8.8.8.8').country).toBe('US');
    expect(placeFromIp('2001:4860:4860::8888').country).toMatch(/^[A-Z]{2}$/);
  });
  it('gives nothing for private, unknown or missing addresses', () => {
    const none = { city: null, country: null };
    expect(placeFromIp('10.0.0.1')).toEqual(none);
    expect(placeFromIp('127.0.0.1')).toEqual(none);
    expect(placeFromIp(null)).toEqual(none);
    expect(placeFromIp('999.1.1.1')).toEqual(none);
  });
});
