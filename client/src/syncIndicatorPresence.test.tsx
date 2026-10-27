import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useHasSyncIndicator, useRegisterSyncIndicator } from './syncIndicatorPresence';

afterEach(cleanup);

function Probe() {
  const has = useHasSyncIndicator();
  return <i data-testid="p">{String(has)}</i>;
}
function Icon() {
  useRegisterSyncIndicator();
  return null;
}

describe('syncIndicatorPresence', () => {
  it('is true only while a header icon is mounted', () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('p').textContent).toBe('false');
    const icon = render(<Icon />);
    expect(getByTestId('p').textContent).toBe('true');
    act(() => icon.unmount());
    expect(getByTestId('p').textContent).toBe('false');
  });
});
