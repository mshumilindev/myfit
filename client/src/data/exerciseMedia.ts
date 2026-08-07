/**
 * Exercise media (design LIB-1/LIB-2, DET-1/DET-2, MEDIA-1…5).
 *
 * A media provider keyed by exercise id. The product does not re-host clips
 * (AC-MEDIA-05): a "clip" is an attributed demonstration on YouTube, opened at
 * source. Posters, thumbnails and form stills are generated locally from the
 * design's `--frame`/`--frame2` placeholders (so they survive offline), which
 * is exactly what the boards render. An exercise the provider does not know
 * falls back to the house graphic and stays fully loggable (AC-MEDIA-04).
 *
 * Three kinds:
 *   - `clip`   → a demonstration video exists: poster + play glyph + length,
 *                provider bar with an Open link, stills triptych beneath.
 *   - `stills` → form stills only: image glyph in the library, triptych
 *                promoted to the detail header, never a play button.
 *   - `none`   → house graphic, still loggable.
 */

import { canonicalExerciseName } from './exercises';

export type MediaKind = 'clip' | 'stills' | 'none';

export interface ExerciseClip {
  /** Named on the provider bar (AC-DET-02). */
  provider: string;
  providerKind: 'youtube';
  /** Clip length in seconds, shown as m:ss on the thumbnail (AC-LIB-02). */
  lenSec: number;
}

export interface ExerciseMedia {
  kind: MediaKind;
  clip?: ExerciseClip;
  /** Number of ordered form stills (set-up → bottom → drive → lockout). */
  stills: number;
  /** App-authored coaching cues (AC-DET-04) — English data, not scraped. */
  cues?: string[];
}

/** Exercises with a demonstration clip: id → {provider label, clip length}. */
const CLIP_SECONDS: Record<string, number> = {
  'back-squat': 12,
  'front-squat': 11,
  'goblet-squat': 9,
  'bulgarian-split-squat': 13,
  'leg-press': 10,
  'hack-squat': 11,
  'romanian-deadlift': 12,
  deadlift: 14,
  'sumo-deadlift': 13,
  'hip-thrust': 10,
  'bench-press': 12,
  'incline-bench-press': 11,
  'dumbbell-bench-press': 10,
  'overhead-press': 11,
  'lateral-raise': 8,
  'face-pull': 9,
  'barbell-row': 12,
  'lat-pulldown': 10,
  'pull-up': 9,
  'seated-cable-row': 10,
  'barbell-curl': 8,
  'dumbbell-curl': 8,
  'hammer-curl': 8,
  'triceps-pushdown': 8,
  'rope-pushdown': 9,
  'skull-crusher': 10,
  'standing-calf-raise': 8,
  'leg-extension': 9,
  'leg-curl': 9,
  plank: 10,
  'hanging-leg-raise': 11,
  'glute-bridge': 9,
};

/** Exercises with form stills but no clip (AC-MEDIA-02). */
const STILLS_ONLY = new Set<string>([
  'incline-dumbbell-press',
  'dumbbell-fly',
  'incline-dumbbell-fly',
  'cable-crossover',
  'pec-deck',
  'chest-press-machine',
  'push-up',
  'dips-chest',
  'chin-up',
  't-bar-row',
  'dumbbell-row',
  'chest-supported-row',
  'machine-row',
  'straight-arm-pulldown',
  'shrug',
  'arnold-press',
  'seated-dumbbell-press',
  'front-raise',
  'rear-delt-fly',
  'reverse-pec-deck',
  'upright-row',
  'preacher-curl',
  'cable-curl',
  'concentration-curl',
  'ez-bar-curl',
  'overhead-triceps-extension',
  'close-grip-bench',
  'dips-triceps',
  'walking-lunge',
  'reverse-lunge',
  'step-up',
  'sissy-squat',
  'seated-calf-raise',
  'crunch',
  'cable-crunch',
  'russian-twist',
  'ab-wheel',
  'hanging-knee-raise',
  'kettlebell-swing',
  'good-morning',
  'seated-leg-curl',
  'incline-curl',
  'cable-lateral-raise',
]);

/** App-authored cues for the flagship lifts (AC-DET-04). */
const CUES: Record<string, string[]> = {
  'back-squat': [
    'Brace the core before you unrack; big breath held into the belt line.',
    'Break at the hips and knees together; knees track over the toes.',
    'Depth to parallel or below, then drive the floor away.',
  ],
  'front-squat': [
    'High elbows hold the rack position; the bar sits on the shelf, not the wrists.',
    'Stay vertical through the torso; let the knees travel forward.',
    'Drive up without dropping the elbows.',
  ],
  'goblet-squat': [
    'Hold the bell tight to the chest, elbows inside the knees at the bottom.',
    'Sit straight down between the hips.',
    'Keep the heels planted the whole way.',
  ],
  'bulgarian-split-squat': [
    'Front foot far enough out that the knee stacks over the mid-foot.',
    'Drop straight down; the back knee points at the floor.',
    'Drive through the front heel, not the back toes.',
  ],
  'leg-press': [
    'Feet mid-platform, knees tracking over the toes.',
    'Lower until the knees reach the ribs without the lower back rounding.',
    'Do not lock the knees hard at the top.',
  ],
  'romanian-deadlift': [
    'Soft knees, then push the hips back — the shins stay vertical.',
    'Bar drags close to the legs; feel the hamstrings load.',
    'Stop when the back is about to round, then stand tall.',
  ],
  deadlift: [
    'Bar over mid-foot; take the slack out before you pull.',
    'Chest up, hips and shoulders rise together.',
    'Lock out by squeezing the glutes, not leaning back.',
  ],
  'sumo-deadlift': [
    'Wide stance, toes out, shins to the bar.',
    'Open the hips and pull the chest up before the bar moves.',
    'Push the floor apart and finish tall.',
  ],
  'hip-thrust': [
    'Shoulders on the bench, chin tucked, ribs down.',
    'Drive through the heels to full hip extension.',
    'Pause and squeeze at the top; do not hyperextend the back.',
  ],
  'bench-press': [
    'Shoulder blades pinned and down, feet planted.',
    'Lower to the lower chest with the elbows around 45 degrees.',
    'Press up and slightly back toward the shoulders.',
  ],
  'incline-bench-press': [
    'Set the bench near 30 degrees; any higher becomes a press.',
    'Touch high on the chest, just below the collarbone.',
    'Keep the shoulder blades set through the press.',
  ],
  'overhead-press': [
    'Squeeze the glutes and brace so the press has a base.',
    'Bar path straight up past the chin; move the head back, not the bar around.',
    'Finish with the biceps by the ears, bar over the mid-foot.',
  ],
  'lateral-raise': [
    'Lead with the elbows, a slight bend held throughout.',
    'Raise to shoulder height, no higher, no swing.',
    'Lower under control — the negative is the work.',
  ],
  'face-pull': [
    'Rope at eye height; pull to the forehead, not the chin.',
    'Externally rotate so the knuckles finish facing behind you.',
    'Squeeze the rear delts, then return slowly.',
  ],
  'barbell-row': [
    'Hinge to about 45 degrees and hold the torso still.',
    'Pull to the belt line, elbows past the ribs.',
    'Control the bar down; no jerking with the lower back.',
  ],
  'lat-pulldown': [
    'Set a slight lean back and hold it.',
    'Pull the bar to the upper chest, driving the elbows down.',
    'Let the lats stretch fully at the top without shrugging.',
  ],
  'pull-up': [
    'Start from a dead hang, shoulders set down.',
    'Drive the elbows to the ribs; chest to the bar.',
    'Lower all the way under control.',
  ],
  'seated-cable-row': [
    'Tall chest, small forward lean to stretch, then row to the navel.',
    'Elbows stay close; squeeze the shoulder blades together.',
    'Return without collapsing the chest.',
  ],
  'barbell-curl': [
    'Elbows pinned to the sides, wrists neutral.',
    'Curl without swinging the torso.',
    'Squeeze at the top, then lower slowly.',
  ],
  'dumbbell-curl': [
    'Supinate as you curl; little fingers rotate up.',
    'Keep the elbows still and by the ribs.',
    'Full stretch at the bottom, no swing.',
  ],
  'hammer-curl': [
    'Neutral grip, thumbs up the whole set.',
    'Elbows fixed; curl to the front delts.',
    'Lower under control to protect the tendons.',
  ],
  'triceps-pushdown': [
    'Elbows tucked and still; only the forearms move.',
    'Push to a full lockout and feel the triceps.',
    'Return to about 90 degrees, no higher.',
  ],
  'skull-crusher': [
    'Upper arms angled slightly back, elbows in.',
    'Lower to the forehead or just behind it.',
    'Extend without flaring the elbows.',
  ],
  'standing-calf-raise': [
    'Full stretch at the bottom, big rise onto the toes.',
    'Pause at the top and at the stretch.',
    'No bouncing — the calves respond to control.',
  ],
  'leg-extension': [
    'Back into the pad, knees at the pivot.',
    'Extend to a full, controlled lockout.',
    'Lower slowly; do not let the stack slam.',
  ],
  'leg-curl': [
    'Hips pinned to the pad, no lifting off.',
    'Curl the heels toward the glutes.',
    'Control the return through the full range.',
  ],
  plank: [
    'Elbows under the shoulders, forearms flat.',
    'Squeeze the glutes and brace the abs; ribs down.',
    'Hold a straight line — no sagging hips, no piking.',
  ],
  'hanging-leg-raise': [
    'Start from a still hang; no swinging.',
    'Curl the pelvis up as the legs rise.',
    'Lower with control to a dead hang.',
  ],
  'glute-bridge': [
    'Heels close to the hips, ribs down.',
    'Drive through the heels to full extension.',
    'Squeeze the glutes at the top; do not arch the back.',
  ],
};

const EMPTY: ExerciseMedia = { kind: 'none', stills: 0 };

function mediaForId(id: string): ExerciseMedia {
  const lenSec = CLIP_SECONDS[id];
  if (lenSec !== undefined) {
    return {
      kind: 'clip',
      clip: { provider: 'YouTube', providerKind: 'youtube', lenSec },
      stills: 4,
      cues: CUES[id],
    };
  }
  if (STILLS_ONLY.has(id)) return { kind: 'stills', stills: 4, cues: CUES[id] };
  return EMPTY;
}

/** Resolve media by catalog id (preferred) or by exercise name. */
export function exerciseMedia(idOrName: string | null | undefined): ExerciseMedia {
  if (!idOrName) return EMPTY;
  if (CLIP_SECONDS[idOrName] !== undefined || STILLS_ONLY.has(idOrName))
    return mediaForId(idOrName);
  // Fall back to a canonical-name lookup so history/db rows resolve too.
  const id = idFromName(idOrName);
  return id ? mediaForId(id) : EMPTY;
}

/** m:ss for a clip length. */
export function clipLen(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** A source-of-truth search link for the demonstration (we never re-host). */
export function clipSourceUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' proper form')}`;
}

// --- name → id index (built once from the catalog) --------------------------
let NAME_TO_ID: Map<string, string> | null = null;
function idFromName(name: string): string | null {
  if (!NAME_TO_ID) {
    NAME_TO_ID = new Map();
    // Only ids that carry media need resolving.
    for (const id of [...Object.keys(CLIP_SECONDS), ...STILLS_ONLY]) {
      NAME_TO_ID.set(id.replace(/-/g, ' '), id);
    }
  }
  const canon = canonicalExerciseName(name).toLowerCase();
  return NAME_TO_ID.get(canon) ?? NAME_TO_ID.get(name.trim().toLowerCase()) ?? null;
}
