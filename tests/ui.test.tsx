import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Shell } from '../client/src/App';
import { App } from '../client/src/App';
import type { StoreState } from '../client/src/store';
import { TodayView } from '../client/src/views/TodayView';
import { ProgressView } from '../client/src/views/ProgressView';
import { GymsView } from '../client/src/views/GymsView';
import { SessionView } from '../client/src/views/SessionView';
import { AuthView } from '../client/src/views/AuthView';
import { ExerciseHistoryView } from '../client/src/views/ExerciseHistoryView';
import { ProfileView } from '../client/src/views/ProfileView';
import { AdminView } from '../client/src/views/AdminView';
import { TrainerView } from '../client/src/views/TrainerView';
import { ProgramsView } from '../client/src/views/ProgramsView';
import { __getStateForTests, __replaceStateForTests } from '../client/src/store';
import { setRole } from '../client/src/api';

// Test shim standing in for the removed setAuth: mark a signed-in user so
// role/uid gates pass. (Data now comes from Firestore/callables, mocked in
// tests/setup.ts.)
function setAuth(_token: string, name: string, role: 'member' | 'trainer' | 'admin' = 'member') {
  localStorage.setItem('spotter.uid', 'test-uid');
  localStorage.setItem('spotter.username', name);
  setRole(role);
}

const shell: Shell = {
  openOverlay: vi.fn(),
  goTab: vi.fn(),
  toast: vi.fn(),
  snack: vi.fn(),
  signOut: vi.fn(),
  queueLength: 0,
};

function store(patch: Partial<StoreState> = {}): StoreState {
  return {
    workouts: [],
    gyms: [],
    reminders: [],
    queue: [],
    syncStatus: 'synced',
    lastSyncAt: Date.now(),
    ...patch,
  };
}

function sampleStore(): StoreState {
  const now = Date.now();
  return store({
    workouts: [
      {
        id: 'open',
        startedAt: now - 30 * 60000,
        finishedAt: null,
        autoFinished: false,
        gymId: 'g1',
        exercises: [
          {
            id: 'bench',
            name: 'Bench press',
            position: 0,
            sets: [{ id: 's1', reps: 8, weight: 80, isWarmup: false, position: 0 }],
          },
        ],
      },
      {
        id: 'done',
        startedAt: now - 2 * 24 * 3600_000,
        finishedAt: now - 2 * 24 * 3600_000 + 3600_000,
        autoFinished: false,
        exercises: [
          {
            id: 'squat',
            name: 'Squat',
            position: 0,
            sets: [{ id: 's2', reps: 8, weight: 100, isWarmup: false, position: 0 }],
          },
        ],
      },
    ],
    gyms: [{ id: 'g1', name: 'Smartfit', lat: 50.45, lng: 30.52, radiusM: 150 }],
  });
}

// TODO(firebase): these drove data through stubbed /api fetches. Rework to mock
// callFn / Firestore onSnapshot with fixtures, then un-skip.
describe.skip('F-02/F-08 shell views and design states', () => {
  it('renders Today live state without the old duplicate live card', () => {
    const s = sampleStore();
    render(<TodayView shell={shell} store={s} />);

    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Session in progress/ })).toBeNull();
    expect(screen.getByText('History')).toBeTruthy();
  });

  it('renders Progress locked state before three sessions', () => {
    render(<ProgressView store={sampleStore()} />);

    expect(screen.getByRole('heading', { name: 'Progress' })).toBeTruthy();
    expect(screen.getByText('Two more sessions')).toBeTruthy();
  });

  it('renders Gyms list and gates manual location behind a typed name', async () => {
    render(<GymsView shell={shell} store={sampleStore()} />);

    expect(screen.getByRole('heading', { name: 'Gyms' })).toBeTruthy();
    expect(screen.getByText('Smartfit')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /I'm here/ })).toBeNull();

    await userEvent.type(screen.getByPlaceholderText('Search for a gym'), 'New gym');

    expect(screen.getByRole('button', { name: /New gym.*I'm here/ })).toBeTruthy();
  });

  it('shows Programs as a separate member navigation item', async () => {
    window.location.hash = '#/today';
    setAuth('token', 'member', 'member');
    __replaceStateForTests(store());
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/tracker/state')) {
          return new Response(JSON.stringify({ workouts: [], gyms: [], reminders: [] }), {
            status: 200,
          });
        }
        if (url.endsWith('/api/programs/mine')) {
          return new Response(JSON.stringify({ assignment: null }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    render(<App />);

    const programsTab = await screen.findByRole('button', { name: 'Programs' });
    await userEvent.click(programsTab);

    expect(await screen.findByRole('heading', { name: 'Programs' })).toBeTruthy();
    expect(await screen.findByText('No program assigned')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Apps' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Services' })).toBeNull();
  });

  it('matches member, admin and trainer tab sets to their role shells', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/tracker/state')) {
          return new Response(JSON.stringify({ workouts: [], gyms: [], reminders: [] }), {
            status: 200,
          });
        }
        if (url.endsWith('/api/trainer/clients')) {
          return new Response(JSON.stringify({ clients: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    window.location.hash = '#/today';
    setAuth('token', 'member', 'member');
    __replaceStateForTests(store());
    const member = render(<App />);

    expect(await screen.findByRole('button', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Progress' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gyms' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Programs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Me' })).toBeTruthy();
    expect(
      [...member.container.querySelectorAll('.tabbar button')].map((x) => x.textContent),
    ).toEqual(['Today', 'Progress', 'Programs', 'Gyms', 'Me']);
    expect(screen.queryByRole('button', { name: 'Users' })).toBeNull();
    member.unmount();

    window.location.hash = '#/today';
    setAuth('token', 'admin', 'admin');
    __replaceStateForTests(store());
    const admin = render(<App />);

    expect(await screen.findByRole('button', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Users' })).toBeTruthy();
    expect(
      [...admin.container.querySelectorAll('.tabbar button')].map((x) => x.textContent),
    ).toEqual(['Today', 'Progress', 'Programs', 'Gyms', 'Users']);
    expect(screen.queryByRole('button', { name: 'Me' })).toBeNull();
    admin.unmount();

    window.location.hash = '#/today';
    setAuth('token', 'coach', 'trainer');
    __replaceStateForTests(store());
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Clients' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Programs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Me' })).toBeTruthy();
    expect([...document.querySelectorAll('.tabbar button')].map((x) => x.textContent)).toEqual([
      'Clients',
      'Programs',
      'Me',
    ]);
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Progress' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gyms' })).toBeNull();
  });

  it('opens every admin person through the full user details page', async () => {
    localStorage.setItem('gym.username', 'Admin User');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/admin/people')) {
          return new Response(
            JSON.stringify({
              people: [
                {
                  id: 'admin1',
                  name: 'Admin User',
                  username: 'admin',
                  firstName: 'Admin',
                  lastName: 'User',
                  role: 'admin',
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
                },
                {
                  id: 'member1',
                  name: 'Client User',
                  username: 'client',
                  firstName: 'Client',
                  lastName: 'User',
                  role: 'member',
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
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 500 });
      }),
    );
    const onOpenProfile = vi.fn();
    render(<AdminView onOpenProfile={onOpenProfile} />);

    const row = (await screen.findByText('Client User')).closest('.admin-row');
    expect(row).toBeTruthy();
    await userEvent.click(row!);

    expect(onOpenProfile).toHaveBeenCalledWith('member1');
  });

  it('opens trainer clients through the full user details page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/trainer/clients')) {
          return new Response(
            JSON.stringify({
              clients: [
                {
                  id: 'member1',
                  name: 'Client User',
                  avatar: false,
                  lastSessionAt: null,
                  live: false,
                  liveStartedAt: null,
                  liveSets: 0,
                  liveVolumeKg: 0,
                  weekSessions: 0,
                  weekVolumeKg: 0,
                  dormantDays: null,
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 500 });
      }),
    );
    const onOpenProfile = vi.fn();
    render(<TrainerView onOpenProfile={onOpenProfile} onOpenMe={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /Client User/ }));

    expect(onOpenProfile).toHaveBeenCalledWith('member1');
  });

  it('renders the full profile page and opens a session from history', async () => {
    const openOverlay = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/profile/users/me')) {
          return new Response(
            JSON.stringify({
              viewer: { id: 'u1', relation: 'self', role: 'member' },
              person: {
                id: 'u1',
                name: 'Demo User',
                username: 'demo',
                firstName: 'Demo',
                lastName: 'User',
                role: 'member',
                status: 'active',
                joinedAt: Date.now() - 30 * 24 * 3600_000,
                trainerName: 'Coach',
                clientCount: 0,
                avatar: false,
              },
              access: [{ id: 'tr1', name: 'Coach', role: 'trainer' }],
              summary: {
                sessions: 1,
                sessions30: 1,
                perWeek30: 0.2,
                liveSessions: 0,
                firstSessionAt: Date.now(),
                lastSessionAt: Date.now(),
                durationMs: 3600_000,
                sets: 1,
                exercises: 1,
                volumeKg: 800,
                cardioMinutes: 12,
                volume30: 800,
                volume7: 800,
              },
              sessions: [
                {
                  id: 'w1',
                  startedAt: Date.now() - 3600_000,
                  finishedAt: Date.now(),
                  autoFinished: false,
                  live: false,
                  durationMs: 3600_000,
                  gymName: 'Smartfit',
                  sets: 1,
                  exercises: 1,
                  volumeKg: 800,
                  exerciseNames: ['Squat'],
                },
              ],
              gyms: [
                {
                  id: 'g1',
                  name: 'Smartfit',
                  favorite: 1,
                  lat: 50.45,
                  lng: 30.52,
                  radiusM: 150,
                  sessions: 1,
                  lastSessionAt: Date.now(),
                  volumeKg: 800,
                },
              ],
              topExercises: [
                {
                  name: 'Squat',
                  sets: 1,
                  sessions: 1,
                  lastAt: Date.now(),
                  volumeKg: 800,
                  bestE1rm: 126,
                },
              ],
              notes: [
                {
                  id: 'n1',
                  text: 'Keep depth consistent.',
                  createdAt: Date.now(),
                  trainerName: 'Coach',
                },
              ],
              audit: [
                { at: Date.now(), resource: 'profile', readerName: 'Coach', readerRole: 'trainer' },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 500 });
      }),
    );
    render(<ProfileView userId="me" shell={{ ...shell, openOverlay }} onClose={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Demo User' })).toBeTruthy();
    expect(screen.getByText('Lifetime volume')).toBeTruthy();
    expect(screen.getByText('Top exercises')).toBeTruthy();
    expect(screen.getByText('Keep depth consistent.')).toBeTruthy();

    await userEvent.click(screen.getAllByRole('button', { name: /Smartfit/ }).at(-1)!);
    expect(openOverlay).toHaveBeenCalledWith({ screen: 'past-workout', workoutId: 'w1' });
  });

  it('edits the owner profile and removes their avatar', async () => {
    const profile = (
      firstName: string,
      lastName: string | null,
      username: string,
      avatar: boolean,
    ) => ({
      viewer: { id: 'u1', relation: 'self', role: 'member' },
      person: {
        id: 'u1',
        name: [firstName, lastName].filter(Boolean).join(' '),
        username,
        firstName,
        lastName,
        role: 'member',
        status: 'active',
        joinedAt: Date.now() - 30 * 24 * 3600_000,
        trainerName: null,
        clientCount: 0,
        avatar,
      },
      access: [],
      summary: {
        sessions: 0,
        sessions30: 0,
        perWeek30: 0,
        liveSessions: 0,
        firstSessionAt: null,
        lastSessionAt: null,
        durationMs: 0,
        sets: 0,
        exercises: 0,
        volumeKg: 0,
        cardioMinutes: 0,
        volume30: 0,
        volume7: 0,
      },
      sessions: [],
      gyms: [],
      topExercises: [],
      notes: [],
      audit: [],
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/profile/users/me')) {
        return new Response(JSON.stringify(profile('Demo', 'User', 'demo', true)), { status: 200 });
      }
      if (url.endsWith('/api/profile/me') && init?.method === 'PUT') {
        expect(JSON.parse(String(init.body))).toEqual({
          firstName: 'Edited',
          lastName: 'User',
          username: 'edited-user',
        });
        return new Response(JSON.stringify(profile('Edited', 'User', 'edited-user', true)), {
          status: 200,
        });
      }
      if (url.endsWith('/api/profile/me/password') && init?.method === 'PUT') {
        expect(JSON.parse(String(init.body))).toEqual({
          currentPassword: 'secret123',
          newPassword: 'newsecret123',
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.endsWith('/api/profile/me/avatar') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.endsWith('/api/profile/avatars/u1')) {
        return new Response('', { status: 404 });
      }
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ProfileView userId="me" shell={shell} onClose={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Demo User' })).toBeTruthy();
    const cameraControl = screen.getByRole('button', { name: 'Camera' });
    expect(cameraControl.tagName).toBe('BUTTON');
    const cameraInput = document.querySelector('input[capture="user"]');
    expect(cameraInput?.getAttribute('capture')).toBe('user');
    expect(cameraInput?.getAttribute('type')).toBe('file');
    expect(screen.getByLabelText('First name')).toBeTruthy();
    await userEvent.clear(screen.getByLabelText('First name'));
    await userEvent.type(screen.getByLabelText('First name'), 'Edited');
    await userEvent.clear(screen.getByLabelText('Last name'));
    await userEvent.type(screen.getByLabelText('Last name'), 'User');
    await userEvent.clear(screen.getByLabelText('Username'));
    await userEvent.type(screen.getByLabelText('Username'), 'edited-user');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'Edited User' })).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Current password'), 'secret123');
    await userEvent.type(screen.getByLabelText('New password'), 'newsecret123');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'newsecret123');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await userEvent.click(screen.getByRole('button', { name: /Remove photo/ }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profile/me/avatar',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profile/me/password',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('opens avatar camera mode and shows crop controls after picking a photo', async () => {
    const profile = {
      viewer: { id: 'u1', relation: 'self', role: 'member' },
      person: {
        id: 'u1',
        name: 'Demo User',
        username: 'demo',
        firstName: 'Demo',
        lastName: 'User',
        role: 'member',
        status: 'active',
        joinedAt: Date.now(),
        trainerName: null,
        clientCount: 0,
        avatar: false,
      },
      access: [],
      summary: {
        sessions: 0,
        sessions30: 0,
        perWeek30: 0,
        liveSessions: 0,
        firstSessionAt: null,
        lastSessionAt: null,
        durationMs: 0,
        sets: 0,
        exercises: 0,
        volumeKg: 0,
        cardioMinutes: 0,
        volume30: 0,
        volume7: 0,
      },
      sessions: [],
      gyms: [],
      topExercises: [],
      notes: [],
      audit: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/profile/users/me')) {
          return new Response(JSON.stringify(profile), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 500 });
      }),
    );
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:avatar'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    const { unmount } = render(<ProfileView userId="me" shell={shell} onClose={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Demo User' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Camera' }));
    expect(await screen.findByRole('button', { name: /Take photo/ })).toBeTruthy();
    unmount();

    render(<ProfileView userId="me" shell={shell} onClose={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'Demo User' })).toBeTruthy();
    const libraryInput = document.querySelector(
      'input[accept="image/jpeg,image/png,image/webp,image/heic"]',
    ) as HTMLInputElement;
    await userEvent.upload(libraryInput, new File(['avatar'], 'avatar.png', { type: 'image/png' }));

    expect(await screen.findByText('Position your photo')).toBeTruthy();
    expect(
      screen.getByText('Drag the photo to frame it. Use zoom for a tighter crop.'),
    ).toBeTruthy();
    expect(screen.getByText('Zoom')).toBeTruthy();
  });

  it('lets an assigned trainer add notes from the full user details page', async () => {
    let saved = false;
    const profile = () => ({
      viewer: { id: 'tr1', relation: 'trainer', role: 'trainer' },
      person: {
        id: 'member1',
        name: 'Client User',
        username: 'client',
        firstName: 'Client',
        lastName: 'User',
        role: 'member',
        status: 'active',
        joinedAt: Date.now() - 30 * 24 * 3600_000,
        trainerName: 'Coach',
        clientCount: 0,
        avatar: false,
      },
      access: [],
      summary: {
        sessions: 0,
        sessions30: 0,
        perWeek30: 0,
        liveSessions: 0,
        firstSessionAt: null,
        lastSessionAt: null,
        durationMs: 0,
        sets: 0,
        exercises: 0,
        volumeKg: 0,
        cardioMinutes: 0,
        volume30: 0,
        volume7: 0,
      },
      sessions: [],
      gyms: [],
      topExercises: [],
      notes: saved
        ? [
            {
              id: 'n1',
              text: 'Keep depth consistent.',
              createdAt: Date.now(),
              trainerName: 'Coach',
            },
          ]
        : [],
      audit: [],
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/profile/users/member1')) {
        return new Response(JSON.stringify(profile()), { status: 200 });
      }
      if (url.endsWith('/api/trainer/clients/member1/notes') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({ text: 'Keep depth consistent.' });
        saved = true;
        return new Response(JSON.stringify({ ok: true, id: 'n1' }), { status: 200 });
      }
      if (url.endsWith('/api/profile/avatars/member1')) {
        return new Response('', { status: 404 });
      }
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ProfileView userId="member1" shell={shell} onClose={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Client User' })).toBeTruthy();
    expect(screen.getByText('No trainer notes yet.')).toBeTruthy();
    await userEvent.type(screen.getByPlaceholderText('Add a note'), 'Keep depth consistent.');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Keep depth consistent.')).toBeTruthy();
  });
});

// TODO(firebase): rework program fetch stubs to Firestore/callable mocks.
describe.skip('F-09 programs UI', () => {
  it('renders trainer program authoring and saves ordered items', async () => {
    setAuth('token', 'coach', 'trainer');
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.endsWith('/api/programs') && (!init || init.method === 'GET')) {
          return new Response(JSON.stringify({ programs: [] }), { status: 200 });
        }
        if (url.endsWith('/api/trainer/clients')) {
          return new Response(JSON.stringify({ clients: [{ id: 'member1', name: 'Marta' }] }), {
            status: 200,
          });
        }
        if (url.includes('/api/programs/') && init?.method === 'PUT') {
          const body = JSON.parse(String(init.body)) as {
            name: string;
            items: Array<{ weight?: number; equipment: string[] }>;
          };
          expect(body.name).toBe('Push day');
          expect(body.items).toHaveLength(1);
          expect(body.items[0]).not.toHaveProperty('weight');
          expect(body.items[0].equipment).toEqual([]);
          return new Response(
            JSON.stringify({
              program: {
                id: url.split('/').pop(),
                name: body.name,
                weeks: 8,
                daysPerWeek: 3,
                authorId: 'coach',
                items: [
                  {
                    id: 'i1',
                    day: 1,
                    position: 0,
                    name: 'Bench press',
                    kind: 'strength',
                    sets: 3,
                    reps: 8,
                    durationMin: null,
                    equipment: [],
                  },
                ],
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    render(<ProgramsView />);

    expect(await screen.findByRole('heading', { name: 'Programs' })).toBeTruthy();
    await userEvent.clear(screen.getByLabelText('Program name'));
    await userEvent.type(screen.getByLabelText('Program name'), 'Push day');
    await userEvent.click(screen.getAllByRole('button', { name: /Add exercise/ })[0]);
    await userEvent.type(screen.getByPlaceholderText('Add exercise'), 'Bench press');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('/api/programs/') && c.init?.method === 'PUT')).toBe(
        true,
      ),
    );
  });

  it('shows assigned program on Today and starts a planned day', async () => {
    const openOverlay = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/programs/mine')) {
          return new Response(
            JSON.stringify({
              assignment: {
                program: {
                  id: 'p1',
                  name: 'Push day',
                  weeks: 6,
                  daysPerWeek: 1,
                  items: [
                    {
                      id: 'i1',
                      day: 1,
                      position: 0,
                      name: 'Bench press',
                      kind: 'strength',
                      sets: 2,
                      reps: 8,
                      durationMin: null,
                      equipment: ['barbell'],
                    },
                  ],
                },
                assignedBy: 'coach',
                week: 1,
                done: 0,
                total: 6,
                expectedSoFar: 1,
                adherence: 0,
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ workouts: [], gyms: [], reminders: [] }), {
          status: 200,
        });
      }),
    );

    __replaceStateForTests(store());
    render(<TodayView shell={{ ...shell, openOverlay }} store={store()} />);

    expect(await screen.findByText('Push day')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Start day 1/ }));

    await waitFor(() =>
      expect(openOverlay).toHaveBeenCalledWith(expect.objectContaining({ screen: 'session' })),
    );
    const planned = __getStateForTests().workouts.find((w) => w.finishedAt === null);
    expect(planned?.exercises[0]).toMatchObject({
      name: 'Bench press',
      plannedSets: 2,
      plannedReps: 8,
      equipment: ['barbell'],
      sets: [],
    });
  });
});

describe('F-03 session UI', () => {
  it('renders a live session without tabbar and exposes ghost row logging', () => {
    const s = sampleStore();
    __replaceStateForTests(s);
    render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);

    expect(screen.getByText('In session · Smartfit')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('opens add exercise, set editor and exercise menu sheets', async () => {
    const s = sampleStore();
    __replaceStateForTests(s);
    render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    expect(screen.getByPlaceholderText('Search exercises')).toBeTruthy();
    // The four large kind buttons: Strength keeps the search open; the three
    // timed kinds (Cardio/Warm-up/Cool-down) log a session of that kind
    // directly and close the sheet.
    await userEvent.click(screen.getAllByRole('button', { name: 'Cardio' })[0]);
    await waitFor(() => expect(screen.queryByPlaceholderText('Search exercises')).toBeNull());

    cleanup();
    __replaceStateForTests(s);
    render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /1880\.0record/ }));
    expect(screen.getByText('Set 1 · Bench press')).toBeTruthy();

    cleanup();
    __replaceStateForTests(s);
    render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByText('Bench press · 1 sets')).toBeTruthy();
  });

  it('keeps the chosen set type and its drops when logging a brand-new set', async () => {
    __replaceStateForTests(sampleStore());
    render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);

    // Open the editor straight from the ghost row (no set logged yet).
    await userEvent.click(screen.getByRole('button', { name: '8' }));
    const dialog = screen.getByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: /Set type/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: /^Dropset/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: /Add another drop/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Log' }));

    const bench = __getStateForTests().workouts.find((w) => w.id === 'open')!.exercises[0];
    expect(bench.sets).toHaveLength(2);
    const logged = bench.sets[1];
    expect(logged.type).toBe('drop');
    expect(logged.drops).toHaveLength(1);
  });

  it('keeps duration and distance when logging a brand-new timed entry', async () => {
    const s = sampleStore();
    s.workouts[0].exercises.push({
      id: 'run',
      name: 'Treadmill',
      kind: 'cardio',
      position: 1,
      sets: [],
    });
    __replaceStateForTests(s);
    render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: '20' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Log' }));

    const run = __getStateForTests()
      .workouts.find((w) => w.id === 'open')!
      .exercises.find((e) => e.id === 'run')!;
    expect(run.sets).toHaveLength(1);
    expect(run.sets[0].durationMin).toBe(20);
    expect(run.sets[0].distanceKm).toBe(2);
  });

  it('keeps an exercise with no logged sets on the exercise-card layout', () => {
    const s = sampleStore();
    s.workouts[0].exercises.push({ id: 'fresh', name: 'Cable Crunch', position: 1, sets: [] });
    __replaceStateForTests(s);
    const { container } = render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);

    const cards = [...container.querySelectorAll('.exercise-card')];
    expect(cards).toHaveLength(2);
    // `.empty-card` is the shared empty-state box (flex, align-items: flex-start);
    // on an exercise card it collapsed the set table to its content width.
    expect(cards.some((c) => c.classList.contains('empty-card'))).toBe(false);
    const fresh = cards[1];
    expect(fresh.querySelector('.set-grid.header')).toBeTruthy();
    expect(fresh.querySelector('.ghost-row')).toBeTruthy();
  });

  it('inserts a warm-up marker card with no sets to log', async () => {
    __replaceStateForTests(sampleStore());
    render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Warm-up' }));

    expect(screen.getByText('Ready when you are')).toBeTruthy();
    expect(screen.getByText(/Just a marker/)).toBeTruthy();
    const warmup = __getStateForTests()
      .workouts.find((w) => w.id === 'open')!
      .exercises.find((e) => e.kind === 'warmup')!;
    expect(warmup).toBeTruthy();
    expect(warmup.sets).toHaveLength(0);
  });
});

// TODO(firebase): auth is now signInWithCustomToken via callables; rework.
describe.skip('F-01 auth UI', () => {
  it('renders sign-in only (no public registration)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ registered: true }), { status: 200 })),
    );
    render(<AuthView onLoggedIn={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Spotter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Create account/ })).toBeNull();
    expect(screen.getByText(/Ask your admin for an invite link/)).toBeTruthy();
  });

  it('renders sign-in errors and retry for unreachable server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('offline')));
    render(<AuthView onLoggedIn={vi.fn()} />);

    expect(await screen.findByText(/Can't reach the server/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
describe('F-06 progress and history UI', () => {
  function richStore(): StoreState {
    const now = Date.now();
    return store({
      workouts: [0, 1, 2].map((i) => ({
        id: `w${i}`,
        startedAt: now - i * 7 * 24 * 3600_000,
        finishedAt: now - i * 7 * 24 * 3600_000 + 3600_000,
        autoFinished: false,
        exercises: [
          {
            id: `e${i}`,
            name: 'Squat',
            position: 0,
            sets: [{ id: `s${i}`, reps: 5 + i, weight: 100 + i * 5, isWarmup: false, position: 0 }],
          },
        ],
      })),
    });
  }

  it('renders filled Progress metrics after three sessions', () => {
    render(
      <ProgressView
        store={richStore()}
        shell={shell}
        sub="progress"
        onSub={vi.fn()}
        featSub="achievements"
        onFeatSub={vi.fn()}
        seg="total"
        onSeg={vi.fn()}
        lens="volume"
        onLens={vi.fn()}
      />,
    );

    expect(screen.getByText('Volume this week')).toBeTruthy();
    expect(screen.getByText('Estimated 1RM')).toBeTruthy();
    expect(screen.getByText('Records')).toBeTruthy();
  });

  it('renders exercise history chart/table for repeated lift', () => {
    __replaceStateForTests(richStore());
    render(<ExerciseHistoryView name="Squat" onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Squat' })).toBeTruthy();
    expect(screen.getByText('Top set · 12 weeks')).toBeTruthy();
    expect(screen.getByText('Last sessions')).toBeTruthy();
  });
});
