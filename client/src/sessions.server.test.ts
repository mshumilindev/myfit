import { describe, expect, it } from 'vitest';
import { describeClient, placeFromHeaders, validDeviceId } from '../../functions/src/sessionsPure';

describe('sessions helpers', () => {
  it('describes the client from a user-agent', () => {
    expect(describeClient('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36')).toBe('Chrome · macOS');
    expect(describeClient('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1')).toBe('Safari · iOS');
    expect(describeClient('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('Edge · Windows');
    expect(describeClient(undefined)).toBe('Browser');
  });
  it('takes the place from edge headers only, nothing invented', () => {
    expect(placeFromHeaders({ 'x-appengine-country': 'PL', 'x-appengine-city': 'warsaw' })).toEqual({ city: 'warsaw', country: 'PL' });
    expect(placeFromHeaders({ 'cf-ipcountry': 'XX' })).toEqual({ city: null, country: null });
    expect(placeFromHeaders({})).toEqual({ city: null, country: null });
    expect(placeFromHeaders(undefined)).toEqual({ city: null, country: null });
  });
  it('accepts only sane device ids', () => {
    expect(validDeviceId('0b1c2d3e-4f50-6789-abcd-ef0123456789')).toBe(true);
    expect(validDeviceId('short')).toBe(false);
    expect(validDeviceId('../../x/yyyyyyyy')).toBe(false);
    expect(validDeviceId(42)).toBe(false);
  });
});
