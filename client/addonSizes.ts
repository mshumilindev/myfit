/**
 * Real download size of each add-on, measured on every production build (owner 10.11): when an add-on's screens change, the
 * next build recomputes it. Emits `addon-sizes.json` ({ [addonId]: gzipBytes }) next to the app; the store reads it.
 *
 * Size = gzip of the chunks (JS + CSS) its entry screens import statically (what loads on first open) minus the chunks the
 * app shell already loads. Shared chunks count for every add-on that needs them. Modules live inside their app's chunks.
 */
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import entries from './src/addons/sizeEntries.json';

export interface ChunkNode {
  /** Chunks it imports statically (by file name). */
  imports: string[];
  /** Source files (relative to the client root, `/` separators) bundled in it. */
  sources: string[];
  isEntry: boolean;
  /** gzip bytes of its JS plus its CSS. */
  bytes: number;
}

/** Pure: the per-add-on sizes from a chunk graph. Throws when an entry screen is in no chunk (a renamed screen must be noticed). */
export function computeAddonSizes(
  graph: Readonly<Record<string, ChunkNode>>,
  entryMap: Readonly<Record<string, readonly string[]>>,
): Record<string, number> {
  const closure = (roots: Iterable<string>): Set<string> => {
    const seen = new Set<string>();
    const walk = (k: string) => {
      if (!graph[k] || seen.has(k)) return;
      seen.add(k);
      graph[k].imports.forEach(walk);
    };
    for (const r of roots) walk(r);
    return seen;
  };
  const shell = closure(Object.keys(graph).filter((k) => graph[k].isEntry));
  const out: Record<string, number> = {};
  for (const [id, srcs] of Object.entries(entryMap)) {
    const roots = srcs.map((s) => {
      const hit = Object.keys(graph).find((k) => graph[k].sources.includes(s));
      if (!hit) throw new Error(`addon-sizes: ${id}: ${s} is in no chunk`);
      return hit;
    });
    let bytes = 0;
    for (const k of closure(roots)) if (!shell.has(k)) bytes += graph[k].bytes;
    out[id] = bytes;
  }
  return out;
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
      const graph: Record<string, ChunkNode> = {};
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue;
        let bytes = gz(item.code);
        for (const css of item.viteMetadata?.importedCss ?? []) {
          const a = bundle[css];
          if (a?.type === 'asset') bytes += gz(a.source);
        }
        graph[item.fileName] = {
          imports: item.imports,
          sources: Object.keys(item.modules).map((m) => relative(root, m).replace(/\\/g, '/')),
          isEntry: item.isEntry,
          bytes,
        };
      }
      const sizes = computeAddonSizes(graph, entries);
      this.emitFile({
        type: 'asset',
        fileName: 'addon-sizes.json',
        source: JSON.stringify(sizes),
      });
    },
  };
}
