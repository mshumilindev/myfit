import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const preload = readFileSync('desktop/src/preload.ts', 'utf8');
const shared = readFileSync('desktop/src/shared.ts', 'utf8');

describe('desktop preload (sandbox: true)', () => {
  it('requires nothing but electron: a relative import breaks the bridge in the sandbox', () => {
    const imports = [...preload.matchAll(/^import[^;]*?from\s+['"]([^'"]+)['"]/gms)].map(
      (m) => m[1],
    );
    expect(imports).toEqual(['electron']);
  });

  it('keeps the inlined channels and bridge version equal to shared.ts', () => {
    const grab = (src: string) => [...src.matchAll(/'(spotter:[a-z-]+)'/g)].map((m) => m[1]);
    expect(grab(preload)).toEqual(grab(shared));
    const ver = (src: string) => /BRIDGE_VERSION = (\d+)/.exec(src)?.[1];
    expect(ver(preload)).toBe(ver(shared));
  });
});
