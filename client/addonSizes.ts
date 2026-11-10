/**
 * Real download size of each add-on, measured on every production build (owner 10.11): when an add-on's screens change, the
 * next build recomputes it. Emits `addon-sizes.json` ({ [addonId]: gzipBytes }) next to the app; the store reads it.
 *
 * Size = gzip of the chunks (JS + CSS) its entry screens import statically (what loads on first open) minus the chunks the
 * app shell already loads. Shared chunks count for every add-on that needs them. Modules live inside their app's chunks.
 */
import { gzipSync } from 'node:zlib';
import { relative } from 'node:path';
import { build, type Plugin } from 'vite';
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

/** The last measurement of this process: a build sets it; the dev server serves it (`/addon-sizes.json`). */
let measured: Record<string, number> | null = null;

export function addonSizes(): Plugin {
  let root = process.cwd();
  return {
    name: 'spotter-addon-sizes',
    configResolved(c) {
      root = c.root;
    },
    /**
     * Dev server: there are no chunks in dev, so it measures with a silent in-memory production build (once at start, and again
     * a minute after the last source change), and serves the result at the same URL the built app reads.
     */
    configureServer(server) {
      let running = false;
      let failure = '';
      let timer: ReturnType<typeof setTimeout> | undefined;
      const run = async () => {
        if (running) return;
        running = true;
        failure = '';
        try {
          await build({
            configFile: server.config.configFile,
            mode: 'production',
            logLevel: 'silent',
            build: { write: false },
          });
        } catch (e) {
          // A broken source file mid-edit: keep the last measurement and say why there is none (read at the URL below).
          failure = e instanceof Error ? e.message : String(e);
        } finally {
          running = false;
        }
      };
      server.middlewares.use('/addon-sizes.json', (_req, res) => {
        if (!measured) {
          res.statusCode = 404;
          res.end(failure || (running ? 'measuring' : ''));
          return;
        }
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(measured));
      });
      void run();
      server.watcher.on('change', (f) => {
        if (!f.replace(/\\/g, '/').includes('/src/')) return;
        clearTimeout(timer);
        timer = setTimeout(() => void run(), 60_000);
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
      measured = computeAddonSizes(graph, entries);
      this.emitFile({
        type: 'asset',
        fileName: 'addon-sizes.json',
        source: JSON.stringify(measured),
      });
    },
  };
}
