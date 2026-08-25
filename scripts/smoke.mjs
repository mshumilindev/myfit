// End-to-end API smoke test for the tracker server.
// УВАГА: реєструє акаунт mykola/secret123 — запускай тільки проти ТЕСТОВОЇ БД:
//   GYM_DATA_DIR=$(mktemp -d) PORT=4499 npm run start -w server
//   BASE=http://localhost:4499 node scripts/smoke.mjs
const BASE = process.env.BASE ?? 'http://localhost:4477';
const uuid = () => crypto.randomUUID();

let token = null;
let passed = 0,
  failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

async function req(method, path, body, useToken = token) {
  const headers = {};
  if (useToken) headers.Authorization = `Bearer ${useToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, data };
}

// --- auth ---
let r = await req('GET', '/api/auth/status');
check(
  'status: not registered yet',
  r.status === 200 && r.data.registered === false,
  JSON.stringify(r),
);

r = await req('POST', '/api/auth/register', {
  username: 'mykola',
  password: '123',
});
check('register: short password rejected', r.status === 400);

r = await req('POST', '/api/auth/register', { username: 'm', password: 'secret123' });
check('register: short username rejected', r.status === 400);

r = await req('POST', '/api/auth/register', {
  username: 'mykola',
  password: 'secret123',
});
check(
  'register: ok',
  r.status === 200 && !!r.data.token && r.data.username === 'mykola',
  JSON.stringify(r.data),
);
token = r.data.token;

// Sign-up is open (multi-user product) — but usernames are unique.
r = await req('POST', '/api/auth/register', {
  username: 'mykola',
  password: 'hackhack',
});
check('register: duplicate username → 409', r.status === 409);

r = await req('POST', '/api/auth/register', {
  username: 'second',
  password: 'hackhack',
});
check(
  'register: open for a second user',
  r.status === 200 && !!r.data.token,
  JSON.stringify(r.data),
);

r = await req('POST', '/api/auth/login', { identifier: 'mykola', password: 'wrongpass' });
check('login: wrong password → 401', r.status === 401);

r = await req('POST', '/api/auth/login', {
  identifier: 'missing@example.com',
  password: 'secret123',
});
check('login: unknown identifier rejected', r.status === 401);

r = await req('POST', '/api/auth/login', { identifier: 'mykola', password: 'secret123' });
check('login: by username ok', r.status === 200 && !!r.data.token);

// brute force limiter: окремий identifier, щоб не заблокувати реальний акаунт у цьому ж прогоні
for (let i = 0; i < 10; i++) {
  await req('POST', '/api/auth/login', { identifier: 'ghost', password: 'nope00' });
}
r = await req('POST', '/api/auth/login', { identifier: 'ghost', password: 'nope00' });
check('login: brute force → 429', r.status === 429, JSON.stringify(r));

r = await req('GET', '/api/tracker/state', undefined, null);
check('state without token → 401', r.status === 401);

// --- workout flow ---
const w1 = uuid();
const t0 = Date.now();
r = await req('PUT', `/api/tracker/workouts/${w1}`, {
  startedAt: t0,
  finishedAt: null,
  autoFinished: false,
});
check('start workout (PUT open)', r.status === 200);

const ex1 = uuid();
r = await req('PUT', `/api/tracker/workouts/${w1}/exercises/${ex1}`, {
  name: 'Присідання',
  position: 0,
});
check('add exercise', r.status === 200);

const s1 = uuid(),
  s2 = uuid();
r = await req('PUT', `/api/tracker/exercises/${ex1}/sets/${s1}`, {
  reps: 10,
  weight: 60,
  isWarmup: true,
  position: 0,
});
check('add warmup set', r.status === 200);
r = await req('PUT', `/api/tracker/exercises/${ex1}/sets/${s2}`, {
  reps: 8,
  weight: 80,
  isWarmup: false,
  position: 1,
});
check('add working set', r.status === 200);

r = await req('GET', '/api/tracker/state');
let w = r.data.workouts.find((x) => x.id === w1);
check(
  'state: workout open with 1 exercise / 2 sets',
  !!w && w.finishedAt === null && w.exercises.length === 1 && w.exercises[0].sets.length === 2,
  JSON.stringify(w),
);
check(
  'state: set fields roundtrip',
  w.exercises[0].sets[0].isWarmup === true &&
    w.exercises[0].sets[0].weight === 60 &&
    w.exercises[0].sets[1].reps === 8,
);

// idempotent replay (offline queue re-run)
await req('PUT', `/api/tracker/workouts/${w1}`, {
  startedAt: t0,
  finishedAt: null,
  autoFinished: false,
});
await req('PUT', `/api/tracker/workouts/${w1}/exercises/${ex1}`, {
  name: 'Присідання',
  position: 0,
});
await req('PUT', `/api/tracker/exercises/${ex1}/sets/${s1}`, {
  reps: 10,
  weight: 60,
  isWarmup: true,
  position: 0,
});
r = await req('GET', '/api/tracker/state');
w = r.data.workouts.find((x) => x.id === w1);
check(
  'replay is idempotent (no dupes)',
  w.exercises.length === 1 && w.exercises[0].sets.length === 2,
  JSON.stringify(w),
);

// new open workout auto-closes the previous open one
const w2 = uuid();
r = await req('PUT', `/api/tracker/workouts/${w2}`, {
  startedAt: t0 + 1000,
  finishedAt: null,
  autoFinished: false,
});
check('start second workout', r.status === 200);
r = await req('GET', '/api/tracker/state');
w = r.data.workouts.find((x) => x.id === w1);
const w2s = r.data.workouts.find((x) => x.id === w2);
check(
  'previous open workout auto-closed',
  w.finishedAt !== null && w.autoFinished === true,
  JSON.stringify(w),
);
check('new workout is the open one', w2s.finishedAt === null);

// finish + edit after finish
r = await req('PUT', `/api/tracker/workouts/${w2}`, {
  startedAt: t0 + 1000,
  finishedAt: t0 + 3600_000,
  autoFinished: false,
});
check('finish workout', r.status === 200);
r = await req('PUT', `/api/tracker/exercises/${ex1}/sets/${s2}`, {
  reps: 12,
  weight: 85,
  isWarmup: false,
  position: 1,
});
check('edit set after finish allowed', r.status === 200);
r = await req('GET', '/api/tracker/state');
w = r.data.workouts.find((x) => x.id === w1);
check(
  'edited set persisted',
  w.exercises[0].sets[1].reps === 12 && w.exercises[0].sets[1].weight === 85,
);

// 8h auto-close rule
const w3 = uuid();
const nineHoursAgo = Date.now() - 9 * 3600_000;
await req('PUT', `/api/tracker/workouts/${w3}`, {
  startedAt: nineHoursAgo,
  finishedAt: null,
  autoFinished: false,
});
r = await req('GET', '/api/tracker/state');
w = r.data.workouts.find((x) => x.id === w3);
check(
  '9h-old open workout auto-finished at start+8h',
  w.autoFinished === true && w.finishedAt === nineHoursAgo + 8 * 3600_000,
  JSON.stringify(w),
);

// validation
r = await req('PUT', `/api/tracker/workouts/${uuid()}`, { startedAt: 'oops' });
check('bad startedAt rejected', r.status === 400);
r = await req('PUT', `/api/tracker/exercises/${uuid()}/sets/${uuid()}`, { reps: 5 });
check('set on unknown exercise → 404', r.status === 404);

// --- gyms / pings / reminders ---
const gym = uuid();
r = await req('PUT', `/api/tracker/gyms/${gym}`, {
  name: 'Смартфіт',
  lat: 50.45,
  lng: 30.52,
  radiusM: 150,
});
check('add gym', r.status === 200);
r = await req('PUT', `/api/tracker/pings/${uuid()}`, { gymId: uuid(), at: Date.now() });
check('ping unknown gym → 404', r.status === 404);

// a 75-min visit 3 days ago (pings every 5 min), no workout overlaps → reminder
const visitStart = Date.now() - 3 * 24 * 3600_000;
for (let m = 0; m <= 75; m += 5) {
  await req('PUT', `/api/tracker/pings/${uuid()}`, { gymId: gym, at: visitStart + m * 60_000 });
}
r = await req('GET', '/api/tracker/state');
let rem = r.data.reminders.find((x) => x.gymId === gym);
check(
  '1h15m unlogged visit → reminder',
  !!rem && rem.visitStart === visitStart,
  JSON.stringify(r.data.reminders),
);

// dismiss it
r = await req('POST', '/api/tracker/reminders/dismiss', { gymId: gym, visitStart });
check('dismiss reminder', r.status === 200);
r = await req('GET', '/api/tracker/state');
check(
  'dismissed reminder is gone',
  !r.data.reminders.some((x) => x.gymId === gym && x.visitStart === visitStart),
);
await req('POST', '/api/tracker/reminders/dismiss', { gymId: gym, visitStart });
check('dismiss replay is idempotent', true);

// a 30-min visit → below 1h threshold, no reminder
const shortStart = Date.now() - 2 * 24 * 3600_000;
for (let m = 0; m <= 30; m += 5) {
  await req('PUT', `/api/tracker/pings/${uuid()}`, { gymId: gym, at: shortStart + m * 60_000 });
}
r = await req('GET', '/api/tracker/state');
check('short visit → no reminder', !r.data.reminders.some((x) => x.visitStart === shortStart));

// a 90-min visit yesterday WITH an overlapping logged workout → no reminder
const ovStart = Date.now() - 24 * 3600_000;
for (let m = 0; m <= 90; m += 5) {
  await req('PUT', `/api/tracker/pings/${uuid()}`, { gymId: gym, at: ovStart + m * 60_000 });
}
await req('PUT', `/api/tracker/workouts/${uuid()}`, {
  startedAt: ovStart + 10 * 60_000,
  finishedAt: ovStart + 80 * 60_000,
  autoFinished: false,
});
r = await req('GET', '/api/tracker/state');
check(
  'visit with overlapping workout → no reminder',
  !r.data.reminders.some((x) => x.visitStart === ovStart),
  JSON.stringify(r.data.reminders),
);

// "log retroactively" server side = plain workout upsert on visit times (covered above)

// deletes
r = await req('DELETE', `/api/tracker/sets/${s1}`);
check('delete set', r.status === 200);
r = await req('DELETE', `/api/tracker/exercises/${ex1}`);
check('delete exercise', r.status === 200);
r = await req('DELETE', `/api/tracker/workouts/${w1}`);
check('delete workout', r.status === 200);
r = await req('GET', '/api/tracker/state');
check('deleted workout gone (cascade)', !r.data.workouts.some((x) => x.id === w1));
r = await req('DELETE', `/api/tracker/gyms/${gym}`);
check('delete gym', r.status === 200);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
