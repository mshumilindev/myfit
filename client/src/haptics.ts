/**
 * Haptics that also work on iPhone. Safari has never implemented the Vibration
 * API, so `navigator.vibrate` is a silent no-op there. Since iOS 18, toggling a
 * native `<input type="checkbox" switch>` gives a system haptic tick — we click
 * a detached, hidden one. Android / Chromium keep the real Vibration API.
 *
 * iOS only honours the switch tick inside (or shortly after) a user gesture, so
 * rest-end alerts from a timer may stay silent there; the chime and the system
 * notification cover that case.
 */

export type HapticKind = 'tick' | 'double' | 'success';

const PATTERNS: Record<HapticKind, number[]> = {
  tick: [14],
  double: [140, 90, 140],
  success: [60, 50, 60, 50, 160],
};
/** iOS pulses per kind and the gap between them (one switch tick = one pulse). */
const IOS_PULSES: Record<HapticKind, number> = { tick: 1, double: 2, success: 3 };
const IOS_GAP_MS = 120;

export function isAppleTouch(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1)
  );
}

function hasVibrationApi(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === 'function'
  );
}

function switchTick(): void {
  if (typeof document === 'undefined') return;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}

/** Play a haptic of the given kind. Returns false when the device has no way to. */
export function haptic(kind: HapticKind = 'tick'): boolean {
  try {
    if (isAppleTouch()) {
      const n = IOS_PULSES[kind];
      switchTick();
      for (let i = 1; i < n; i++) window.setTimeout(switchTick, i * IOS_GAP_MS);
      return true;
    }
    if (hasVibrationApi()) return navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* ignore — haptics are best effort */
  }
  return false;
}
