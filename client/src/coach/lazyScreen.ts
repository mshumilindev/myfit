import { createElement, lazy, type ComponentType } from 'react';

const resets = new Set<() => void>();

/**
 * `React.lazy` that can be tried again. A plain lazy component keeps its rejected promise for ever, so "Try again"
 * after a chunk failed to load (a stale dev server, a flaky connection) would throw the same error. The Coach route
 * boundary calls `resetLazyScreens()` on retry; the next render imports the chunk afresh.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen's own props type flows through
export function lazyScreen<C extends ComponentType<any>>(load: () => Promise<{ default: C }>): C {
  let inner = lazy(load);
  resets.add(() => {
    inner = lazy(load);
  });
  const LazyScreen = (props: object) =>
    createElement(inner as unknown as ComponentType<object>, props);
  return LazyScreen as unknown as C;
}

export function resetLazyScreens(): void {
  resets.forEach((r) => r());
}

/** The browser could not fetch or run a code-split chunk (message wording differs per engine). */
export const isChunkLoadError = (e: unknown): boolean =>
  e instanceof Error &&
  /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError/i.test(
    `${e.name} ${e.message}`,
  );
