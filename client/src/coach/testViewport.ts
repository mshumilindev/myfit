/** Test helper: a `matchMedia` that evaluates (min|max)-width queries against a chosen viewport width. */
export function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  const test = (q: string): boolean => {
    const min = /\(min-width:\s*([\d.]+)px\)/.exec(q);
    const max = /\(max-width:\s*([\d.]+)px\)/.exec(q);
    return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
  };
  window.matchMedia = ((q: string) => ({
    matches: test(q),
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
