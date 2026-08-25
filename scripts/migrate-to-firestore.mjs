/**
 * One-time migration: Spotter's SQLite database → Firestore + Cloud Storage.
 *
 * Reads the existing better-sqlite3 file and writes every table into the
 * Firestore shape the app now expects (see firestore.rules), then uploads
 * avatar files to Storage at avatars/{uid}/photo. Idempotent: re-running
 * overwrites the same document ids.
 *
 * Usage (from the repo root, on a machine that has the DB + a service key):
 *   node scripts/migrate-to-firestore.mjs \
 *     --db ~/.gym-tracker/gym.sqlite \
 *     --key ./serviceAccountKey.json \
 *     --media ~/.gym-tracker/media/avatars \
 *     [--bucket spotter-64c3b.firebasestorage.app] \
 *     [--dry]
 *
 * Requirements: `npm i firebase-admin better-sqlite3` (better-sqlite3 already
 * ships with the old server). Get the service-account key from the Firebase
 * console → Project settings → Service accounts → Generate new private key.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
const DRY = process.argv.includes('--dry');
const DB_FILE = arg('db', path.join(process.env.HOME || '.', '.gym-tracker', 'gym.sqlite'));
const KEY_FILE = arg('key', './serviceAccountKey.json');
const MEDIA_DIR = arg('media', path.join(path.dirname(DB_FILE), 'media', 'avatars'));
const BUCKET = arg('bucket', 'spotter-64c3b.firebasestorage.app');

const key = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
initializeApp({ credential: cert(key), storageBucket: BUCKET });
const db = new Database(DB_FILE, { readonly: true });
const fdb = getFirestore();
const bucket = getStorage().bucket();

const json = (raw, fb) => {
  if (!raw) return fb;
  try {
    const v = JSON.parse(raw);
    return v ?? fb;
  } catch {
    return fb;
  }
};
const rows = (sql, ...p) => db.prepare(sql).all(...p);
const bool = (v) => !!v;

// Batch writer (≤450 ops/commit).
let batch = fdb.batch();
let ops = 0;
let written = 0;
async function set(ref, data) {
  written++;
  if (DRY) return;
  batch.set(ref, data);
  if (++ops >= 450) {
    await batch.commit();
    batch = fdb.batch();
    ops = 0;
  }
}
async function flush() {
  if (!DRY && ops > 0) await batch.commit();
  ops = 0;
}

function nameParts(u) {
  const first =
    (u.first_name || '').trim() || (u.username || '').trim().split(/\s+/)[0] || u.username;
  const last = (u.last_name || '').trim() || null;
  return { firstName: first, lastName: last };
}
function displayName(u) {
  const { firstName, lastName } = nameParts(u);
  return [firstName, lastName].filter(Boolean).join(' ');
}

async function migrate() {
  const users = rows('SELECT * FROM users');
  const userById = new Map(users.map((u) => [u.id, u]));
  let hasAdmin = false;

  console.log(`Migrating ${users.length} user(s)…`);
  for (const u of users) {
    const { firstName, lastName } = nameParts(u);
    if (u.role === 'admin') hasAdmin = true;
    await set(fdb.collection('users').doc(u.id), {
      username: u.username,
      usernameLower: (u.username || '').toLowerCase(),
      firstName,
      lastName,
      role: u.role || 'member',
      status: u.status || 'active',
      trainerId: u.trainer_id ?? null,
      avatarExt: u.avatar_ext ?? null,
      createdAt: u.created_at,
      updatedAt: u.created_at,
    });
    if (u.password_hash) {
      await set(fdb.collection('credentials').doc(u.id), { passwordHash: u.password_hash });
    }
    if (u.username)
      await set(fdb.collection('usernames').doc(u.username.toLowerCase()), { userId: u.id });

    // Workouts → one nested document each.
    const workouts = rows('SELECT * FROM workouts WHERE user_id = ?', u.id);
    for (const w of workouts) {
      const exercises = rows(
        'SELECT * FROM exercises WHERE workout_id = ? ORDER BY position',
        w.id,
      ).map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind || 'strength',
        position: e.position,
        plannedSets: e.planned_sets ?? null,
        plannedReps: e.planned_reps ?? null,
        plannedDurationMin: e.planned_duration_min ?? null,
        equipment: json(e.equipment, []),
        groupId: e.group_id ?? null,
        groupOrder: e.group_order ?? null,
        primaryMuscle: e.primary_muscle ?? null,
        secondaryMuscles: json(e.secondary_muscles, []),
        sets: rows('SELECT * FROM sets WHERE exercise_id = ? ORDER BY position', e.id).map((s) => ({
          id: s.id,
          reps: s.reps,
          weight: s.weight ?? null,
          isWarmup: bool(s.is_warmup),
          type: s.type || (s.is_warmup ? 'warmup' : 'working'),
          drops: json(s.drops, []),
          durationMin: s.duration_min ?? null,
          distanceKm: s.distance_km ?? null,
          calories: s.calories ?? null,
          rpe: s.rpe ?? null,
          position: s.position,
        })),
      }));
      await set(fdb.collection('users').doc(u.id).collection('workouts').doc(w.id), {
        id: w.id,
        startedAt: w.started_at,
        finishedAt: w.finished_at ?? null,
        autoFinished: bool(w.auto_finished),
        gymId: w.gym_id ?? null,
        dayName: w.day_name ?? null,
        exercises,
        updatedAt: w.updated_at ?? w.started_at,
      });
    }

    // Gyms, pings, dismissals, notices, audit, trainer notes.
    for (const g of rows('SELECT * FROM gyms WHERE user_id = ?', u.id)) {
      await set(fdb.collection('users').doc(u.id).collection('gyms').doc(g.id), {
        id: g.id,
        name: g.name,
        lat: g.lat,
        lng: g.lng,
        radiusM: g.radius_m,
        favorite: bool(g.favorite),
        inventory: json(g.inventory, []),
        updatedAt: g.updated_at ?? Date.now(),
      });
    }
    for (const p of rows('SELECT * FROM presence_pings WHERE user_id = ?', u.id)) {
      await set(fdb.collection('users').doc(u.id).collection('pings').doc(p.id), {
        gymId: p.gym_id,
        at: p.at,
      });
    }
    for (const d of rows('SELECT * FROM reminder_dismissals WHERE user_id = ?', u.id)) {
      await set(
        fdb
          .collection('users')
          .doc(u.id)
          .collection('reminderDismissals')
          .doc(`${d.gym_id}:${d.visit_start}`),
        { gymId: d.gym_id, visitStart: d.visit_start },
      );
    }
    for (const n of rows('SELECT * FROM notices WHERE user_id = ?', u.id)) {
      await set(fdb.collection('users').doc(u.id).collection('notices').doc(n.id), {
        id: n.id,
        kind: n.kind,
        actor: n.actor ?? null,
        detail: n.detail ?? null,
        createdAt: n.created_at,
        readAt: n.read_at ?? null,
      });
    }
    for (const n of rows('SELECT * FROM trainer_notes WHERE member_id = ?', u.id)) {
      await set(fdb.collection('users').doc(u.id).collection('trainerNotes').doc(n.id), {
        id: n.id,
        trainerId: n.trainer_id,
        memberId: n.member_id,
        text: n.text,
        createdAt: n.created_at,
      });
    }
    for (const a of rows('SELECT * FROM audit_log WHERE subject_id = ?', u.id)) {
      const reader = userById.get(a.reader_id);
      await set(fdb.collection('users').doc(u.id).collection('audit').doc(String(a.id)), {
        id: String(a.id),
        readerId: a.reader_id,
        readerName: reader ? displayName(reader) : null,
        readerRole: reader ? reader.role : 'admin',
        subjectId: a.subject_id,
        resource: a.resource,
        at: a.at,
      });
    }

    // Avatar upload.
    if (u.avatar_ext) {
      const file = path.join(MEDIA_DIR, `${u.id}.${u.avatar_ext}`);
      if (fs.existsSync(file)) {
        const mime =
          u.avatar_ext === 'png'
            ? 'image/png'
            : u.avatar_ext === 'webp'
              ? 'image/webp'
              : 'image/jpeg';
        console.log(`  avatar → avatars/${u.id}/photo (${u.avatar_ext})`);
        if (!DRY) {
          await bucket.upload(file, {
            destination: `avatars/${u.id}/photo`,
            metadata: { contentType: mime, cacheControl: 'no-store' },
          });
        }
      }
    }
  }

  // Invites.
  for (const inv of rows('SELECT * FROM invites')) {
    await set(fdb.collection('invites').doc(inv.token), {
      token: inv.token,
      userId: inv.user_id,
      createdBy: inv.created_by,
      kind: inv.kind || 'invite',
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
      claimedAt: inv.claimed_at ?? null,
      revokedAt: inv.revoked_at ?? null,
      reRequestedAt: inv.re_requested_at ?? null,
    });
  }

  // Programs (+ embedded items) and assignments.
  for (const p of rows('SELECT * FROM programs')) {
    const items = rows(
      'SELECT * FROM program_items WHERE program_id = ? ORDER BY day, position',
      p.id,
    ).map((i) => ({
      id: i.id,
      day: i.day,
      position: i.position,
      name: i.name,
      kind: i.kind || 'strength',
      sets: i.sets,
      reps: i.reps,
      durationMin: i.duration_min ?? null,
      equipment: json(i.equipment, []),
      groupId: i.group_id ?? null,
      groupOrder: i.group_order ?? null,
      dropLast: bool(i.drop_last),
    }));
    await set(fdb.collection('programs').doc(p.id), {
      id: p.id,
      authorId: p.author_id,
      name: p.name,
      weeks: p.weeks,
      daysPerWeek: p.days_per_week,
      status: p.status || 'draft',
      dayNames: json(p.day_names, {}),
      items,
      updatedAt: p.updated_at ?? Date.now(),
    });
  }
  for (const a of rows('SELECT * FROM program_assignments')) {
    await set(fdb.collection('assignments').doc(a.member_id), {
      memberId: a.member_id,
      programId: a.program_id,
      assignedBy: a.assigned_by,
      startedAt: a.started_at,
    });
  }

  // Shared exercise catalog.
  for (const c of rows('SELECT * FROM exercise_catalog')) {
    await set(fdb.collection('exerciseCatalog').doc(c.name_lower), {
      id: c.name_lower,
      name: c.name,
      kind: c.kind || 'strength',
      primaryMuscle: c.primary_muscle ?? null,
      secondaryMuscles: json(c.secondary_muscles, []),
      equipment: json(c.equipment, []),
      createdBy: c.created_by,
      updatedAt: c.updated_at ?? Date.now(),
    });
  }

  // Bootstrap flag so authStatus/register know an admin already exists.
  await set(fdb.collection('meta').doc('app'), { hasAdmin });

  await flush();
  console.log(`\n${DRY ? '[dry-run] would write' : 'Wrote'} ${written} document(s).`);
  console.log('Done. Verify in the Firebase console, then deploy rules + hosting.');
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
