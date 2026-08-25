import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:5175';
const out = process.env.QA_OUT ?? '/private/tmp/gym-fit-qa';
fs.mkdirSync(out, { recursive: true });

const now = Date.UTC(2026, 7, 3, 9, 41, 0);

const gyms = [
  { id: 'g1', name: 'Smartass Obolon', lat: 50.52, lng: 30.49, radiusM: 150, favorite: 1 },
  { id: 'g2', name: 'Top Gym Podil', lat: 50.46, lng: 30.51, radiusM: 200, favorite: 0 },
];

const openWorkout = {
  id: 'open',
  startedAt: now - 24 * 60_000,
  finishedAt: null,
  autoFinished: false,
  gymId: 'g1',
  exercises: [
    {
      id: 'bench',
      name: 'Bench press',
      kind: 'strength',
      plannedSets: 4,
      plannedReps: 8,
      equipment: ['barbell'],
      position: 0,
      sets: [
        { id: 's1', reps: 10, weight: 70, isWarmup: false, position: 0 },
        { id: 's2', reps: 10, weight: 72.5, isWarmup: false, position: 1 },
      ],
    },
    {
      id: 'row',
      name: 'Seated row',
      kind: 'strength',
      plannedSets: 3,
      plannedReps: 10,
      equipment: ['machine'],
      position: 1,
      sets: [],
    },
  ],
};

const emptyOpenWorkout = {
  ...openWorkout,
  id: 'empty-open',
  exercises: [],
};

const doneWorkout = {
  id: 'done',
  startedAt: now - 2 * 86_400_000,
  finishedAt: now - 2 * 86_400_000 + 4_200_000,
  autoFinished: false,
  gymId: 'g1',
  exercises: [
    {
      id: 'sq',
      name: 'Squat',
      kind: 'strength',
      position: 0,
      sets: [{ id: 's3', reps: 8, weight: 100, isWarmup: false, position: 0 }],
    },
  ],
};

const autoWorkout = {
  id: 'auto',
  startedAt: now - 7 * 86_400_000,
  finishedAt: now - 7 * 86_400_000 + 8 * 3_600_000,
  autoFinished: true,
  gymId: 'g2',
  exercises: [
    {
      id: 'front-squat',
      name: 'Front squat',
      kind: 'strength',
      plannedSets: 3,
      plannedReps: 8,
      equipment: ['barbell'],
      position: 0,
      sets: [
        { id: 'fs-warm', reps: 10, weight: 40, isWarmup: true, position: 0 },
        { id: 'fs-work', reps: 8, weight: 60, isWarmup: false, position: 1 },
      ],
    },
  ],
};

const progressWorkout2 = {
  id: 'progress-2',
  startedAt: now - 5 * 86_400_000,
  finishedAt: now - 5 * 86_400_000 + 4_800_000,
  autoFinished: false,
  gymId: 'g1',
  exercises: [
    {
      id: 'sq-2',
      name: 'Squat',
      kind: 'strength',
      position: 0,
      sets: [
        { id: 'sq-2-a', reps: 8, weight: 92.5, isWarmup: false, position: 0 },
        { id: 'sq-2-b', reps: 6, weight: 100, isWarmup: false, position: 1 },
      ],
    },
    {
      id: 'bp-2',
      name: 'Bench Press',
      kind: 'strength',
      position: 1,
      sets: [{ id: 'bp-2-a', reps: 8, weight: 75, isWarmup: false, position: 0 }],
    },
  ],
};

const progressWorkout3 = {
  id: 'progress-3',
  startedAt: now - 12 * 86_400_000,
  finishedAt: now - 12 * 86_400_000 + 4_200_000,
  autoFinished: false,
  gymId: 'g2',
  exercises: [
    {
      id: 'sq-3',
      name: 'Squat',
      kind: 'strength',
      position: 0,
      sets: [
        { id: 'sq-3-a', reps: 8, weight: 85, isWarmup: false, position: 0 },
        { id: 'sq-3-b', reps: 8, weight: 90, isWarmup: false, position: 1 },
      ],
    },
    {
      id: 'bp-3',
      name: 'Bench Press',
      kind: 'strength',
      position: 1,
      sets: [{ id: 'bp-3-a', reps: 6, weight: 72.5, isWarmup: false, position: 0 }],
    },
  ],
};

const progressWorkout4 = {
  id: 'progress-4',
  startedAt: now - 19 * 86_400_000,
  finishedAt: now - 19 * 86_400_000 + 3_900_000,
  autoFinished: false,
  gymId: 'g1',
  exercises: [
    {
      id: 'sq-4',
      name: 'Squat',
      kind: 'strength',
      position: 0,
      sets: [
        { id: 'sq-4-a', reps: 8, weight: 80, isWarmup: false, position: 0 },
        { id: 'sq-4-b', reps: 8, weight: 85, isWarmup: false, position: 1 },
      ],
    },
    {
      id: 'dl-4',
      name: 'Deadlift',
      kind: 'strength',
      position: 1,
      sets: [{ id: 'dl-4-a', reps: 5, weight: 120, isWarmup: false, position: 0 }],
    },
  ],
};

const program = {
  id: 'p1',
  name: 'Strength base',
  weeks: 8,
  daysPerWeek: 3,
  status: 'active',
  authorId: 'trainer1',
  items: [
    {
      id: 'pi1',
      day: 1,
      position: 0,
      name: 'Bench press',
      kind: 'strength',
      sets: 4,
      reps: 8,
      durationMin: null,
      equipment: ['barbell'],
    },
    {
      id: 'pi2',
      day: 1,
      position: 1,
      name: 'Seated row',
      kind: 'strength',
      sets: 3,
      reps: 10,
      durationMin: null,
      equipment: ['machine'],
    },
    {
      id: 'pi3',
      day: 3,
      position: 0,
      name: 'Bike',
      kind: 'cardio',
      sets: 1,
      reps: 1,
      durationMin: 15,
      equipment: ['bike'],
    },
  ],
};

const people = [
  person('admin1', 'Admin User', 'admin', 'Admin', 'User', 'admin', {
    volume30: 11_000,
  }),
  person('member1', 'Marta Kovalenko', 'marta', 'Marta', 'Kovalenko', 'member', {
    trainerId: 'trainer1',
    trainerName: 'Olha Sydorenko',
    lastSessionAt: now - 3_600_000,
    live: true,
    liveStartedAt: now - 24 * 60_000,
    volume30: 42_800,
  }),
  person('trainer1', 'Olha Sydorenko', 'olha', 'Olha', 'Sydorenko', 'trainer', {
    clientCount: 2,
  }),
  person('invite1', 'Sofia Kravets', 'sofia', 'Sofia', 'Kravets', 'member', {
    status: 'invited',
    invite: {
      state: 'sent',
      expiresAt: now + 5 * 86_400_000,
      claimedAt: null,
      reRequestedAt: null,
      token: 'abc',
    },
  }),
];

function person(id, name, username, firstName, lastName, role, patch = {}) {
  return {
    id,
    name,
    username,
    firstName,
    lastName,
    role,
    status: 'active',
    trainerId: null,
    trainerName: null,
    clientCount: 0,
    lastSessionAt: null,
    live: false,
    liveStartedAt: null,
    volume30: 0,
    avatar: false,
    invite: null,
    ...patch,
  };
}

function profile(id, relation = 'self', viewerRole = 'member') {
  const source =
    id === 'member1'
      ? people[1]
      : id === 'trainer1'
        ? people[2]
        : id === 'admin1'
          ? people[0]
          : { ...people[1], id: 'me' };
  return {
    viewer: { id: relation === 'self' ? source.id : 'trainer1', relation, role: viewerRole },
    person: { ...source, joinedAt: now - 40 * 86_400_000, avatar: false },
    access: [
      { id: 'admin1', name: 'Admin User', role: 'admin' },
      { id: 'trainer1', name: 'Olha Sydorenko', role: 'trainer' },
    ],
    summary: {
      sessions: 18,
      sessions30: 8,
      perWeek30: 2.1,
      liveSessions: source.live ? 1 : 0,
      firstSessionAt: now - 35 * 86_400_000,
      lastSessionAt: now - 3_600_000,
      durationMs: 18 * 3_600_000,
      sets: 240,
      exercises: 74,
      volumeKg: 42_800,
      cardioMinutes: 120,
      volume30: 21_000,
      volume7: 6_200,
    },
    sessions: [
      {
        id: 'open',
        startedAt: now - 24 * 60_000,
        finishedAt: null,
        autoFinished: false,
        live: true,
        durationMs: null,
        gymName: 'Smartass Obolon',
        sets: 7,
        exercises: 2,
        volumeKg: 2100,
        exerciseNames: ['Bench press', 'Seated row'],
      },
      {
        id: 'done',
        startedAt: now - 2 * 86_400_000,
        finishedAt: now - 2 * 86_400_000 + 4_200_000,
        autoFinished: false,
        live: false,
        durationMs: 4_200_000,
        gymName: 'Smartass Obolon',
        sets: 5,
        exercises: 2,
        volumeKg: 3200,
        exerciseNames: ['Squat'],
      },
    ],
    gyms: [
      {
        id: 'g1',
        name: 'Smartass Obolon',
        favorite: 1,
        lat: 50.52,
        lng: 30.49,
        radiusM: 150,
        sessions: 18,
        lastSessionAt: now - 3_600_000,
        volumeKg: 42_800,
      },
    ],
    topExercises: [
      {
        name: 'Bench press',
        sets: 80,
        sessions: 12,
        lastAt: now - 3_600_000,
        volumeKg: 18_000,
        bestE1rm: 96,
      },
    ],
    notes: [
      {
        id: 'n1',
        text: 'Keep shoulders packed on bench.',
        createdAt: now - 86_400_000,
        trainerName: 'Olha Sydorenko',
      },
    ],
    audit: [
      {
        at: now - 3_600_000,
        resource: 'profile',
        readerName: 'Olha Sydorenko',
        readerRole: 'trainer',
      },
    ],
  };
}

const filled = {
  workouts: [openWorkout, doneWorkout, autoWorkout],
  gyms,
  assignment: {
    program,
    assignedBy: 'Olha Sydorenko',
    startedAt: now - 21 * 86_400_000,
    week: 4,
    done: 7,
    total: 24,
    expectedSoFar: 8,
    adherence: 0.92,
  },
};

const emptyLive = {
  ...filled,
  workouts: [emptyOpenWorkout, doneWorkout, autoWorkout],
};

const progressFilled = {
  ...filled,
  workouts: [openWorkout, doneWorkout, progressWorkout2, progressWorkout3, progressWorkout4],
};

const memberProgramNoLive = {
  ...filled,
  workouts: [doneWorkout, progressWorkout2, progressWorkout3, progressWorkout4],
};
const memberOwnProgram = {
  ...memberProgramNoLive,
  assignment: {
    ...memberProgramNoLive.assignment,
    assignedBy: 'Marta Kovalenko',
  },
};

const empty = { workouts: [], gyms: [], assignment: null };

const trainerClients = [
  {
    id: 'member1',
    name: 'Marta Kovalenko',
    avatar: false,
    lastSessionAt: now - 3_600_000,
    live: true,
    liveStartedAt: now - 24 * 60_000,
    liveSets: 7,
    liveVolumeKg: 2100,
    weekSessions: 4,
    weekVolumeKg: 14_200,
    weekDeltaPct: 18,
    programName: 'Upper / lower',
    programWeek: 4,
    dormantDays: null,
  },
  {
    id: 'member2',
    name: 'Dmytro Illienko',
    avatar: false,
    lastSessionAt: now - 86_400_000,
    live: false,
    liveStartedAt: null,
    liveSets: 0,
    liveVolumeKg: 0,
    weekSessions: 3,
    weekVolumeKg: 9800,
    weekDeltaPct: 4,
    programName: 'Push / pull',
    programWeek: 2,
    dormantDays: null,
  },
  {
    id: 'member3',
    name: 'Pavlo Hrytsenko',
    avatar: false,
    lastSessionAt: now - 48 * 86_400_000,
    live: false,
    liveStartedAt: null,
    liveSets: 0,
    liveVolumeKg: 0,
    weekSessions: 0,
    weekVolumeKg: 0,
    weekDeltaPct: -100,
    programName: null,
    programWeek: null,
    dormantDays: 48,
  },
  {
    id: 'member4',
    name: 'Iryna Melnyk',
    avatar: false,
    lastSessionAt: now - 5 * 86_400_000,
    live: false,
    liveStartedAt: null,
    liveSets: 0,
    liveVolumeKg: 0,
    weekSessions: 2,
    weekVolumeKg: 6100,
    weekDeltaPct: -12,
    programName: 'Full body',
    programWeek: 6,
    dormantDays: null,
  },
];

const trainerNoLiveClients = trainerClients.map((client) =>
  client.live
    ? {
        ...client,
        live: false,
        liveStartedAt: null,
        liveSets: 0,
        liveVolumeKg: 0,
        lastSessionAt: now - 2 * 86_400_000,
      }
    : client,
);

const adminEmpty = { ...empty, people: [people[0]] };
const adminFailed = { ...empty, peopleError: true };
const trainerFilled = { ...empty, trainerClients };
const trainerEmpty = { ...empty, trainerClients: [] };
const trainerNoLive = { ...empty, trainerClients: trainerNoLiveClients };

async function setup(page, role, username, state) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();

    if (pathname === '/api/tracker/state') {
      return route.fulfill({
        json: { workouts: state.workouts ?? [], gyms: state.gyms ?? [], reminders: [] },
      });
    }
    if (pathname === '/api/notices')
      return route.fulfill({ json: { notices: state.notices ?? [] } });
    if (pathname === '/api/programs/mine') {
      return route.fulfill({ json: { assignment: state.assignment ?? null } });
    }
    if (pathname === '/api/programs') return route.fulfill({ json: { programs: [program] } });
    if (pathname === '/api/admin/users' && method === 'POST') {
      const body = route.request().postDataJSON();
      const created = person(
        'new1',
        body.name ?? `${body.firstName} ${body.lastName ?? ''}`.trim(),
        body.username,
        body.firstName,
        body.lastName ?? null,
        body.role,
        {
          trainerId: body.trainerId ?? null,
          trainerName: body.trainerId ? 'Olha Sydorenko' : null,
          status: 'invited',
          invite: {
            state: 'sent',
            expiresAt: now + 7 * 86_400_000,
            claimedAt: null,
            reRequestedAt: null,
            token: 'new-invite',
          },
        },
      );
      return route.fulfill({
        json: {
          person: created,
          invite: { token: 'new-invite', expires_at: now + 7 * 86_400_000 },
        },
      });
    }
    if (pathname === '/api/admin/people') {
      if (state.peopleError) return route.fulfill({ status: 500, json: { error: 'server' } });
      return route.fulfill({ json: { people: state.people ?? people } });
    }
    if (pathname === '/api/trainer/clients') {
      return route.fulfill({
        json: { clients: state.trainerClients ?? trainerClients },
      });
    }
    if (pathname.startsWith('/api/profile/users/')) {
      const id = decodeURIComponent(pathname.split('/').pop() ?? 'me');
      if (state.profileDenied) {
        return route.fulfill({ status: 403, json: { error: 'forbidden' } });
      }
      return route.fulfill({
        json: profile(id, id === 'me' ? 'self' : role === 'trainer' ? 'trainer' : 'admin', role),
      });
    }
    if (pathname.includes('/avatar')) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ json: { ok: true } });
  });

  await page.addInitScript(
    ({ role: nextRole, username: nextUsername, state: nextState }) => {
      localStorage.clear();
      localStorage.setItem('gym.token', 'fixture-token');
      localStorage.setItem('gym.username', nextUsername);
      localStorage.setItem('gym.role', nextRole);
      localStorage.setItem('gym.locale', 'en');
      localStorage.setItem('gym.state', JSON.stringify(nextState.workouts ?? []));
      localStorage.setItem('gym.gyms', JSON.stringify(nextState.gyms ?? []));
      localStorage.setItem('gym.reminders', JSON.stringify([]));
      localStorage.setItem('gym.queue', JSON.stringify(nextState.queue ?? []));
    },
    { role, username, state },
  );
}

async function snap(browser, name, role, hash, viewport, state, action) {
  const context = await browser.newContext({
    viewport,
    locale: 'en-US',
    timezoneId: 'UTC',
    deviceScaleFactor: viewport.width < 720 ? 2 : 1,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('gym.locale', 'en');
  });
  await setup(
    page,
    role,
    role === 'trainer' ? 'Olha Sydorenko' : role === 'admin' ? 'Admin User' : 'Marta Kovalenko',
    state,
  );
  await page.goto(`${baseUrl}/${hash}`, { waitUntil: 'networkidle', timeout: 20_000 });
  if (action) await action(page);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  const metrics = await page.evaluate(() => {
    const doc = globalThis.document;
    const win = globalThis.window;
    const boxOf = (selector) => {
      const el = doc.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    return {
      hash: win.location.hash,
      viewport: [win.innerWidth, win.innerHeight],
      body: [doc.body.scrollWidth, doc.body.scrollHeight],
      title: doc.querySelector('h1,h2')?.textContent ?? null,
      tabbar: [...doc.querySelectorAll('.tabbar button')].map((b) => b.textContent?.trim()),
      rail: boxOf('.rail'),
      liveHero: boxOf('.live-hero'),
      tabbarBox: boxOf('.tabbar'),
      screen: boxOf('.screen,.gym-detail'),
      overflows: [
        ...doc.querySelectorAll(
          'button,.card,.sheet,.program-card,.gym-card,.tr-client-card,.trainer-table-row,.admin-row,.input,.admin-role-card,.csv-row',
        ),
      ]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > win.innerWidth + 1 || r.left < -2 || r.right > win.innerWidth + 2;
        })
        .map((el) => ({
          cls: typeof el.className === 'string' ? el.className : '',
          text: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80),
          rect: (() => {
            const r = el.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          })(),
        }))
        .slice(0, 30),
    };
  });
  await context.close();
  return { name, metrics };
}

async function snapAuth(browser, name, viewport, action, opts = {}) {
  const context = await browser.newContext({
    viewport,
    locale: 'en-US',
    timezoneId: 'UTC',
    deviceScaleFactor: viewport.width < 720 ? 2 : 1,
  });
  const page = await context.newPage();
  await page.route('**/api/auth/status', async (route) => {
    if (opts.statusFail) return route.abort('failed');
    return route.fulfill({ json: { registered: !opts.registerOpen } });
  });
  await page.route('**/api/login', async (route) => {
    if (opts.holdLogin) return new Promise(() => {});
    return route.fulfill({ status: 401, json: { error: 'Wrong username or password' } });
  });
  await page.route('**/api/auth/login', async (route) => {
    if (opts.holdLogin) return new Promise(() => {});
    return route.fulfill({ status: 401, json: { error: 'Wrong username or password' } });
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 20_000 });
  if (action) await action(page);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  const metrics = await page.evaluate(() => {
    const doc = globalThis.document;
    const win = globalThis.window;
    return {
      hash: win.location.hash,
      viewport: [win.innerWidth, win.innerHeight],
      body: [doc.body.scrollWidth, doc.body.scrollHeight],
      title: doc.querySelector('h1,h2')?.textContent ?? null,
      error: doc.querySelector('.field-error,.error-card')?.textContent?.trim() ?? null,
      overflows: [...doc.querySelectorAll('button,.card,.auth-panel,.input')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > win.innerWidth + 1 || r.left < -2 || r.right > win.innerWidth + 2;
        })
        .map((el) => ({
          cls: typeof el.className === 'string' ? el.className : '',
          text: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80),
          rect: (() => {
            const r = el.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          })(),
        }))
        .slice(0, 30),
    };
  });
  await context.close();
  return { name, metrics };
}

async function snapOnboarding(browser, name, hash, viewport, action, opts = {}) {
  const context = await browser.newContext({
    viewport,
    locale: 'en-US',
    timezoneId: 'UTC',
    deviceScaleFactor: viewport.width < 720 ? 2 : 1,
    permissions: opts.denyGeo ? [] : ['geolocation'],
    geolocation: { latitude: 50.52, longitude: 30.49, accuracy: 40 },
  });
  const page = await context.newPage();
  await page.route('**/api/**', async (route) => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/auth/invite/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/request-new')) return route.fulfill({ json: { ok: true } });
    if (opts.deadInvite) {
      return route.fulfill({
        json: {
          state: opts.deadInvite,
          kind: 'invite',
          inviter: 'Andrii',
          name: 'Marta Kovalenko',
          firstName: 'Marta',
          lastName: 'Kovalenko',
          expiresAt: now - 86_400_000,
          claimedAt: null,
          revokedAt: null,
        },
      });
    }
    return route.fulfill({
      json: {
        state: 'valid',
        kind: 'invite',
        inviter: 'Andrii',
        name: 'Marta Kovalenko',
        firstName: 'Marta',
        lastName: 'Kovalenko',
        expiresAt: now + 6 * 86_400_000,
        claimedAt: null,
        revokedAt: null,
      },
    });
  });
  await page.route('**/api/auth/claim', async (route) => {
    return route.fulfill({
      json: {
        token: 'claimed-token',
        username: 'marta',
        name: 'Marta Kovalenko',
        role: 'member',
      },
    });
  });
  await page.route('**/photon.komoot.io/api/**', async (route) => {
    return route.fulfill({
      json: {
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [30.49, 50.5202] },
            properties: {
              name: 'Smartass Obolon',
              street: 'Prospekt Obolonskyi',
              housenumber: '1B',
              city: 'Kyiv',
              osm_id: 101,
              osm_type: 'N',
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [30.492, 50.521] },
            properties: {
              name: 'Iron Yard',
              street: 'Marshala Tymoshenka',
              housenumber: '4',
              city: 'Kyiv',
              osm_id: 102,
              osm_type: 'N',
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [30.495, 50.522] },
            properties: {
              name: 'Kachalka na Peremohy',
              street: 'Peremohy',
              housenumber: '24',
              city: 'Kyiv',
              osm_id: 103,
              osm_type: 'N',
            },
          },
        ],
      },
    });
  });
  await page.goto(`${baseUrl}/${hash}`, { waitUntil: 'networkidle', timeout: 20_000 });
  if (action) await action(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  const metrics = await page.evaluate(() => {
    const doc = globalThis.document;
    const win = globalThis.window;
    return {
      hash: win.location.hash,
      viewport: [win.innerWidth, win.innerHeight],
      body: [doc.body.scrollWidth, doc.body.scrollHeight],
      title: doc.querySelector('h1,h2')?.textContent ?? null,
      overflows: [...doc.querySelectorAll('button,.onb-card,.input,.searchbar,.onb-gym-card')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > win.innerWidth + 1 || r.left < -2 || r.right > win.innerWidth + 2;
        })
        .map((el) => ({
          cls: typeof el.className === 'string' ? el.className : '',
          text: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80),
          rect: (() => {
            const r = el.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          })(),
        }))
        .slice(0, 30),
    };
  });
  await context.close();
  return { name, metrics };
}

const scenarios = [
  ['phone-member-today-live', 'member', '#/today', { width: 390, height: 844 }, filled],
  [
    'phone-member-today-templates',
    'member',
    '#/today',
    { width: 632, height: 374 },
    memberProgramNoLive,
    async (page) => {
      await page.locator('.pane-side').evaluate((el) => {
        el.scrollIntoView({ block: 'start' });
      });
      await page.waitForSelector('.td-tpl');
    },
  ],
  ['phone-member-programs', 'member', '#/programs', { width: 390, height: 844 }, filled],
  [
    'phone-member-programs-no-live',
    'member',
    '#/programs',
    { width: 390, height: 844 },
    memberProgramNoLive,
  ],
  [
    'phone-member-program-detail-assigned',
    'member',
    '#/programs',
    { width: 390, height: 844 },
    memberProgramNoLive,
    async (page) => {
      await page.locator('.program-member-list-card.active').click();
      await page.waitForSelector('.program-member-detail');
      const menuCount = await page
        .locator('.program-member-detail-top .round-icon[aria-label="Menu"]')
        .count();
      if (menuCount !== 0) throw new Error('Assigned program detail exposes an inert menu');
    },
  ],
  [
    'phone-member-program-own-menu',
    'member',
    '#/programs',
    { width: 390, height: 844 },
    memberOwnProgram,
    async (page) => {
      await page.locator('.program-member-list-card.active').click();
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Edit plan' }).waitFor();
    },
  ],
  ['phone-member-session-live', 'member', '#/session', { width: 390, height: 844 }, filled],
  ['phone-member-session-empty', 'member', '#/session', { width: 390, height: 844 }, emptyLive],
  [
    'phone-member-session-empty-add-sheet',
    'member',
    '#/session',
    { width: 390, height: 844 },
    emptyLive,
    async (page) => {
      const finish = page.getByRole('button', { name: 'Finish' });
      if (!(await finish.isDisabled())) {
        throw new Error('Empty session Finish button must be disabled');
      }
      await page.getByRole('button', { name: 'Add exercise' }).click();
      await page.waitForSelector('.sheet');
    },
  ],
  [
    'phone-member-session-empty-discard-confirm',
    'member',
    '#/session',
    { width: 390, height: 844 },
    emptyLive,
    async (page) => {
      await page.getByRole('button', { name: 'Discard session' }).click();
      await page.getByRole('alertdialog').getByText('Discard session').waitFor();
    },
  ],
  ['phone-member-workout-past', 'member', '#/workout/done', { width: 390, height: 844 }, filled],
  [
    'phone-member-workout-auto-closed',
    'member',
    '#/workout/auto',
    { width: 390, height: 844 },
    filled,
  ],
  [
    'phone-member-session-exercise-menu',
    'member',
    '#/session',
    { width: 390, height: 844 },
    filled,
    async (page) => {
      await page.getByRole('button', { name: 'Menu' }).first().click();
      await page.waitForSelector('.menu-item');
    },
  ],
  [
    'phone-member-session-finish-warning',
    'member',
    '#/session',
    { width: 390, height: 844 },
    filled,
    async (page) => {
      await page.getByRole('button', { name: 'Finish' }).click();
      await page.getByText('Finish this session?').waitFor();
    },
  ],
  ['phone-member-progress', 'member', '#/progress', { width: 390, height: 844 }, filled],
  [
    'phone-member-progress-filled',
    'member',
    '#/progress',
    { width: 390, height: 844 },
    progressFilled,
  ],
  ['phone-member-gym-detail', 'member', '#/gym/g1', { width: 390, height: 844 }, filled],
  ['phone-member-gyms-empty', 'member', '#/gyms', { width: 390, height: 844 }, empty],
  ['phone-member-me', 'member', '#/me', { width: 390, height: 844 }, filled],
  [
    'phone-member-me-edit',
    'member',
    '#/me',
    { width: 390, height: 844 },
    filled,
    async (page) => {
      await page.getByRole('button', { name: 'Edit' }).click();
    },
  ],
  [
    'phone-member-me-password',
    'member',
    '#/me',
    { width: 390, height: 844 },
    filled,
    async (page) => {
      await page.getByRole('button', { name: 'Password' }).click();
    },
  ],
  [
    'phone-member-me-signout-confirm',
    'member',
    '#/me',
    { width: 390, height: 844 },
    filled,
    async (page) => {
      await page.getByRole('button', { name: 'Sign out' }).click();
    },
  ],
  ['phone-admin-people', 'admin', '#/people', { width: 390, height: 844 }, filled],
  ['phone-admin-people-no-live', 'admin', '#/people', { width: 390, height: 844 }, empty],
  ['phone-admin-people-empty', 'admin', '#/people', { width: 390, height: 844 }, adminEmpty],
  ['phone-admin-people-failed', 'admin', '#/people', { width: 390, height: 844 }, adminFailed],
  [
    'phone-admin-new-member-sheet',
    'admin',
    '#/people',
    { width: 390, height: 844 },
    filled,
    async (page) => {
      await page.getByRole('button', { name: /New member/ }).click();
      await page.waitForSelector('.admin-role-card');
    },
  ],
  [
    'phone-admin-new-member-role-trainer',
    'admin',
    '#/people',
    { width: 390, height: 844 },
    filled,
    async (page) => {
      await page.getByRole('button', { name: /New member/ }).click();
      await page.locator('.admin-role-card').nth(1).click();
    },
  ],
  [
    'phone-admin-new-member-role-admin',
    'admin',
    '#/people',
    { width: 390, height: 844 },
    filled,
    async (page) => {
      await page.getByRole('button', { name: /New member/ }).click();
      await page.locator('.admin-role-card').nth(2).click();
    },
  ],
  [
    'phone-admin-invite-link',
    'admin',
    '#/people',
    { width: 390, height: 844 },
    filled,
    async (page) => {
      await page.getByRole('button', { name: /New member/ }).click();
      await page.getByPlaceholder('First name').fill('Iryna');
      await page.getByPlaceholder('Last name').fill('Shevchenko');
      await page.getByPlaceholder('Username').fill('iryna');
      await page.getByRole('button', { name: /^Save$/ }).click();
      await page.getByText('Account created').waitFor();
    },
  ],
  [
    'phone-admin-person-menu',
    'admin',
    '#/people',
    { width: 390, height: 844 },
    filled,
    async (page) => {
      await page.locator('.admin-table .admin-row .dots').first().click();
      await page.waitForSelector('.menu-item');
    },
  ],
  ['phone-admin-member-profile', 'admin', '#/profile/member1', { width: 390, height: 844 }, filled],
  ['phone-trainer-clients', 'trainer', '#/today', { width: 390, height: 844 }, trainerFilled],
  [
    'phone-trainer-clients-no-live',
    'trainer',
    '#/today',
    { width: 390, height: 844 },
    trainerNoLive,
  ],
  ['phone-trainer-clients-empty', 'trainer', '#/today', { width: 390, height: 844 }, trainerEmpty],
  ['phone-trainer-programs', 'trainer', '#/programs', { width: 390, height: 844 }, trainerFilled],
  [
    'phone-trainer-program-csv-pick',
    'trainer',
    '#/programs',
    { width: 390, height: 844 },
    empty,
    async (page) => {
      await page
        .getByRole('button', { name: /Import CSV/ })
        .first()
        .click();
      await page.waitForSelector('.csv-pick');
    },
  ],
  [
    'phone-trainer-program-csv-preview',
    'trainer',
    '#/programs',
    { width: 390, height: 844 },
    empty,
    async (page) => {
      await page
        .getByRole('button', { name: /Import CSV/ })
        .first()
        .click();
      await page.locator('.csv-paste').fill(`day,name,kind,sets,reps,equipment
1,Bench press,strength,4,8,barbell
1,Seated row,strength,3,10,machine
2,Bike,cardio,,,bike`);
      await page.getByRole('button', { name: /^Continue$/ }).click();
      await page.getByRole('button', { name: /^Continue$/ }).click();
      await page.waitForSelector('.csv-preview');
    },
  ],
  [
    'phone-trainer-client-profile',
    'trainer',
    '#/profile/member1',
    { width: 390, height: 844 },
    trainerFilled,
  ],
  [
    'phone-trainer-client-profile-denied',
    'trainer',
    '#/profile/member1',
    { width: 390, height: 844 },
    { ...trainerFilled, profileDenied: true },
  ],
  ['desktop-member-today', 'member', '#/today', { width: 1440, height: 900 }, filled],
  ['desktop-member-session-live', 'member', '#/session', { width: 1440, height: 900 }, filled],
  [
    'desktop-member-session-empty-wide',
    'member',
    '#/session',
    { width: 2048, height: 1152 },
    emptyLive,
  ],
  ['desktop-member-workout-past', 'member', '#/workout/done', { width: 1440, height: 900 }, filled],
  ['desktop-member-progress', 'member', '#/progress', { width: 1440, height: 900 }, filled],
  [
    'desktop-member-progress-filled',
    'member',
    '#/progress',
    { width: 1440, height: 900 },
    progressFilled,
  ],
  ['desktop-member-programs', 'member', '#/programs', { width: 1440, height: 900 }, filled],
  [
    'desktop-member-programs-no-live',
    'member',
    '#/programs',
    { width: 1440, height: 900 },
    memberProgramNoLive,
  ],
  ['desktop-member-gyms', 'member', '#/gyms', { width: 1440, height: 900 }, filled],
  ['desktop-admin-programs-wide', 'admin', '#/programs', { width: 2048, height: 1152 }, filled],
  [
    'desktop-admin-program-menu',
    'admin',
    '#/programs',
    { width: 2048, height: 1152 },
    filled,
    async (page) => {
      await page.locator('.program-more').click();
      const menu = page.getByRole('dialog');
      await menu.getByRole('button', { name: 'Duplicate' }).waitFor();
      await menu.getByRole('button', { name: 'Archive' }).waitFor();
      await menu.getByRole('button', { name: 'Delete' }).waitFor();
    },
  ],
  [
    'desktop-admin-programs-wide-no-live',
    'admin',
    '#/programs',
    { width: 2048, height: 1152 },
    empty,
  ],
  [
    'desktop-admin-programs-wide-new',
    'admin',
    '#/programs',
    { width: 2048, height: 1152 },
    empty,
    async (page) => {
      await page
        .getByRole('button', { name: /New program/ })
        .first()
        .click();
    },
  ],
  ['desktop-admin-people', 'admin', '#/people', { width: 1440, height: 900 }, filled],
  ['desktop-admin-people-empty', 'admin', '#/people', { width: 1440, height: 900 }, adminEmpty],
  ['desktop-admin-people-failed', 'admin', '#/people', { width: 1440, height: 900 }, adminFailed],
  [
    'desktop-admin-new-member-dialog',
    'admin',
    '#/people',
    { width: 1440, height: 900 },
    filled,
    async (page) => {
      await page.getByRole('button', { name: /New member/ }).click();
      await page.waitForSelector('.admin-role-card');
    },
  ],
  ['desktop-trainer-team', 'trainer', '#/today', { width: 1440, height: 900 }, trainerFilled],
  [
    'desktop-trainer-team-no-live',
    'trainer',
    '#/today',
    { width: 1440, height: 900 },
    trainerNoLive,
  ],
  ['desktop-trainer-team-empty', 'trainer', '#/today', { width: 1440, height: 900 }, trainerEmpty],
  [
    'desktop-trainer-program-assign',
    'trainer',
    '#/programs',
    { width: 1440, height: 900 },
    empty,
    async (page) => {
      await page.getByRole('button', { name: /^Assign$/ }).click();
      await page.getByRole('button', { name: /Marta Kovalenko/ }).click();
      await page.waitForSelector('.assign-sheet');
    },
  ],
  [
    'desktop-trainer-client-profile',
    'trainer',
    '#/profile/member1',
    { width: 1440, height: 900 },
    trainerFilled,
  ],
  [
    'desktop-trainer-client-profile-denied',
    'trainer',
    '#/profile/member1',
    { width: 1440, height: 900 },
    { ...trainerFilled, profileDenied: true },
  ],
  ['desktop-member-me', 'member', '#/me', { width: 1440, height: 900 }, filled],
];

const browser = await chromium.launch({ headless: true });
const report = [
  await snapAuth(browser, 'phone-auth-idle', { width: 390, height: 844 }),
  await snapAuth(browser, 'phone-auth-wrong-creds', { width: 390, height: 844 }, async (page) => {
    await page.locator('input').nth(0).fill('marta@example.com');
    await page.locator('input').nth(1).fill('badpass');
    await page.locator('form.auth-body').dispatchEvent('submit');
    await page.waitForSelector('.field-error');
  }),
  await snapAuth(
    browser,
    'phone-auth-server-unreachable',
    { width: 390, height: 844 },
    async (page) => {
      await page.getByText("Can't reach the server").waitFor();
    },
    { statusFail: true },
  ),
  await snapAuth(
    browser,
    'phone-auth-submitting',
    { width: 390, height: 844 },
    async (page) => {
      await page.locator('input').nth(0).fill('marta@example.com');
      await page.locator('input').nth(1).fill('password');
      await page.locator('form.auth-body').dispatchEvent('submit');
      await page.waitForSelector('.sp');
    },
    { holdLogin: true },
  ),
  await snapAuth(
    browser,
    'phone-auth-signup',
    { width: 390, height: 844 },
    async (page) => {
      await page.getByText('Create your account').waitFor();
    },
    { registerOpen: true },
  ),
  await snapAuth(
    browser,
    'phone-auth-signup-validation',
    { width: 390, height: 844 },
    async (page) => {
      await page.getByText('Create your account').waitFor();
      await page.getByPlaceholder('First name').fill('M');
      await page.getByPlaceholder('Username').fill('m');
      await page.getByPlaceholder(/Password/).fill('123');
      for (const input of await page.locator('input').all()) await input.blur();
      await page.getByText('6 characters minimum').waitFor();
    },
    { registerOpen: true },
  ),
  await snapAuth(browser, 'desktop-auth-idle', { width: 1120, height: 700 }),
  await snapAuth(
    browser,
    'desktop-auth-wrong-creds',
    { width: 1120, height: 700 },
    async (page) => {
      await page.locator('input').nth(0).fill('marta@example.com');
      await page.locator('input').nth(1).fill('badpass');
      await page.locator('form.auth-body').dispatchEvent('submit');
      await page.waitForSelector('.field-error');
    },
  ),
  await snapOnboarding(browser, 'phone-onboarding-arrival', '#/join/invite-token', {
    width: 390,
    height: 844,
  }),
  await snapOnboarding(
    browser,
    'phone-onboarding-step-account',
    '#/join/invite-token',
    { width: 390, height: 844 },
    async (page) => {
      await page.getByRole('button', { name: /Start/ }).click();
      await page.getByText("Let's get your name").waitFor();
    },
  ),
  await snapOnboarding(
    browser,
    'phone-onboarding-step-avatar',
    '#/join/invite-token',
    { width: 390, height: 844 },
    async (page) => {
      await page.getByRole('button', { name: /Start/ }).click();
      await page.getByPlaceholder(/Password/).fill('password');
      await page.getByRole('button', { name: /Continue/ }).click();
      await page.getByText('A photo').waitFor();
    },
  ),
  await snapOnboarding(
    browser,
    'phone-onboarding-step-gym',
    '#/join/invite-token',
    { width: 390, height: 844 },
    async (page) => {
      await page.getByRole('button', { name: /Start/ }).click();
      await page.getByPlaceholder(/Password/).fill('password');
      await page.getByRole('button', { name: /Continue/ }).click();
      await page.getByRole('button', { name: /Skip/ }).click();
      await page.getByText('Where do you').waitFor();
      await page.waitForTimeout(500);
    },
  ),
  await snapOnboarding(
    browser,
    'phone-onboarding-final',
    '#/join/invite-token',
    { width: 390, height: 844 },
    async (page) => {
      await page.getByRole('button', { name: /Start/ }).click();
      await page.getByPlaceholder(/Password/).fill('password');
      await page.getByRole('button', { name: /Continue/ }).click();
      await page.getByRole('button', { name: /Skip/ }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Smartass Obolon/ }).click();
      await page.getByText("You're in. Bar's loaded.").waitFor();
    },
  ),
  await snapOnboarding(
    browser,
    'phone-onboarding-dead-link',
    '#/join/invite-token',
    { width: 390, height: 844 },
    async (page) => {
      await page.getByText('This link is no longer valid.').waitFor();
    },
    { deadInvite: 'expired' },
  ),
];
for (const scenario of scenarios) {
  report.push(await snap(browser, ...scenario));
}
await browser.close();

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(out);
console.log(JSON.stringify(report, null, 2));
