#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';

const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { cert, initializeApp } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

const RENAME_TO_DB = new Map(
  Object.entries({
    'lying leg curls': 'Seated Leg Curl',
    'barbell row': 'Bent Over Barbell Row',
    'cable glute kickback': 'One-Legged Cable Kickback',
    'incline dumbbell diamond press': 'Incline Dumbbell Press',
    'lateral raise': 'Side Lateral Raise',
    'low-to-high cable flye': 'Incline Cable Flye',
    'pull-up': 'Pullups',
    'reverse pec deck': 'Reverse Machine Flyes',
    'side bend': 'Dumbbell Side Bend',
  }),
);

const CUSTOM_CATALOG = [
  {
    name: 'Pec Deck (Machine Fly)',
    primaryMuscle: 'chest',
    secondaryMuscles: ['shoulders'],
    equipment: ['machine'],
  },
  {
    name: 'Reverse Pec Deck (back)',
    primaryMuscle: 'back',
    secondaryMuscles: ['shoulders'],
    equipment: ['machine'],
  },
  {
    name: 'Tall-Kneeling Cross-Body Lat Pulldown',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    equipment: ['cable'],
  },
  {
    name: 'Incline Dumbbell Y-Raise',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['back'],
    equipment: ['dumbbell'],
  },
];

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}

const dry = process.argv.includes('--dry');
const keyFile = arg('key', './serviceAccountKey.json');
const username = arg('username', 'mshumilin');
const now = Date.now();

const rich = JSON.parse(fs.readFileSync('./client/src/data/exercises.rich.json', 'utf8'));
const richByName = new Map(rich.map((exercise) => [exercise.name.trim().toLowerCase(), exercise]));

const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

function idFor(name) {
  return name.trim().toLowerCase();
}

function replacementFor(name) {
  return RENAME_TO_DB.get(idFor(String(name ?? ''))) ?? null;
}

function richMeta(name) {
  const exercise = richByName.get(idFor(name));
  if (!exercise) throw new Error(`Missing rich DB exercise: ${name}`);
  return {
    primaryMuscle: exercise.primaryMuscles[0] ?? null,
    secondaryMuscles: exercise.secondaryMuscles ?? [],
    equipment: exercise.equipment ? [exercise.equipment] : [],
  };
}

const users = await db
  .collection('users')
  .where('usernameLower', '==', username.toLowerCase())
  .get();
if (users.empty) throw new Error(`User not found: ${username}`);
if (users.size > 1) throw new Error(`Ambiguous username: ${username}`);

const userDoc = users.docs[0];
const userId = userDoc.id;
const workouts = await userDoc.ref.collection('workouts').get();

let workoutsChanged = 0;
let exercisesChanged = 0;
const byName = new Map();
let batch = db.batch();
let ops = 0;

async function commitIfNeeded(force = false) {
  if (dry || ops === 0 || (!force && ops < 450)) return;
  await batch.commit();
  batch = db.batch();
  ops = 0;
}

for (const workoutDoc of workouts.docs) {
  const data = workoutDoc.data();
  const exercises = Array.isArray(data.exercises) ? data.exercises : [];
  let changed = false;
  const nextExercises = exercises.map((exercise) => {
    const nextName = replacementFor(exercise?.name);
    if (!nextName) return exercise;
    const meta = richMeta(nextName);
    changed = true;
    exercisesChanged += 1;
    byName.set(exercise.name, (byName.get(exercise.name) ?? 0) + 1);
    return { ...exercise, name: nextName, ...meta };
  });
  if (!changed) continue;
  workoutsChanged += 1;
  if (!dry) {
    batch.update(workoutDoc.ref, { exercises: nextExercises, updatedAt: now });
    ops += 1;
    await commitIfNeeded();
  }
}

const catalog = [];
for (const meta of CUSTOM_CATALOG) {
  const id = idFor(meta.name);
  const ref = db.collection('exerciseCatalog').doc(id);
  const existing = await ref.get();
  const data = {
    id,
    name: meta.name,
    kind: 'strength',
    primaryMuscle: meta.primaryMuscle,
    secondaryMuscles: meta.secondaryMuscles,
    equipment: meta.equipment,
    createdBy: existing.exists ? (existing.data().createdBy ?? userId) : userId,
    updatedAt: now,
  };
  catalog.push({ name: meta.name, existed: existing.exists, ...meta });
  if (!dry) {
    batch.set(ref, data);
    ops += 1;
    await commitIfNeeded();
  }
}

await commitIfNeeded(true);

console.log(
  JSON.stringify(
    {
      dry,
      username,
      userId,
      workoutsScanned: workouts.size,
      workoutsChanged,
      exercisesChanged,
      byName: Object.fromEntries([...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
      catalog,
    },
    null,
    2,
  ),
);
