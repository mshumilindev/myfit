import { describe, expect, it } from 'vitest';
import { detectPwaPlatform, isStandaloneDisplay } from './pwaInstall';

describe('detectPwaPlatform', () => {
  it('detects iPhone as apple / ios-guide', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'iPhone' });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    expect(detectPwaPlatform()).toMatchObject({
      brand: 'apple',
      mode: 'ios-guide',
      isIos: true,
    });
  });

  it('detects Android as android / android-guide', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Linux armv8l' });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    expect(detectPwaPlatform()).toMatchObject({
      brand: 'android',
      mode: 'android-guide',
      isAndroid: true,
    });
  });

  it('detects Mac as apple / mac-guide', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    expect(detectPwaPlatform()).toMatchObject({
      brand: 'apple',
      mode: 'mac-guide',
      isMac: true,
      isIos: false,
    });
  });
});

describe('isStandaloneDisplay', () => {
  it('returns boolean without throwing', () => {
    expect(typeof isStandaloneDisplay()).toBe('boolean');
  });
});
