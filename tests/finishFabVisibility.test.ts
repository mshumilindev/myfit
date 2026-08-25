import { describe, expect, it } from 'vitest';
import { rectHasVisiblePixels } from '../client/src/views/SessionView';

const viewport = { width: 390, height: 844 };

describe('mobile session finish FAB visibility', () => {
  it('hides the floating finish button when any inline finish pixels are visible', () => {
    expect(rectHasVisiblePixels({ top: 843, right: 360, bottom: 889, left: 30 }, viewport)).toBe(
      true,
    );
    expect(rectHasVisiblePixels({ top: -45, right: 360, bottom: 1, left: 30 }, viewport)).toBe(
      true,
    );
  });

  it('shows the floating finish button only after the inline finish is fully off-screen', () => {
    expect(rectHasVisiblePixels({ top: 844, right: 360, bottom: 890, left: 30 }, viewport)).toBe(
      false,
    );
    expect(rectHasVisiblePixels({ top: -46, right: 360, bottom: 0, left: 30 }, viewport)).toBe(
      false,
    );
  });
});
