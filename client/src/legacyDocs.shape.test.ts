// @vitest-environment node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LEGACY_DOCS } from './__fixtures__/legacyDocs';

/**
 * SPO-65 AC3: the old-version documents are frozen. Their shape (every key path and value type) is locked in
 * `__fixtures__/legacyDocs.shape.json`, so a fixture cannot be quietly edited to follow a schema change: the reader and
 * migration tests would then keep passing on a document no old app ever wrote. A deliberate change of the locked shape
 * means the schema changed — keep the old fixture and add the new form next to it. Regenerate on purpose with
 * `UPDATE_LEGACY_SHAPE=1 npx vitest run src/legacyDocs.shape.test.ts`.
 */
const SHAPE_FILE = fileURLToPath(new URL('./__fixtures__/legacyDocs.shape.json', import.meta.url));

type Json = unknown;
function shapeOf(v: Json, path = '', out: Record<string, string> = {}): Record<string, string> {
  if (Array.isArray(v)) {
    out[path || '$'] = 'array';
    // every element contributes: an array of differently shaped items is one shape per index-agnostic path
    for (const item of v) shapeOf(item, `${path}[]`, out);
  } else if (v !== null && typeof v === 'object') {
    out[path || '$'] = 'object';
    for (const [k, x] of Object.entries(v as Record<string, Json>))
      shapeOf(x, path ? `${path}.${k}` : k, out);
  } else {
    const t = v === null ? 'null' : typeof v;
    const prev = out[path];
    out[path] = prev && prev !== t && !prev.split('|').includes(t) ? `${prev}|${t}` : t;
  }
  return out;
}

const current = () =>
  Object.fromEntries(
    Object.entries(LEGACY_DOCS)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([c, [id, doc]]) => [c, { id, shape: shapeOf(doc) }]),
  );

describe('legacy fixture shapes are frozen (SPO-65)', () => {
  it('matches the locked shape of every collection', () => {
    if (process.env.UPDATE_LEGACY_SHAPE === '1' || !existsSync(SHAPE_FILE)) {
      writeFileSync(SHAPE_FILE, `${JSON.stringify(current(), null, 2)}\n`);
    }
    const locked = JSON.parse(readFileSync(SHAPE_FILE, 'utf8')) as ReturnType<typeof current>;
    expect(current()).toEqual(locked);
  });

  it('shapeOf notices an added, removed, renamed or retyped field', () => {
    const base = { a: 1, b: { c: 'x' }, d: [{ e: true }] };
    const s = shapeOf(base);
    expect(shapeOf({ ...base, extra: 1 })).not.toEqual(s);
    expect(shapeOf({ b: base.b, d: base.d })).not.toEqual(s);
    expect(shapeOf({ ...base, a: '1' })).not.toEqual(s);
    expect(shapeOf({ ...base, b: { cc: 'x' } })).not.toEqual(s);
    expect(shapeOf({ ...base, d: [{ e: 1 }] })).not.toEqual(s);
  });
});
