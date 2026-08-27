import { mkdir, writeFile, access, readdir, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import prettier from 'prettier';

const SOURCE_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const ROOT = process.cwd();
const OUT_JSON = path.join(ROOT, 'client/src/data/exercises.rich.json');
const OUT_IMAGES = path.join(ROOT, 'client/public/exercise-img');

const MUSCLE_MAP = new Map([
  // Finer mapping (matches the expanded MuscleGroup union). "middle back" folds
  // into traps — the body-muscles library has no distinct rhomboid region.
  ['lats', ['lats']],
  ['traps', ['traps']],
  ['middle back', ['traps']],
  ['lower back', ['lower_back']],
  ['abdominals', ['core']],
  ['quadriceps', ['quads']],
  ['adductors', ['adductors']],
  ['abductors', ['abductors']],
  ['neck', ['neck']],
  ['chest', ['chest']],
  ['shoulders', ['shoulders']],
  ['biceps', ['biceps']],
  ['triceps', ['triceps']],
  ['forearms', ['forearms']],
  ['glutes', ['glutes']],
  ['hamstrings', ['hamstrings']],
  ['calves', ['calves']],
]);

const EQUIPMENT_MAP = new Map([
  ['body only', 'body'],
  ['e-z curl bar', 'ezBar'],
  ['medicine ball', 'medicineBall'],
  ['exercise ball', 'exerciseBall'],
  ['foam roll', 'foamRoll'],
  ['kettlebells', 'kettlebell'],
  ['barbell', 'barbell'],
  ['dumbbell', 'dumbbell'],
  ['cable', 'cable'],
  ['machine', 'machine'],
  ['bands', 'bands'],
  ['other', 'other'],
]);

const VALID_FORCES = new Set(['push', 'pull', 'static']);
const VALID_LEVELS = new Set(['beginner', 'intermediate', 'expert']);
const VALID_MECHANICS = new Set(['compound', 'isolation']);
const VALID_CATEGORIES = new Set([
  'strength',
  'stretching',
  'plyometrics',
  'strongman',
  'powerlifting',
  'cardio',
  'olympic weightlifting',
]);

function unique(xs) {
  return [...new Set(xs.filter(Boolean))];
}

function mapMuscles(values, unmapped) {
  const mapped = [];
  for (const value of values ?? []) {
    const key = String(value).trim().toLowerCase();
    if (!key) continue;
    const hit = MUSCLE_MAP.get(key);
    if (!hit) {
      unmapped.add(key);
      continue;
    }
    mapped.push(...hit);
  }
  return unique(mapped);
}

function mapEquipment(value, unmapped) {
  if (value == null || value === 'unknown') return null;
  const key = String(value).trim().toLowerCase();
  if (!key) return null;
  const hit = EQUIPMENT_MAP.get(key);
  if (!hit) unmapped.add(key);
  return hit ?? null;
}

function cleanEnum(value, valid) {
  if (value == null) return null;
  const key = String(value).trim().toLowerCase();
  return valid.has(key) ? key : null;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(relativePath, localPath) {
  if (await exists(localPath)) return false;
  const url = `${IMAGE_BASE}${relativePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image ${res.status}: ${url}`);
  await mkdir(path.dirname(localPath), { recursive: true });
  const bytes = new Uint8Array(await res.arrayBuffer());
  await writeFile(localPath, bytes);
  return true;
}

async function ensureImageDir(id) {
  await mkdir(OUT_IMAGES, { recursive: true });
  const wanted = path.join(OUT_IMAGES, id);
  const entries = await readdir(OUT_IMAGES, { withFileTypes: true });
  const existing = entries.find(
    (entry) => entry.isDirectory() && entry.name.toLowerCase() === id.toLowerCase(),
  );
  if (existing && existing.name !== id) {
    const current = path.join(OUT_IMAGES, existing.name);
    const tmp = path.join(OUT_IMAGES, `${id}.__case_tmp_${Date.now()}`);
    await rename(current, tmp);
    await rename(tmp, wanted);
  } else {
    await mkdir(wanted, { recursive: true });
  }
  return wanted;
}

function normalizeRecord(raw, unmappedMuscles, unmappedEquipment) {
  const name = String(raw.name ?? '').trim();
  const id = String(raw.id ?? '').trim();
  const category = cleanEnum(raw.category, VALID_CATEGORIES);
  const primaryMuscles = mapMuscles(raw.primaryMuscles, unmappedMuscles);
  const secondaryMuscles = mapMuscles(raw.secondaryMuscles, unmappedMuscles).filter(
    (m) => !primaryMuscles.includes(m),
  );
  const images = (raw.images ?? []).map((img, idx) => `/exercise-img/${id}/${idx}.jpg`);

  return {
    id,
    name,
    force: cleanEnum(raw.force, VALID_FORCES),
    level: cleanEnum(raw.level, VALID_LEVELS),
    mechanic: cleanEnum(raw.mechanic, VALID_MECHANICS),
    category,
    equipment: mapEquipment(raw.equipment, unmappedEquipment),
    primaryMuscles,
    secondaryMuscles,
    instructions: (raw.instructions ?? []).map((s) => String(s).trim()).filter(Boolean),
    images,
    _rawImages: raw.images ?? [],
  };
}

async function main() {
  const unmappedMuscles = new Set();
  const unmappedEquipment = new Set();

  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`source ${res.status}: ${SOURCE_URL}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error('Expected source JSON to be an array');

  let downloaded = 0;
  let reused = 0;
  const rich = [];
  const expectedImageDirs = new Set();
  for (const item of raw) {
    const rec = normalizeRecord(item, unmappedMuscles, unmappedEquipment);
    expectedImageDirs.add(rec.id);
    const imageDir = await ensureImageDir(rec.id);
    for (let i = 0; i < rec._rawImages.length; i++) {
      const localPath = path.join(imageDir, `${i}.jpg`);
      const didDownload = await downloadImage(rec._rawImages[i], localPath);
      if (didDownload) downloaded++;
      else reused++;
    }
    delete rec._rawImages;
    rich.push(rec);
  }

  rich.sort((a, b) => a.name.localeCompare(b.name));
  const prettierConfig = (await prettier.resolveConfig(OUT_JSON)) ?? {};
  await writeFile(
    OUT_JSON,
    await prettier.format(JSON.stringify(rich), { ...prettierConfig, filepath: OUT_JSON }),
  );

  let removedStaleDirs = 0;
  if (await exists(OUT_IMAGES)) {
    for (const entry of await readdir(OUT_IMAGES, { withFileTypes: true })) {
      if (entry.isDirectory() && !expectedImageDirs.has(entry.name)) {
        await rm(path.join(OUT_IMAGES, entry.name), { recursive: true, force: true });
        removedStaleDirs++;
      }
    }
  }

  const withForce = rich.filter((r) => r.force).length;
  const withMechanic = rich.filter((r) => r.mechanic).length;
  const withInstructions = rich.filter((r) => r.instructions.length > 0).length;
  const withImages = rich.filter((r) => r.images.length > 0).length;

  console.log(`rich exercises: ${rich.length}`);
  console.log(`with force: ${withForce}`);
  console.log(`with mechanic: ${withMechanic}`);
  console.log(`with instructions: ${withInstructions}`);
  console.log(`with images: ${withImages}`);
  console.log(`images downloaded: ${downloaded}`);
  console.log(`images reused: ${reused}`);
  console.log(`stale image dirs removed: ${removedStaleDirs}`);
  console.log(
    `unmapped muscles: ${unmappedMuscles.size ? [...unmappedMuscles].sort().join(', ') : 'none'}`,
  );
  console.log(
    `unmapped equipment: ${
      unmappedEquipment.size ? [...unmappedEquipment].sort().join(', ') : 'none'
    }`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
