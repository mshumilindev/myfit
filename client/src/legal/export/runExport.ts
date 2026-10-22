/**
 * Builds the export ZIP on this device (SPO-295 N6). Category by category: build, serialize in slices (yielding to the UI),
 * add to the archive, report progress. Only the requested categories are read. Can be cancelled between slices.
 */
import { buildCategory } from './buildCategory';
import {
  EXPORT_CATEGORIES,
  FORMAT_VERSION,
  exportBaseName,
  type ExportCategory,
  type ExportSources,
} from './exportModel';
import {
  CATEGORY_TITLE,
  REASON_TEXT,
  categoryReadme,
  rootReadme,
  type Manifest,
  type ManifestCategory,
} from './readme';
import { contentToText, nextTurn, type Tick } from './serialize';
import { ZipWriter } from './zip';

export type ExportProgress =
  { id: ExportCategory; state: 'working' | 'done' } | { id: null; state: 'packing' };

export interface RunExportOptions {
  categories: readonly ExportCategory[];
  sources: ExportSources;
  now?: Date;
  onProgress?: (p: ExportProgress) => void;
  signal?: AbortSignal;
  /** tests */
  tick?: Tick;
}

export interface ExportResult {
  filename: string;
  manifest: Manifest;
  blob: Blob;
  /** The raw archive parts (tests). */
  parts: Uint8Array[];
}

export class ExportAborted extends Error {
  constructor() {
    super('export cancelled');
  }
}

export async function runExport(o: RunExportOptions): Promise<ExportResult> {
  const now = o.now ?? new Date();
  const tick = o.tick ?? nextTurn;
  const asked = EXPORT_CATEGORIES.filter((c) => o.categories.includes(c));
  const base = exportBaseName(now);
  const stamp = now.toISOString();
  const zip = new ZipWriter(now);
  const enc = new TextEncoder();
  const cats: ManifestCategory[] = [];
  const check = () => {
    if (o.signal?.aborted) throw new ExportAborted();
  };

  for (const id of asked) {
    check();
    o.onProgress?.({ id, state: 'working' });
    await tick();
    const r = buildCategory(id, o.sources, stamp);
    const mc: ManifestCategory = {
      id,
      title: CATEGORY_TITLE[id],
      files: [],
      notIncluded: r.missing.map((m) => ({ ...m, message: REASON_TEXT[m.reason] })),
    };
    for (const f of r.files) {
      check();
      const text = await contentToText(f.content, tick);
      // CSV only: a byte order mark makes Excel read the file as UTF-8 (names, accents). JSON stays BOM-free.
      const bytes = enc.encode(f.content.kind === 'csv' ? `\uFEFF${text}` : text);
      const path = `${id}/${f.name}`;
      zip.add(`${base}/${path}`, bytes);
      mc.files.push({
        path,
        about: f.about,
        bytes: bytes.length,
        ...(f.rows !== undefined ? { rows: f.rows } : {}),
      });
    }
    zip.add(`${base}/${id}/README.txt`, categoryReadme(mc));
    cats.push(mc);
    o.onProgress?.({ id, state: 'done' });
    await tick();
  }

  check();
  o.onProgress?.({ id: null, state: 'packing' });
  const manifest: Manifest = {
    format: FORMAT_VERSION,
    generatedAt: stamp,
    builtOn: 'this device',
    encrypted: false,
    deviceCopyOnly: !o.sources.storeSynced,
    categories: cats,
    notRequested: EXPORT_CATEGORIES.filter((c) => !asked.includes(c)),
  };
  zip.add(`${base}/README.txt`, rootReadme(manifest));
  zip.add(`${base}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  await tick();
  return { filename: `${base}.zip`, manifest, blob: zip.toBlob(), parts: zip.toParts() };
}
