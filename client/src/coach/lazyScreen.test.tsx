import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { isChunkLoadError, lazyScreen, resetLazyScreens } from './lazyScreen';

afterEach(cleanup);

describe('lazyScreen', () => {
  it('imports the chunk again after a failure once the screens are reset', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi
      .fn<() => Promise<{ default: () => React.ReactNode }>>()
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
      .mockResolvedValue({ default: () => <p>Loaded screen</p> });
    const Screen = lazyScreen(load);
    const tree = (key: number) => (
      <ErrorBoundary title="Failed" body="b" retryLabel="r" resetKey={key}>
        <Suspense fallback={<p>Loading</p>}>
          <Screen />
        </Suspense>
      </ErrorBoundary>
    );
    const { rerender } = render(tree(0));
    expect(await screen.findByText('Failed')).toBeTruthy();
    resetLazyScreens();
    rerender(tree(1));
    expect(await screen.findByText('Loaded screen')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('knows a chunk-load error by its message', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: x'))).toBe(
      true,
    );
    expect(isChunkLoadError(new Error('boom'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
  });
});
