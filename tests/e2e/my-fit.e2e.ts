import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4599;
const BASE = `http://127.0.0.1:${PORT}`;

let server: ChildProcess;
let dataDir: string;

async function waitForHealth(): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server did not become healthy');
}

async function api<T>(method: string, url: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}`);
  return (await res.json()) as T;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gym.locale', 'en');
  });
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-e2e-'));
  server = spawn(process.execPath, ['server/dist/index.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      GYM_DATA_DIR: dataDir,
      GYM_JWT_SECRET: 'e2e-secret',
      PORT: String(PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForHealth();
});

test.afterEach(async () => {
  server?.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('F-01/F-02/F-08 auth, shell and language', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

  await page.getByPlaceholder('First name').fill('Demo');
  await page.getByPlaceholder('Last name').fill('User');
  await page.getByPlaceholder('Username').fill('demo');
  await page.getByPlaceholder('Password (min. 6 characters)').fill('secret123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Nothing logged yet.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apps' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Programs' })).toBeVisible();

  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('menuitemradio', { name: 'Українська' }).click();
  await expect(page.getByRole('heading', { name: 'Ще нічого не записано.' })).toBeVisible();
});

test('F-03/F-04 session logging, ghost row, finish and recent history', async ({ page }) => {
  const auth = await api<{ token: string }>('POST', '/api/auth/register', {
    username: 'demo',
    password: 'secret123',
  });
  await page.goto(BASE);
  await page.getByPlaceholder('Username').fill('demo');
  await page.getByPlaceholder('Password').fill('secret123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByRole('button', { name: 'Start your first session' }).click();
  await expect(page.getByText('No exercises yet')).toBeVisible();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByPlaceholder('Add exercise').fill('Squat');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Squat')).toBeVisible();
  await page.getByRole('button', { name: 'Log' }).click();
  await expect(page.getByRole('button', { name: /1\s+8\s+20\s+record/i })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Session saved')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Recent')).toBeVisible();

  const state = await api<{ workouts: Array<{ exercises: Array<{ sets: unknown[] }> }> }>(
    'GET',
    '/api/tracker/state',
    undefined,
    auth.token,
  );
  expect(state.workouts[0].exercises[0].sets).toHaveLength(1);
});

test('F-05/F-06 gyms, reminders and progress locked state', async ({ page }) => {
  const auth = await api<{ token: string }>('POST', '/api/auth/register', {
    username: 'demo',
    password: 'secret123',
  });
  const gym = crypto.randomUUID();
  await api(
    'PUT',
    `/api/tracker/gyms/${gym}`,
    { name: 'Smartfit', lat: 50.45, lng: 30.52, radiusM: 150 },
    auth.token,
  );
  const visitStart = Date.now() - 2 * 24 * 3600_000;
  for (let m = 0; m <= 75; m += 5) {
    await api(
      'PUT',
      `/api/tracker/pings/${crypto.randomUUID()}`,
      { gymId: gym, at: visitStart + m * 60_000 },
      auth.token,
    );
  }

  await page.goto(BASE);
  await page.getByPlaceholder('Username').fill('demo');
  await page.getByPlaceholder('Password').fill('secret123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText(/Smartfit/)).toBeVisible();
  await page.getByRole('button', { name: 'Gyms' }).click();
  await expect(page.getByText('Smartfit')).toBeVisible();
  await expect(page.getByRole('button', { name: /I'm here/ })).toHaveCount(0);
  await page.getByPlaceholder('Search for a gym').fill('New gym');
  await expect(page.getByRole('button', { name: /New gym.*I'm here/ })).toBeVisible();

  await page.getByRole('button', { name: 'Progress' }).click();
  await expect(page.getByText('Two more sessions')).toBeVisible();
});

test('W-04 desktop pages keep the whole content lane scrollable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 520 });
  await api<{ token: string }>('POST', '/api/auth/register', {
    firstName: 'Demo',
    lastName: 'User',
    username: 'desktop',
    password: 'secret123',
  });

  await page.goto(BASE);
  await page.getByPlaceholder('Username').fill('desktop');
  await page.getByPlaceholder('Password').fill('secret123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Demo User/ }).click();
  await expect(page.getByRole('heading', { name: 'Demo User' })).toBeVisible();

  const layout = await page.evaluate(() => {
    const main = document.querySelector('.main-col')?.getBoundingClientRect();
    const screen = document.querySelector('.screen')?.getBoundingClientRect();
    const content = document.querySelector('.screen')?.firstElementChild?.getBoundingClientRect();
    const scroller = document.querySelector('.screen') as HTMLElement | null;
    if (!main || !screen || !content || !scroller) throw new Error('desktop layout missing');
    return {
      mainLeft: main.left,
      mainRight: main.right,
      screenLeft: screen.left,
      screenRight: screen.right,
      screenTop: screen.top,
      contentWidth: content.width,
      clientHeight: scroller.clientHeight,
      scrollHeight: scroller.scrollHeight,
    };
  });

  expect(Math.abs(layout.screenLeft - layout.mainLeft)).toBeLessThan(1);
  expect(Math.abs(layout.screenRight - layout.mainRight)).toBeLessThan(1);
  expect(layout.contentWidth).toBeLessThanOrEqual(900);
  expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);

  await page.mouse.move(1420, layout.screenTop + 120);
  await page.mouse.wheel(0, 700);
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('.screen') as HTMLElement).scrollTop))
    .toBeGreaterThan(0);
});
