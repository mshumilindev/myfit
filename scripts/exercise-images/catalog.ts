/**
 * The exercise catalog as the pipeline sees it. Source of truth is the bundled
 * free-exercise-db data the app already ships (there is no exercises table):
 *   client/src/data/exercises.rich.json          id, name, muscles, equipment, images
 *   client/src/data/exercises.instructions.json  step text (body position cues)
 *   client/src/data/exerciseNames.generated.json localized aliases
 * Reference photos live at client/public<images[i]> (0.jpg = start, 1.jpg = end)
 * and are treated as immutable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, REPO_ROOT, type ImageState } from './config';
import { paletteKeyFor, type PaletteKey } from './palette';

export interface RawExercise {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  category: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  images: string[];
}

export type BodyPosition =
  | 'standing'
  | 'seated'
  | 'lying-flat'
  | 'lying-incline'
  | 'lying-decline'
  | 'prone'
  | 'kneeling'
  | 'hanging'
  | 'supported'
  | 'unknown';

export interface CatalogExercise {
  id: string;
  /** kebab-case slug of the name — accepted on the CLI alongside the id. */
  slug: string;
  name: string;
  aliases: string[];
  category: string | null;
  equipment: string | null;
  force: string | null;
  mechanic: string | null;
  level: string | null;
  primary: string | null;
  secondary: string[];
  bodyPosition: BodyPosition;
  unilateral: boolean;
  instructions: string[];
  paletteKey: PaletteKey;
  /** Absolute paths of the immutable reference frames by state. */
  references: Partial<Record<ImageState, string>>;
  /** Public URLs as stored in the catalog (for the manifest / traceability). */
  referenceUrls: string[];
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const UNILATERAL =
  /\b(one[- ]arm|single[- ]arm|one[- ]leg|single[- ]leg|unilateral|alternat\w*|one[- ]handed)\b/i;

/** Unilateral from the name first, then the start-position cue. */
export function detectUnilateral(name: string, instructions: string[]): boolean {
  if (UNILATERAL.test(name)) return true;
  const first = instructions.slice(0, 2).join(' ');
  return /\b(one arm|single arm|one leg|single leg)\b/i.test(first);
}

/**
 * Body position from the name, then the first instruction steps (the
 * free-exercise-db text reliably describes the starting position there).
 */
export function detectBodyPosition(name: string, instructions: string[]): BodyPosition {
  const n = name.toLowerCase();
  const txt = `${n} ${instructions.slice(0, 2).join(' ').toLowerCase()}`;
  if (/\bincline\b/.test(n) && /\b(press|fly|flye|bench|curl|row)\b/.test(n))
    return 'lying-incline';
  if (/\bdecline\b/.test(n)) return 'lying-decline';
  if (/\b(hang|hanging|pull-?ups?|chin-?ups?)\b/.test(n)) return 'hanging';
  if (/\b(seated|sitting)\b/.test(n)) return 'seated';
  if (/\bkneeling\b/.test(n)) return 'kneeling';
  if (/\b(lying|bench press|floor press|skullcrusher|pullover)\b/.test(n)) return 'lying-flat';
  if (/\b(lie face down|face down|prone)\b/.test(txt)) return 'prone';
  if (/\b(lie (down|back|flat)|lie on|lying)\b/.test(txt)) return 'lying-flat';
  if (/\b(sit (down|on)|seated|sitting)\b/.test(txt)) return 'seated';
  if (/\b(kneel)\b/.test(txt)) return 'kneeling';
  if (/\b(hang from|grab the (pull-?up )?bar)\b/.test(txt)) return 'hanging';
  if (/\b(stand|standing)\b/.test(txt)) return 'standing';
  return 'unknown';
}

export function loadCatalog(): CatalogExercise[] {
  const raw = JSON.parse(fs.readFileSync(PATHS.catalog, 'utf8')) as RawExercise[];
  const steps = JSON.parse(fs.readFileSync(PATHS.instructions, 'utf8')) as Record<string, string[]>;
  const names = JSON.parse(fs.readFileSync(PATHS.localizedNames, 'utf8')) as Record<
    string,
    Record<string, string>
  >;
  return raw.map((r) => toCatalogExercise(r, steps[r.id] ?? [], names[r.name] ?? {}));
}

export function toCatalogExercise(
  r: RawExercise,
  instructions: string[],
  localized: Record<string, string>,
): CatalogExercise {
  const refs: Partial<Record<ImageState, string>> = {};
  const abs = (u: string) => path.join(REPO_ROOT, 'client/public', u.replace(/^\//, ''));
  if (r.images[0]) {
    refs.start = abs(r.images[0]);
    refs.hero = abs(r.images[0]);
  }
  if (r.images[1]) refs.end = abs(r.images[1]);
  const primary = r.primaryMuscles[0] ?? null;
  return {
    id: r.id,
    slug: slugify(r.name),
    name: r.name,
    aliases: Object.values(localized).filter(Boolean),
    category: r.category,
    equipment: r.equipment,
    force: r.force,
    mechanic: r.mechanic,
    level: r.level,
    primary,
    secondary: r.secondaryMuscles.filter((m) => m !== primary),
    bodyPosition: detectBodyPosition(r.name, instructions),
    unilateral: detectUnilateral(r.name, instructions),
    instructions,
    paletteKey: paletteKeyFor(primary, r.category),
    references: refs,
    referenceUrls: r.images,
  };
}
