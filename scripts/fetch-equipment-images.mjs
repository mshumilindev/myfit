#!/usr/bin/env node
/**
 * fetch-equipment-images.mjs
 * ---------------------------------------------------------------------------
 * Pulls ONE license-clean photo per equipment item from Wikimedia Commons
 * (only CC0 / Public domain / CC BY / CC BY-SA are accepted), saves it under
 *   client/public/equipment/<id>.<ext>
 * and (re)writes
 *   client/src/data/equipmentImages.generated.ts
 * with a repo-local `thumbUrl` plus the attribution the licence requires.
 *
 * WHY LOCAL FILES: hotlinking Wikimedia thumb URLs is discouraged and the URLs
 * rot; committing the image to the repo makes it stable and offline-friendly.
 *
 * REQUIREMENTS: Node 18+ (global fetch) and a network that can reach
 * commons.wikimedia.org. Some office/gym proxies block Wikimedia — run it from
 * an unrestricted connection.
 *
 * USAGE (from repo root):
 *   node scripts/fetch-equipment-images.mjs            # fill in missing images
 *   node scripts/fetch-equipment-images.mjs --force    # refetch everything
 *   node scripts/fetch-equipment-images.mjs --only barbell-olympic,cardio-rower
 *
 * It is incremental: an id that already has a local image + map entry is
 * skipped unless --force. Safe to re-run.
 * ---------------------------------------------------------------------------
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATALOG = path.join(ROOT, 'client/src/data/equipmentCatalog.ts');
const OUT_DIR = path.join(ROOT, 'client/public/equipment');
const OUT_MAP = path.join(ROOT, 'client/src/data/equipmentImages.generated.ts');
const UA = 'SpotterGymTracker/1.0 (equipment catalog images; +https://github.com/) node-fetch';

const ACCEPT_LICENSE = [
  /^cc0/i,
  /^cc-?0/i,
  /public domain/i,
  /^pd/i,
  /^cc[\s-]?by([\s-]?sa)?([\s-]?\d)/i, // CC BY / CC BY-SA (any version)
];
const REJECT_LICENSE = [/nc/i, /nd/i, /fair use/i, /non-?free/i]; // no NC/ND/non-free

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = (() => {
  const i = args.indexOf('--only');
  return i >= 0 && args[i + 1] ? new Set(args[i + 1].split(',').map((s) => s.trim())) : null;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Parse id / name / category out of the catalog source (no TS import needed). */
function parseCatalog() {
  const src = fs.readFileSync(CATALOG, 'utf8');
  const re =
    /\{[^{}]*?id:\s*'([^']+)'[^{}]*?name:\s*'((?:[^'\\]|\\.)*)'[^{}]*?category:\s*'([^']+)'[^{}]*?\}/gs;
  const out = [];
  let m;
  while ((m = re.exec(src)))
    out.push({ id: m[1], name: m[2].replace(/\\'/g, "'"), category: m[3] });
  return out;
}

/** Build a decent Commons search query from the item name. */
function queryFor({ name, category }) {
  const base = name
    .replace(/\(.*?\)/g, ' ') // drop parenthetical notes
    .replace(/[/,].*$/, ' ') // keep the first variant before / or ,
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();
  const catWord =
    { cardio: 'exercise machine', machine: 'gym machine', plateLoaded: 'gym machine' }[category] ||
    'gym';
  return `${base} ${catWord}`.replace(/\s+/g, ' ').trim();
}

async function api(params) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function licenseOk(short) {
  if (!short) return false;
  if (REJECT_LICENSE.some((r) => r.test(short))) return false;
  return ACCEPT_LICENSE.some((r) => r.test(short));
}

function stripHtml(s) {
  return (s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Find the best acceptable image for a query; returns metadata or null. */
async function findImage(q) {
  const data = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${q}`,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '800',
  });
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  // search order preserved via index
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    if (ii.mime && !/^image\/(jpeg|png)$/.test(ii.mime)) continue;
    const em = ii.extmetadata || {};
    const license = stripHtml(em.LicenseShortName?.value);
    if (!licenseOk(license)) continue;
    if ((ii.width || 0) < 300) continue; // skip tiny/icon files
    return {
      title: p.title,
      thumburl: ii.thumburl,
      pageUrl: ii.descriptionurl,
      license,
      author: stripHtml(em.Artist?.value) || '',
    };
  }
  return null;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`img ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error('too small');
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function loadExistingMap() {
  if (!fs.existsSync(OUT_MAP)) return {};
  const src = fs.readFileSync(OUT_MAP, 'utf8');
  const m = src.match(/EQUIPMENT_IMAGES[^=]*=\s*(\{[\s\S]*\});/);
  if (!m) return {};
  try {
    // turn the TS object literal into JSON-ish (keys already quoted or simple)
    return eval('(' + m[1] + ')');  
  } catch {
    return {};
  }
}

function writeMap(map) {
  const keys = Object.keys(map).sort();
  const body = keys
    .map((k) => {
      const v = map[k];
      const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `  '${k}': { thumbUrl: '${esc(v.thumbUrl)}', pageUrl: '${esc(v.pageUrl)}', license: '${esc(v.license)}', author: '${esc(v.author)}' },`;
    })
    .join('\n');
  const out = `/**
 * AUTO-GENERATED by scripts/fetch-equipment-images.mjs — do not edit by hand.
 * ${keys.length} equipment images, sourced from Wikimedia Commons (CC/PD).
 * \`thumbUrl\` is repo-local (served from /equipment/...); pageUrl/author/license
 * carry the attribution the licence requires.
 */
import type { EquipmentImage } from './equipmentCatalog';

export const EQUIPMENT_IMAGES: Record<string, EquipmentImage> = {
${body}
};
`;
  fs.writeFileSync(OUT_MAP, out);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let items = parseCatalog();
  if (ONLY) items = items.filter((i) => ONLY.has(i.id));
  const map = FORCE ? {} : loadExistingMap();

  let done = 0,
    skipped = 0,
    failed = 0;
  const fails = [];
  for (const item of items) {
    const localName = `${item.id}.jpg`;
    const localPath = path.join(OUT_DIR, localName);
    if (!FORCE && map[item.id] && fs.existsSync(localPath)) {
      skipped++;
      continue;
    }
    const q = queryFor(item);
    try {
      const hit = await findImage(q);
      if (!hit || !hit.thumburl) {
        failed++;
        fails.push(`${item.id} (no CC image for "${q}")`);
        await sleep(250);
        continue;
      }
      const ext = /\.png($|\?)/i.test(hit.thumburl) ? 'png' : 'jpg';
      const fname = `${item.id}.${ext}`;
      await download(hit.thumburl, path.join(OUT_DIR, fname));
      map[item.id] = {
        thumbUrl: `/equipment/${fname}`,
        pageUrl: hit.pageUrl || '',
        license: hit.license || '',
        author: hit.author || '',
      };
      done++;
      process.stdout.write(`\r✓ ${item.id}  (${done} fetched, ${skipped} kept, ${failed} miss)   `);
      writeMap(map); // checkpoint after each success
      await sleep(300); // be polite to the API
    } catch (e) {
      failed++;
      fails.push(`${item.id}: ${e.message}`);
      await sleep(300);
    }
  }
  writeMap(map);
  console.log(`\n\nDone. fetched=${done} kept=${skipped} missed=${failed} total=${items.length}`);
  if (fails.length) {
    console.log(
      '\nItems without an image (no clean Commons match — fine to leave blank or add manually):',
    );
    for (const f of fails) console.log('  - ' + f);
  }
  console.log(`\nWrote ${Object.keys(map).length} entries -> ${path.relative(ROOT, OUT_MAP)}`);
  console.log(
    'Review attribution, then: git add client/public/equipment client/src/data/equipmentImages.generated.ts',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
