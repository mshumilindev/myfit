#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';

const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { cert, initializeApp } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

const LEGACY_NAMES = new Map(
  Object.entries({
    'bench press': 'Barbell Bench Press - Medium Grip',
    'back squat': 'Barbell Full Squat',
    squat: 'Barbell Full Squat',
    deadlift: 'Barbell Deadlift',
    'incline bench press': 'Barbell Incline Bench Press - Medium Grip',
    'dumbbell bench press': 'Dumbbell Bench Press',
    'lat pulldown': 'Wide-Grip Lat Pulldown',
    'seated cable row': 'Seated Cable Rows',
    'leg extension': 'Leg Extensions',
    'leg curl': 'Lying Leg Curls',
    'hip thrust': 'Barbell Hip Thrust',
    'розведення гантелей лежачи': 'Dumbbell Flyes',
    'пуловер з гантеллю': 'Bent-Arm Dumbbell Pullover',
    'concentration curl': 'Concentration Curls',
  }),
);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}

const dry = process.argv.includes('--dry');
const keyFile = arg('key', './serviceAccountKey.json');
const uidFilter = arg('uid');
const now = Date.now();

const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

function canonical(name) {
  return (
    LEGACY_NAMES.get(
      String(name ?? '')
        .trim()
        .toLowerCase(),
    ) ?? null
  );
}

function userLabel(user) {
  const data = user.data();
  return data.username || user.id;
}

const usersSnap = uidFilter
  ? { docs: [await db.collection('users').doc(uidFilter).get()].filter((doc) => doc.exists) }
  : await db.collection('users').get();

let usersScanned = 0;
let workoutsScanned = 0;
let workoutsChanged = 0;
let exercisesChanged = 0;
const byName = new Map();
const touchedUsers = new Map();
let batch = db.batch();
let ops = 0;

async function commitIfNeeded(force = false) {
  if (dry || ops === 0 || (!force && ops < 450)) return;
  await batch.commit();
  batch = db.batch();
  ops = 0;
}

for (const userDoc of usersSnap.docs) {
  usersScanned += 1;
  const workoutsSnap = await userDoc.ref.collection('workouts').get();
  let userChanges = 0;
  for (const workoutDoc of workoutsSnap.docs) {
    workoutsScanned += 1;
    const data = workoutDoc.data();
    const exercises = Array.isArray(data.exercises) ? data.exercises : [];
    let changed = false;
    const nextExercises = exercises.map((exercise) => {
      const nextName = canonical(exercise?.name);
      if (!nextName || nextName === exercise.name) return exercise;
      changed = true;
      exercisesChanged += 1;
      userChanges += 1;
      byName.set(exercise.name, (byName.get(exercise.name) ?? 0) + 1);
      return { ...exercise, name: nextName };
    });
    if (!changed) continue;
    workoutsChanged += 1;
    if (!dry) {
      batch.update(workoutDoc.ref, { exercises: nextExercises, updatedAt: now });
      ops += 1;
      await commitIfNeeded();
    }
  }
  if (userChanges > 0) touchedUsers.set(userLabel(userDoc), userChanges);
}

await commitIfNeeded(true);

console.log(
  JSON.stringify(
    {
      dry,
      usersScanned,
      workoutsScanned,
      workoutsChanged,
      exercisesChanged,
      touchedUsers: Object.fromEntries(touchedUsers),
      byName: Object.fromEntries([...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    },
    null,
    2,
  ),
);
