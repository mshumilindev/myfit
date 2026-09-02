/**
 * Spotter — mobile tutorial recorder (REAL video, not a slideshow).
 *
 * Records a continuous video of the REAL app in a phone viewport while a
 * product-style caption + highlight is injected LIVE into the page, so the
 * finished clip shows real motion (taps, transitions, the timer running) with
 * the lesson text over it. Output is a properly-framed .webm and, if ffmpeg is
 * present, an .mp4 — never a cropped still slideshow.
 *
 * Sign-in is manual and one-time: a persistent Chromium profile stores the
 * session, so after the first login reruns need no login. USE A DEDICATED TEST
 * ACCOUNT — the run logs a real session as whoever is signed in.
 *
 *   npm run tutorial:mobile:first-workout          # local dev (http://127.0.0.1:5173)
 *   npm run tutorial:mobile -- --url https://staging.example.app
 *   npm run tutorial:mobile -- --no-signin-pause   # reuse a profile already logged in
 */
/* global document, window */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium, devices } from 'playwright';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_URL = 'http://127.0.0.1:5173';
const DEFAULT_OUT = path.join(ROOT, 'tutorials/out/mobile');
const DEFAULT_PROFILE = path.join(ROOT, '.tutorial-profile/mobile-chromium');
const PHONE = devices['iPhone 14 Pro'];
// True iPhone 14 Pro logical size (Playwright's device preset uses a short 660
// height; force the real 852 so the app renders at full phone height).
const VIEWPORT = { width: 393, height: 852 };
const VW = VIEWPORT.width;
const VH = VIEWPORT.height;
// Record 1:1 with the viewport so the frame is exactly the phone screen — no
// letterboxing, no crop. ffmpeg upscales 2× afterwards for crisp text.
const VIDEO_SIZE = { width: VW, height: VH };

// Localised text matchers for the real Spotter DOM (en/uk/pl/lt/et).
const TEXT = {
  today: /^(Today|Сьогодні|Dziś|Šiandien|Täna)$/i,
  startSession:
    /(Start your first session|Start session|Почати тренування|Почати перше тренування|Rozpocznij trening|Zacznij pierwszy trening|Pradėti treniruotę|Alusta treeningut)/i,
  addExercise: /(Add exercise|Додати вправу|Dodaj ćwiczenie|Pridėti pratimą|Lisa harjutus)/i,
  exerciseSearch:
    /(Add exercise|Search|Пошук|Додати вправу|Szukaj|Dodaj ćwiczenie|Paieška|Pridėti pratimą|Otsi|Lisa harjutus)/i,
  squat: /(Barbell Full Squat|Squat|Присідання|Przysiad|Pritūpimas|Kükk)/i,
  log: /^(Log|Записати|Zapisz|Įrašyti|Logi)$/i,
  finish: /^(Finish|Завершити|Zakończ|Baigti|Lõpeta)$/i,
  confirmFinish: /(Finish|Завершити|Zakończ|Baigti|Lõpeta)/i,
};

function parseArgs(argv) {
  const a = {
    url: process.env.BASE_URL ?? DEFAULT_URL,
    out: process.env.TUTORIAL_OUT ?? DEFAULT_OUT,
    profile: process.env.TUTORIAL_PROFILE ?? DEFAULT_PROFILE,
    scenario: process.env.SCENARIO ?? 'first-workout',
    keepOpen: false,
    noSigninPause: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === '--url') a.url = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--profile') a.profile = argv[++i];
    else if (k === '--scenario') a.scenario = argv[++i];
    else if (k === '--keep-open') a.keepOpen = true;
    else if (k === '--no-signin-pause') a.noSigninPause = true;
    else if (k === '--help' || k === '-h') {
      console.log(
        'npm run tutorial:mobile:first-workout\n' +
          'Options: --url <url> --profile <dir> --no-signin-pause --keep-open',
      );
      process.exit(0);
    }
  }
  return a;
}

const stamp = () =>
  new Date()
    .toISOString()
    .replaceAll(':', '-')
    .replace(/\.\d+Z$/, 'Z');
const ensureDir = (d) => fs.mkdirSync(d, { recursive: true });
const canRun = (cmd) => spawnSync(cmd, ['-version'], { stdio: 'ignore' }).status === 0;

async function waitForReady(page, url) {
  console.log(`\nOpened ${url}. Log in as the TEST account in the phone window that just opened.`);
  console.log('I will start recording automatically once the app is ready — no keypress needed.');
  const deadline = Date.now() + 900000; // up to 15 min to sign in
  let announced = false;
  while (Date.now() < deadline) {
    const ready = await firstVisible(
      [page.getByRole('button', { name: TEXT.startSession }), page.getByText(TEXT.startSession)],
      'start',
    )
      .then(() => true)
      .catch(() => false);
    if (ready) {
      console.log('App is ready — recording now.');
      return;
    }
    if (!announced) {
      console.log('Waiting for sign-in / the Today screen…');
      announced = true;
    }
    await page.waitForTimeout(2500);
  }
  throw new Error('timed out waiting for the app to be ready (not signed in?)');
}

// ---- the live overlay, injected into the recorded app page ------------------
function installOverlay() {
  if (window.__tut) return;
  const s = document.createElement('style');
  s.textContent = `
    #tut-cap{position:fixed;left:16px;right:16px;bottom:30px;z-index:2147483000;pointer-events:none;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      background:rgba(18,19,22,.88);backdrop-filter:blur(8px);border:1px solid rgba(231,169,65,.42);
      border-radius:18px;padding:15px 16px;box-shadow:0 20px 50px -18px rgba(0,0,0,.85);color:#fff;
      opacity:0;transform:translateY(16px);transition:opacity .45s ease,transform .45s cubic-bezier(.22,1,.36,1)}
    #tut-cap.on{opacity:1;transform:none}
    #tut-cap.top{bottom:auto;top:26px}
    #tut-cap .k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#e7a941;margin-bottom:6px}
    #tut-cap .t{font-size:21px;font-weight:750;letter-spacing:-.01em;line-height:1.18}
    #tut-cap .b{font-size:14.5px;line-height:1.4;color:rgba(242,242,244,.8);margin-top:6px}
    #tut-cap .step{position:absolute;top:13px;right:15px;font-size:11px;font-weight:600;color:#8b8f97}
    #tut-ring{position:fixed;z-index:2147482000;border-radius:14px;pointer-events:none;opacity:0;
      box-shadow:0 0 0 3px #e7a941,0 0 0 10px rgba(231,169,65,.22),0 0 0 9999px rgba(0,0,0,.12);
      transition:all .4s cubic-bezier(.22,1,.36,1)}
    #tut-ring.on{opacity:1;animation:tutp 1.5s ease-in-out infinite}
    @keyframes tutp{0%,100%{box-shadow:0 0 0 3px #e7a941,0 0 0 10px rgba(231,169,65,.22),0 0 0 9999px rgba(0,0,0,.12)}
      50%{box-shadow:0 0 0 3px #e7a941,0 0 0 15px rgba(231,169,65,.05),0 0 0 9999px rgba(0,0,0,.12)}}`;
  document.head.appendChild(s);
  const cap = document.createElement('div');
  cap.id = 'tut-cap';
  cap.innerHTML =
    '<div class="step"></div><div class="k"></div><div class="t"></div><div class="b"></div>';
  const ring = document.createElement('div');
  ring.id = 'tut-ring';
  document.body.append(cap, ring);
  window.__tut = {
    cap(k, t, b, step, pos) {
      cap.querySelector('.k').textContent = k || 'Spotter lesson';
      cap.querySelector('.t').textContent = t || '';
      cap.querySelector('.b').textContent = b || '';
      cap.querySelector('.step').textContent = step || '';
      cap.classList.toggle('top', pos === 'top');
      cap.classList.add('on');
    },
    ring(r) {
      if (!r) return ring.classList.remove('on');
      Object.assign(ring.style, {
        left: `${r.x - 6}px`,
        top: `${r.y - 6}px`,
        width: `${r.w + 12}px`,
        height: `${r.h + 12}px`,
      });
      ring.classList.add('on');
    },
    clear() {
      ring.classList.remove('on');
    },
  };
}

async function ensureOverlay(page) {
  await page.evaluate(installOverlay).catch(() => {});
}

async function firstVisible(locators, label) {
  for (const loc of locators) {
    const n = await loc.count().catch(() => 0);
    for (let i = 0; i < n; i += 1) {
      const it = loc.nth(i);
      if (await it.isVisible().catch(() => false)) return it;
    }
  }
  throw new Error(`not found: ${label}`);
}
async function optional(locators) {
  try {
    return await firstVisible(locators, '?');
  } catch {
    return null;
  }
}
async function boxOf(locator) {
  if (!locator) return null;
  return locator
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })
    .catch(() => null);
}

/** Caption + highlight on the current screen, held so it can be read, then the
 *  action fires — so the next beat shows the result. Real recording captures it all. */
async function beat(page, { kicker, title, body, step, total, highlight, act }) {
  await ensureOverlay(page);
  const box = highlight ? await boxOf(highlight) : null;
  const pos = box && box.y > VH * 0.6 ? 'top' : 'bottom';
  await page.evaluate((d) => window.__tut.cap(d.kicker, d.title, d.body, d.step, d.pos), {
    kicker,
    title,
    body,
    step: `${step} / ${total}`,
    pos,
  });
  await page.evaluate((b) => window.__tut.ring(b), box);
  await page.waitForTimeout(2600);
  await page.evaluate(() => window.__tut.clear());
  if (act) {
    await act();
    await page.waitForTimeout(900);
  }
}

async function recordFirstWorkout(page) {
  const total = 6;
  await beat(page, {
    kicker: 'Getting started',
    step: 1,
    total,
    title: 'Your first workout',
    body: 'This is Today. In under a minute you’ll start a session, add a lift and log a set.',
  });

  const start = await firstVisible(
    [page.getByRole('button', { name: TEXT.startSession }), page.getByText(TEXT.startSession)],
    'start session',
  );
  await beat(page, {
    kicker: 'Step 1',
    step: 2,
    total,
    title: 'Start a session',
    body: 'Tap Start to open a fresh workout for today.',
    highlight: start,
    act: () => start.click(),
  });

  const add = await firstVisible(
    [page.getByRole('button', { name: TEXT.addExercise }), page.getByText(TEXT.addExercise)],
    'add exercise',
  );
  await beat(page, {
    kicker: 'Step 2',
    step: 3,
    total,
    title: 'Add an exercise',
    body: 'Open the exercise picker to choose your first lift.',
    highlight: add,
    act: () => add.click(),
  });

  const search = await firstVisible(
    [
      page.getByPlaceholder(TEXT.exerciseSearch),
      page.getByRole('textbox', { name: TEXT.exerciseSearch }),
      page.locator('input[type="search"], input').first(),
    ],
    'search',
  );
  await beat(page, {
    kicker: 'Step 3',
    step: 4,
    total,
    title: 'Find it',
    body: 'Search the library by name, then pick the matching exercise.',
    highlight: search,
    act: async () => {
      await search.fill('squat');
      await page.waitForTimeout(500);
      const res = await firstVisible(
        [
          page.getByRole('button', { name: TEXT.squat }),
          page.getByText(TEXT.squat),
          page
            .locator('.exercise-row, .exercise-card, .sheet-row, li')
            .filter({ hasText: TEXT.squat }),
        ],
        'squat',
      );
      await res.click();
    },
  });

  const log = await firstVisible(
    [page.getByRole('button', { name: TEXT.log }), page.getByText(TEXT.log)],
    'log',
  );
  await beat(page, {
    kicker: 'Step 4',
    step: 5,
    total,
    title: 'Log your first set',
    body: 'Enter weight and reps, then tap Log to save the set.',
    highlight: log,
    act: () => log.click(),
  });

  const finish = await firstVisible([page.getByRole('button', { name: TEXT.finish })], 'finish');
  await beat(page, {
    kicker: 'Nice work',
    step: 6,
    total,
    title: 'Finish & review',
    body: 'Tap Finish to close and review the saved summary — your first workout is done.',
    highlight: finish,
    act: async () => {
      await finish.click();
      await page.waitForTimeout(500);
      const c = await optional([page.getByRole('button', { name: TEXT.confirmFinish })]);
      if (c) await c.click();
    },
  });
  await page.waitForTimeout(1400);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.scenario !== 'first-workout') throw new Error(`unknown scenario: ${args.scenario}`);

  const outDir = path.join(args.out, `${args.scenario}-${stamp()}`);
  ensureDir(outDir);
  ensureDir(args.profile);

  const context = await chromium.launchPersistentContext(args.profile, {
    ...PHONE,
    headless: process.env.HEADLESS === '1', // set HEADLESS=1 only for CI smoke tests
    viewport: VIEWPORT,
    screen: VIEWPORT,
    // Place the window top-right so it isn't hidden behind the Terminal.
    args: ['--window-position=900,60', `--window-size=${VW + 20},${VH + 120}`],
    recordVideo: { dir: outDir, size: VIDEO_SIZE },
  });
  {
    const p0 = context.pages()[0];
    if (p0) await p0.bringToFront().catch(() => {});
  }
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(args.url, { waitUntil: 'domcontentloaded' });
  if (!args.noSigninPause) await waitForReady(page, args.url);

  await page.waitForTimeout(600);
  await recordFirstWorkout(page);

  const video = page.video();
  await context.close(); // finalizes the webm
  const rawWebm = video ? await video.path() : null;
  let webm = null;
  let mp4 = null;
  if (rawWebm) {
    webm = path.join(outDir, `${args.scenario}.webm`);
    fs.renameSync(rawWebm, webm);
    // Drop any stray raw recordings (persistent context can open a blank page).
    for (const f of fs.readdirSync(outDir)) {
      if (f.endsWith('.webm') && f !== `${args.scenario}.webm`) {
        try {
          fs.unlinkSync(path.join(outDir, f));
        } catch {
          /* ignore */
        }
      }
    }
    if (canRun('ffmpeg')) {
      mp4 = path.join(outDir, `${args.scenario}.mp4`);
      const r = spawnSync(
        'ffmpeg',
        [
          '-y',
          '-i',
          webm,
          // upscale 2× (even dims), keep the phone aspect exactly — no crop/pad
          '-vf',
          `scale=${VW * 2}:${VH * 2}:flags=lanczos`,
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-crf',
          '20',
          '-preset',
          'medium',
          mp4,
        ],
        { stdio: 'inherit' },
      );
      if (r.status !== 0) mp4 = null;
    } else {
      console.log('ffmpeg not found — .webm is ready, install ffmpeg for .mp4.');
    }
  }
  console.log(`\nDone:\n  ${webm ?? '(no video)'}${mp4 ? `\n  ${mp4}` : ''}\n  dir: ${outDir}`);
}

main().catch((e) => {
  console.error('\nRecorder failed:', e.message);
  console.error(
    'If it was a selector, run again and share the console — the text matchers are at the top of this file.',
  );
  process.exit(1);
});
