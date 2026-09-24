import { afterEach, describe, expect, it, vi } from 'vitest';
import { haptic, isAppleTouch } from './haptics';

const setUA = (ua: string, platform = 'Linux', touch = 0) => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touch, configurable: true });
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('haptic', () => {
  it('uses the Vibration API on Android', () => {
    setUA('Mozilla/5.0 (Linux; Android 15) Chrome/140');
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    expect(haptic('double')).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([140, 90, 140]);
  });

  it('ticks a hidden native switch on iPhone, once per pulse', () => {
    vi.useFakeTimers();
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) Safari/604.1', 'iPhone', 5);
    expect(isAppleTouch()).toBe(true);
    const clicks: boolean[] = [];
    const orig = HTMLLabelElement.prototype.click;
    HTMLLabelElement.prototype.click = function (this: HTMLLabelElement) {
      clicks.push(this.querySelector('input[switch]') !== null);
    };
    try {
      expect(haptic('success')).toBe(true);
      vi.runAllTimers();
    } finally {
      HTMLLabelElement.prototype.click = orig;
    }
    expect(clicks).toEqual([true, true, true]);
    expect(document.head.querySelector('label')).toBeNull();
  });

  it('treats an iPad in desktop mode as Apple touch', () => {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 'MacIntel', 5);
    expect(isAppleTouch()).toBe(true);
  });
});
