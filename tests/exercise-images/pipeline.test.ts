// Runs under the shared jsdom setup (tests/setup.ts needs localStorage); the code is Node-only.
/**
 * Exercise image pipeline — pure logic only. Nothing here calls a provider,
 * touches the network or writes into assets/; generation is never run by tests.
 */
import { describe, expect, it } from 'vitest';
import { planApply } from '../../scripts/exercise-images/apply';
import {
  detectBodyPosition,
  detectUnilateral,
  slugify,
  toCatalogExercise,
  type RawExercise,
} from '../../scripts/exercise-images/catalog';
import { loadConfig } from '../../scripts/exercise-images/config';
import {
  classify,
  isRetryableStatus,
  parseRetryAfter,
  ProviderError,
} from '../../scripts/exercise-images/errors';
import { selectExercises, toWorkItems } from '../../scripts/exercise-images/filter';
import { readImageInfo } from '../../scripts/exercise-images/imageInfo';
import {
  decide,
  emptyManifest,
  type Entry,
  type Fingerprint,
  type Manifest,
} from '../../scripts/exercise-images/manifest';
import {
  mix,
  paletteKeyFor,
  readThemeTokens,
  resolvePalette,
} from '../../scripts/exercise-images/palette';
import { PILOT } from '../../scripts/exercise-images/pilot';
import { backoffMs } from '../../scripts/exercise-images/pool';
import { buildPrompt } from '../../scripts/exercise-images/prompt';
import { parseQa, qaPasses } from '../../scripts/exercise-images/qa';
import { PROMPT_VERSION } from '../../scripts/exercise-images/style';
import RICH from '../../client/src/data/exercises.rich.json';

const TOKENS = { '--color-bg': '#16171a', '--color-accent': '#d9a24f' };
const PALETTE = { key: 'chest' as const, wall: '#372122', glow: '#6b3130', words: 'muted oxblood' };

function raw(over: Partial<RawExercise> = {}): RawExercise {
  return {
    id: 'Incline_Dumbbell_Press',
    name: 'Incline Dumbbell Press',
    force: 'push',
    level: 'beginner',
    mechanic: 'compound',
    equipment: 'dumbbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders', 'triceps'],
    instructions: [],
    category: 'strength',
    images: [
      '/exercise-img/Incline_Dumbbell_Press/0.jpg',
      '/exercise-img/Incline_Dumbbell_Press/1.jpg',
    ],
    ...over,
  } as RawExercise;
}

const STEPS = [
  'Lie back on an incline bench with a dumbbell in each hand.',
  'Press the dumbbells up.',
];
const ex = (over: Partial<RawExercise> = {}, steps = STEPS) =>
  toCatalogExercise(raw(over), steps, { uk: 'Жим гантелей на похилій лаві' });

describe('catalog detectors', () => {
  it('slugifies names', () => {
    expect(slugify('Dips - Triceps Version')).toBe('dips-triceps-version');
    expect(slugify('Rock & Roll')).toBe('rock-and-roll');
  });
  it('detects unilateral from the name or the first cues', () => {
    expect(detectUnilateral('One-Arm Dumbbell Row', [])).toBe(true);
    expect(detectUnilateral('Cable Row', ['Grab the handle with one arm.'])).toBe(true);
    expect(detectUnilateral('Barbell Curl', ['Stand up with a barbell.'])).toBe(false);
  });
  it('detects body position', () => {
    expect(detectBodyPosition('Incline Dumbbell Press', [])).toBe('lying-incline');
    expect(detectBodyPosition('Decline Barbell Bench Press', [])).toBe('lying-decline');
    expect(detectBodyPosition('Pullups', [])).toBe('hanging');
    expect(detectBodyPosition('Seated Cable Rows', [])).toBe('seated');
    expect(detectBodyPosition('Lying Leg Curls', [])).toBe('lying-flat');
    expect(detectBodyPosition('Barbell Curl', ['Stand up with your torso upright.'])).toBe(
      'standing',
    );
  });
  it('maps references to start/end and a palette key', () => {
    const e = ex();
    expect(e.references.start).toMatch(
      /client\/public\/exercise-img\/Incline_Dumbbell_Press\/0\.jpg$/,
    );
    expect(e.references.end).toMatch(/1\.jpg$/);
    expect(e.paletteKey).toBe('chest');
    expect(e.secondary).toEqual(['shoulders', 'triceps']);
  });
  it('pilot ids all exist in the catalog', () => {
    const ids = new Set((RICH as { id: string }[]).map((r) => r.id));
    expect(PILOT.length).toBeGreaterThanOrEqual(20);
    expect(PILOT.filter((p) => !ids.has(p.id))).toEqual([]);
  });
});

describe('palette', () => {
  it('reads tokens from CSS', () => {
    expect(readThemeTokens(':root { --color-bg: #16171A; --x: 4px; }')['--color-bg']).toBe(
      '#16171a',
    );
  });
  it('mixes hex colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#16171a', '#d9a24f', 0)).toBe('#16171a');
  });
  it('maps muscles onto palette groups', () => {
    expect(paletteKeyFor('lats', 'strength')).toBe('back');
    expect(paletteKeyFor('quads', 'strength')).toBe('quadriceps');
    expect(paletteKeyFor(null, 'cardio')).not.toBe('chest');
  });
  it('resolves every wall to a dark colour derived from the theme base', () => {
    const p = resolvePalette('chest', { ...TOKENS, '--color-danger': '#e5484d' });
    expect(p.wall).toMatch(/^#[0-9a-f]{6}$/);
    const lum = parseInt(p.wall.slice(1, 3), 16) + parseInt(p.wall.slice(3, 5), 16);
    expect(lum).toBeLessThan(200);
  });
});

describe('prompt builder', () => {
  const base = {
    exercise: ex(),
    state: 'start' as const,
    palette: PALETTE,
    refs: ['exercise' as const],
  };

  it('is deterministic and versioned', () => {
    const a = buildPrompt(base);
    expect(buildPrompt(base).text).toBe(a.text);
    expect(a.version).toBe(PROMPT_VERSION);
  });
  it('keeps the athlete shirtless in shorts and shoes', () => {
    const t = buildPrompt(base).text;
    expect(t).toMatch(/shirtless/i);
    expect(t).toMatch(/shorts/i);
    expect(t).toMatch(/shoes/i);
    expect(t).not.toMatch(/t-shirt|tank top/i);
  });
  it('puts exercise correctness first and carries the incline + colour', () => {
    const t = buildPrompt(base).text;
    expect(t.indexOf('exercise correctness')).toBeLessThan(t.indexOf('visual polish'));
    expect(t).toMatch(/incline/i);
    expect(t).toContain('#372122');
    expect(t).not.toContain('Жим'); // localized aliases stay out of the prompt
  });
  it('flags unilateral vs alternating movements', () => {
    const uni = buildPrompt({
      ...base,
      exercise: ex({ id: 'x', name: 'One-Arm Dumbbell Row' }),
    }).text;
    expect(uni).toMatch(/UNILATERAL/);
    const alt = buildPrompt({
      ...base,
      exercise: ex({ id: 'y', name: 'Alternate Hammer Curl' }),
    }).text;
    expect(alt).toMatch(/ALTERNATING/);
  });
  it('adds identity / pair rules only when those references are attached', () => {
    const plain = buildPrompt(base).text;
    const full = buildPrompt({
      ...base,
      state: 'end',
      refs: ['exercise', 'identity', 'start-frame'],
    }).text;
    expect(full.length).toBeGreaterThan(plain.length);
    expect(full).toMatch(/#2/);
    expect(full).toMatch(/#3/);
  });
  it('appends a QA retry instruction and changes the hash input', () => {
    const t = buildPrompt({ ...base, retryInstruction: 'Bench must be inclined ~30°.' }).text;
    expect(t).toContain('Bench must be inclined ~30°.');
    expect(t).not.toBe(buildPrompt(base).text);
  });
});

describe('selection', () => {
  const list = ['A', 'B', 'C', 'D'].map((id, i) =>
    ex({
      id,
      name: `Ex ${id}`,
      primaryMuscles: [i % 2 ? 'lats' : 'chest'],
      equipment: i < 2 ? 'cable' : 'barbell',
    }),
  );
  it('filters by muscle group, equipment and slices by from/limit', () => {
    expect(
      selectExercises(list, { states: ['start'], muscles: ['back'] }).map((e) => e.id),
    ).toEqual(['B', 'D']);
    expect(
      selectExercises(list, { states: ['start'], equipment: ['cable'] }).map((e) => e.id),
    ).toEqual(['A', 'B']);
    expect(
      selectExercises(list, { states: ['start'], from: 1, limit: 2 }).map((e) => e.id),
    ).toEqual(['B', 'C']);
  });
  it('keeps the pilot order and pairs start/end per exercise', () => {
    const sel = selectExercises(list, { states: ['start', 'end'], pilot: ['C', 'A', 'missing'] });
    expect(sel.map((e) => e.id)).toEqual(['C', 'A']);
    expect(toWorkItems(sel, ['start', 'end']).map((w) => `${w.exercise.id}:${w.state}`)).toEqual([
      'C:start',
      'C:end',
      'A:start',
      'A:end',
    ]);
  });
});

const FP: Fingerprint = {
  promptVersion: 'v1',
  promptHash: 'p',
  referenceHash: 'r',
  exerciseHash: 'e',
  configKey: 'c',
  anchorHash: null,
};

function entry(over: Partial<Entry> = {}): Entry {
  return {
    key: 'A:start',
    exerciseId: 'A',
    slug: 'a',
    name: 'A',
    state: 'start',
    primaryMuscle: 'chest',
    equipment: 'barbell',
    paletteKey: 'chest',
    referenceUrls: [],
    referenceHash: 'r',
    exerciseHash: 'e',
    anchorHash: null,
    configKey: 'c',
    model: 'gpt-image-1',
    promptVersion: 'v1',
    promptHash: 'p',
    prompt: '',
    outputPath: 'assets/exercise-images/generated/A/start.webp',
    sourcePath: null,
    status: 'approved',
    attempts: 1,
    qaAttempts: 1,
    qaStatus: 'passed',
    qa: null,
    qaIssues: [],
    retryInstruction: null,
    error: null,
    manualApproval: null,
    generatedAt: null,
    updatedAt: '',
    ...over,
  };
}

describe('manifest decisions (idempotency)', () => {
  it('skips unchanged approved work and redoes new / failed / interrupted', () => {
    expect(decide(undefined, FP).run).toBe(true);
    expect(decide(entry(), FP).run).toBe(false);
    expect(decide(entry({ status: 'failed' }), FP).run).toBe(true);
    expect(decide(entry({ status: 'generating' }), FP).reason).toBe('interrupted');
  });
  it('redoes on prompt / reference change', () => {
    expect(decide(entry(), { ...FP, promptVersion: 'v2' }).run).toBe(true);
    expect(decide(entry(), { ...FP, referenceHash: 'r2' }).run).toBe(true);
  });
  it('needs an explicit flag for config / anchor-only changes', () => {
    expect(decide(entry(), { ...FP, configKey: 'c2' }).run).toBe(false);
    expect(decide(entry(), { ...FP, anchorHash: 'a' }, { includeConfigChanges: true }).run).toBe(
      true,
    );
  });
  it('treats a new identity anchor as an opt-in change even though the prompt text moves', () => {
    const anchored = { ...FP, anchorHash: 'a', promptHash: 'p-with-identity' };
    expect(decide(entry(), anchored).run).toBe(false);
    expect(decide(entry(), anchored, { includeConfigChanges: true }).run).toBe(true);
    expect(decide(entry({ anchorHash: 'a' }), anchored).reason).toBe('prompt changed');
  });
  it('protects manual approvals and waits on QA rejections', () => {
    const manual = entry({ manualApproval: 'approved' });
    expect(decide(manual, { ...FP, promptHash: 'p2' }).run).toBe(false);
    expect(decide(manual, { ...FP, promptVersion: 'v2' }).run).toBe(true);
    expect(decide(entry({ status: 'rejected' }), FP).run).toBe(false);
    expect(decide(entry({ status: 'rejected' }), FP, { retryRejected: true }).run).toBe(true);
    expect(decide(entry({ status: 'rejected', manualApproval: 'rejected' }), FP).run).toBe(true);
    expect(decide(entry({ status: 'skipped' }), FP, {}).run).toBe(false);
  });
});

describe('QA', () => {
  const good = {
    passed: true,
    score: 9,
    exerciseCorrect: true,
    equipmentCorrect: true,
    poseCorrect: true,
    anatomyCorrect: true,
    styleCorrect: true,
    issues: [],
  };
  it('validates the JSON shape', () => {
    expect(parseQa(good).score).toBe(9);
    expect(() => parseQa({ passed: 'yes' })).toThrow(/QA JSON invalid/);
  });
  it('does not trust the model verdict alone', () => {
    expect(qaPasses(parseQa(good), { qaMinScore: 8 })).toBe(true);
    expect(qaPasses(parseQa({ ...good, score: 7 }), { qaMinScore: 8 })).toBe(false);
    expect(qaPasses(parseQa({ ...good, equipmentCorrect: false }), { qaMinScore: 8 })).toBe(false);
    expect(qaPasses(parseQa({ ...good, identityConsistent: false }), { qaMinScore: 8 })).toBe(
      false,
    );
  });
});

describe('errors and backoff', () => {
  it('classifies HTTP statuses', () => {
    expect([429, 500, 503, 408].every(isRetryableStatus)).toBe(true);
    expect([400, 401, 403, 404].some(isRetryableStatus)).toBe(false);
    expect(classify(new ProviderError('x', { retryable: false, status: 400 })).retryable).toBe(
      false,
    );
    expect(classify(Object.assign(new Error('abort'), { name: 'AbortError' })).retryable).toBe(
      true,
    );
  });
  it('parses Retry-After', () => {
    expect(parseRetryAfter('3')).toBe(3000);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
  });
  it('backs off exponentially with capped jitter', () => {
    expect(backoffMs(0, 1000, 60000, () => 0)).toBe(500);
    expect(backoffMs(3, 1000, 60000, () => 1)).toBe(8000);
    expect(backoffMs(20, 1000, 60000, () => 1)).toBe(60000);
  });
});

describe('config + image headers', () => {
  it('has safe defaults and never needs a key for the mock provider', () => {
    const c = loadConfig({ IMAGE_PROVIDER: 'mock' });
    expect(c.concurrency).toBe(1);
    expect(c.outputFormat).toBe('webp');
    expect(c.bulkThreshold).toBeGreaterThan(0);
  });
  it('reads PNG dimensions and rejects garbage', () => {
    const png = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    png.writeUInt32BE(13, 8);
    png.write('IHDR', 12, 'ascii');
    png.writeUInt32BE(1536, 16);
    png.writeUInt32BE(1024, 20);
    expect(readImageInfo(png)).toMatchObject({ format: 'png', width: 1536, height: 1024 });
    expect(readImageInfo(Buffer.from('not an image'))).toBeNull();
  });
});

describe('apply planning (never overwrites originals)', () => {
  const m = (entries: Entry[]): Manifest => ({
    ...emptyManifest(),
    entries: Object.fromEntries(entries.map((e) => [e.key, e])),
  });
  const pair = (over: Partial<Entry> = {}) => [
    entry(over),
    entry({
      key: 'A:end',
      state: 'end',
      outputPath: 'assets/exercise-images/generated/A/end.webp',
      ...over,
    }),
  ];

  it('maps complete approved pairs to v2 URLs', () => {
    const p = planApply(m(pair()), {}, { states: ['start', 'end'], requireManual: false });
    expect(p.add).toHaveLength(1);
    expect(p.add[0].urls).toEqual(['/exercise-img-v2/A/0.webp', '/exercise-img-v2/A/1.webp']);
    expect(p.add[0].files.every((f) => f.to.startsWith('client/public/exercise-img-v2/'))).toBe(
      true,
    );
  });
  it('blocks half-approved pairs and honours --require-manual', () => {
    const half = [entry(), entry({ key: 'A:end', state: 'end', status: 'rejected' })];
    expect(
      planApply(m(half), {}, { states: ['start', 'end'], requireManual: false }).blocked,
    ).toHaveLength(1);
    expect(
      planApply(m(pair()), {}, { states: ['start', 'end'], requireManual: true }).add,
    ).toHaveLength(0);
    const manual = planApply(
      m(pair({ manualApproval: 'approved' })),
      {},
      { states: ['start', 'end'], requireManual: true },
    );
    expect(manual.add).toHaveLength(1);
  });
  it('reports already-applied exercises as unchanged', () => {
    const cur = { A: ['/exercise-img-v2/A/0.webp', '/exercise-img-v2/A/1.webp'] };
    const p = planApply(m(pair()), cur, { states: ['start', 'end'], requireManual: false });
    expect(p.unchanged).toEqual(['A']);
    expect(p.add).toHaveLength(0);
  });
});
