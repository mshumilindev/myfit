/**
 * Real download size of each add-on, measured on every production build (owner 10.11): when an add-on's screens change, the
 * next build recomputes it. Emits `addon-sizes.json` ({ [addonId]: gzipBytes }) next to the app; the store reads it.
 *
 * Size = the add-on's own code (by source path, see sizeEntries.json), its share of the gzip of every chunk it sits in.
 */
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import entries from './src/addons/sizeEntries.json';

export interface SizeChunk {
  /** gzip bytes of the chunk's JS plus its CSS. */
  bytes: number;
  /** Rendered length of each module in it, keyed by its path relative to `src/` (`/` separators). */
  modules: Readonly<Record<string, number>>;
}
export interface SizePart {
  /** Path prefixes under `src/`: a directory (`coach/notes/`) or a file stem (`sleep` = sleep.ts, sleepGuard.ts). */
  js?: readonly string[];
  /** Plain CSS files (themes), gzip of the file itself. */
  css?: readonly string[];
}

/**
 * Pure. An add-on's size = its share of every chunk it has code in: the chunk's gzip bytes times the add-on's share of the
 * chunk's rendered code. A module belongs to the add-on with the LONGEST matching prefix, so parts never overlap and an app's
 * number is its own code, not its modules'. Theme parts are their CSS files. Throws when a part matches no module (a renamed
 * or moved file must be noticed, not silently measured as zero).
 */
export function computeAddonSizes(
  chunks: readonly SizeChunk[],
  parts: Readonly<Record<string, SizePart>>,
  cssBytes: (file: string) => number = () => 0,
): Record<string, number> {
  const prefixes = Object.entries(parts).flatMap(([id, p]) => (p.js ?? []).map((x) => ({ id, x })));
  const owner = (path: string): string | undefined =>
    prefixes.filter((p) => path.startsWith(p.x)).sort((a, b) => b.x.length - a.x.length)[0]?.id;
  const out: Record<string, number> = Object.fromEntries(Object.keys(parts).map((id) => [id, 0]));
  const hit = new Set<string>();
  for (const c of chunks) {
    const total = Object.values(c.modules).reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    for (const [path, len] of Object.entries(c.modules)) {
      const id = owner(path);
      if (!id) continue;
      out[id] += (c.bytes * len) / total;
      for (const p of prefixes) if (p.id === id && path.startsWith(p.x)) hit.add(`${id}:${p.x}`);
    }
  }
  for (const p of prefixes) {
    if (!hit.has(`${p.id}:${p.x}`))
      throw new Error(`addon-sizes: ${p.id}: "${p.x}" matches no module`);
  }
  for (const [id, p] of Object.entries(parts)) {
    for (const f of p.css ?? []) out[id] += cssBytes(f);
  }
  return Object.fromEntries(Object.entries(out).map(([id, v]) => [id, Math.round(v)]));
}

export function addonSizes(): Plugin {
  let root = process.cwd();
  return {
    name: 'spotter-addon-sizes',
    configResolved(c) {
      root = c.root;
    },
    /**
     * Dev server: no chunks exist in dev and a measuring build inside the dev server ate 26 GB of RAM (10.11), so dev never
     * builds. It serves the file of the last `npm run build` (dist/addon-sizes.json) when there is one; otherwise no size shows.
     */
    configureServer(server) {
      server.middlewares.use('/addon-sizes.json', (_req, res) => {
        const file = join(root, 'dist', 'addon-sizes.json');
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('content-type', 'application/json');
        res.end(readFileSync(file));
      });
    },
    generateBundle(_, bundle) {
      const gz = (s: string | Uint8Array) => gzipSync(s, { level: 9 }).length;
      const src = join(root, 'src');
      const chunks: SizeChunk[] = [];
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue;
        // The main-thread Atlas knowledge base exists only for browsers without module workers (the service worker skips it).
        if (item.fileName.startsWith('assets/atlas-kb-')) continue;
        let bytes = gz(item.code);
        for (const css of item.viteMetadata?.importedCss ?? []) {
          const a = bundle[css];
          if (a?.type === 'asset') bytes += gz(a.source);
        }
        const modules: Record<string, number> = {};
        for (const [id, m] of Object.entries(item.modules)) {
          modules[relative(src, id).replace(/\\/g, '/')] = m.renderedLength;
        }
        chunks.push({ bytes, modules });
      }
      // Only the app's own build: Storybook and other builds reuse this config but have none of the app's modules.
      if (!chunks.some((c) => 'main.tsx' in c.modules)) return;
      const sizes = computeAddonSizes(chunks, entries as Record<string, SizePart>, (f) =>
        gz(readFileSync(join(src, f))),
      );
      this.emitFile({ type: 'asset', fileName: 'addon-sizes.json', source: JSON.stringify(sizes) });
    },
  };
}
