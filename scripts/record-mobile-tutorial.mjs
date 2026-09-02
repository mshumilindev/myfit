import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';
import { chromium, devices } from 'playwright';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_URL = 'http://127.0.0.1:5173';
const DEFAULT_OUT = path.join(ROOT, 'tutorials/out/mobile');
const DEFAULT_PROFILE = path.join(ROOT, '.tutorial-profile/mobile-chromium');
const PHONE = devices['iPhone 14 Pro'];

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
  done: /^(Done|Готово|Gotowe|Atlikta|Valmis)$/i,
};

const CAPTIONS = {
  'first-workout': [
    {
      title: 'Start from Today',
      body: 'Open Spotter on your phone and start a session from the Today screen.',
    },
    {
      title: 'Add the first exercise',
      body: 'Use Add exercise to open the real exercise picker.',
    },
    {
      title: 'Search the catalog',
      body: 'Type the lift name and choose the matching exercise from Spotter.',
    },
    {
      title: 'Log a set',
      body: 'Enter your first working set. Spotter will keep the session moving.',
    },
    {
      title: 'Finish the session',
      body: 'When the work is done, finish and review the saved summary.',
    },
  ],
};

function parseArgs(argv) {
  const args = {
    url: process.env.BASE_URL ?? DEFAULT_URL,
    out: process.env.TUTORIAL_OUT ?? DEFAULT_OUT,
    profile: process.env.TUTORIAL_PROFILE ?? DEFAULT_PROFILE,
    scenario: process.env.SCENARIO ?? 'first-workout',
    fps: Number(process.env.FPS ?? 10),
    keepOpen: false,
    noVideo: false,
    noSigninPause: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--profile') args.profile = argv[++i];
    else if (a === '--scenario') args.scenario = argv[++i];
    else if (a === '--fps') args.fps = Number(argv[++i]);
    else if (a === '--keep-open') args.keepOpen = true;
    else if (a === '--no-video') args.noVideo = true;
    else if (a === '--no-signin-pause') args.noSigninPause = true;
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Spotter mobile tutorial recorder

Usage:
  npm run tutorial:mobile:first-workout
  npm run tutorial:mobile -- --url https://spotter-64c3b.web.app

Options:
  --scenario first-workout     Scenario to record. Default: first-workout
  --url <url>                  Running Spotter URL. Default: ${DEFAULT_URL}
  --out <dir>                  Output root. Default: tutorials/out/mobile
  --profile <dir>              Persistent Chromium profile for manual sign-in
  --fps <number>               Output frame rate for mp4. Default: 10
  --no-video                   Capture PNG tutorial frames only
  --no-signin-pause            Do not wait for manual sign-in
  --keep-open                  Leave Chromium open after recording
`);
}

function stamp() {
  return new Date()
    .toISOString()
    .replaceAll(':', '-')
    .replace(/\.\d+Z$/, 'Z');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function canRun(command) {
  const res = spawnSync(command, ['-version'], { stdio: 'ignore' });
  return res.status === 0;
}

async function pauseForSignin(page, url) {
  console.log(`\nOpened ${url} in mobile Chromium.`);
  console.log(
    'Sign in as the test account in that browser window, land on Spotter, then press Enter here.',
  );
  await page.bringToFront();
  const rl = readline.createInterface({ input, output });
  await rl.question('');
  rl.close();
}

async function firstVisible(locators, label) {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const item = locator.nth(i);
      if (await item.isVisible().catch(() => false)) return item;
    }
  }
  throw new Error(`Could not find visible element: ${label}`);
}

async function optionalVisible(locators) {
  try {
    return await firstVisible(locators, 'optional');
  } catch {
    return null;
  }
}

async function clickFirst(page, locators, label) {
  const locator = await firstVisible(locators, label);
  await locator.click();
  await page.waitForTimeout(600);
  return locator;
}

async function fillFirst(page, locators, label, value) {
  const locator = await firstVisible(locators, label);
  await locator.fill(value);
  await page.waitForTimeout(500);
  return locator;
}

async function highlightBox(locator) {
  if (!locator) return null;
  return await locator
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })
    .catch(() => null);
}

async function captureStep({ appPage, renderPage, outDir, index, title, body, highlight }) {
  await appPage.waitForTimeout(250);
  const rawPath = path.join(outDir, 'raw', `${String(index).padStart(2, '0')}.png`);
  const framePath = path.join(outDir, 'frames', `${String(index).padStart(2, '0')}.png`);
  await appPage.screenshot({ path: rawPath, fullPage: false });
  const img = fs.readFileSync(rawPath).toString('base64');
  const box = await highlightBox(highlight);
  const boxHtml = box
    ? `<div class="hl" style="left:${Math.max(0, box.x - 6)}px;top:${Math.max(0, box.y - 6)}px;width:${box.width + 12}px;height:${box.height + 12}px"></div>`
    : '';

  await renderPage.setViewportSize({ width: PHONE.viewport.width, height: PHONE.viewport.height });
  await renderPage.setContent(`<!doctype html>
<html>
  <head>
    <style>
      * { box-sizing: border-box; }
      html, body { width: ${PHONE.viewport.width}px; height: ${PHONE.viewport.height}px; margin: 0; overflow: hidden; background: #101114; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.04) 46%, rgba(0,0,0,0.68)); pointer-events: none; }
      .hl { position: absolute; border: 3px solid #e7a941; border-radius: 16px; box-shadow: 0 0 0 999px rgba(0,0,0,0.18), 0 0 24px rgba(231,169,65,0.38); }
      .caption { position: absolute; left: 22px; right: 22px; bottom: 28px; padding: 15px 16px 16px; border: 1px solid rgba(231,169,65,0.42); border-radius: 18px; background: rgba(22,23,26,0.86); color: #f2f2f4; box-shadow: 0 18px 48px rgba(0,0,0,0.50); }
      .k { color: #e7a941; font-size: 11px; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase; margin-bottom: 7px; }
      .t { font-size: 22px; line-height: 1.12; font-weight: 750; letter-spacing: 0; margin-bottom: 7px; }
      .b { color: rgba(242,242,244,0.74); font-size: 15px; line-height: 1.34; }
    </style>
  </head>
  <body>
    <img src="data:image/png;base64,${img}" />
    <div class="shade"></div>
    ${boxHtml}
    <div class="caption">
      <div class="k">Spotter lesson</div>
      <div class="t">${escapeHtml(title)}</div>
      <div class="b">${escapeHtml(body)}</div>
    </div>
  </body>
</html>`);
  await renderPage.screenshot({ path: framePath, fullPage: false });
  console.log(`Captured frame ${index}: ${title}`);
}

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function expandFrames(outDir, count, fps) {
  const seqDir = path.join(outDir, 'sequence');
  ensureDir(seqDir);
  let n = 1;
  const holdSeconds = 2.4;
  const repeats = Math.max(1, Math.round(fps * holdSeconds));
  for (let i = 1; i <= count; i += 1) {
    const src = path.join(outDir, 'frames', `${String(i).padStart(2, '0')}.png`);
    for (let r = 0; r < repeats; r += 1) {
      fs.copyFileSync(src, path.join(seqDir, `frame-${String(n).padStart(4, '0')}.png`));
      n += 1;
    }
  }
  return seqDir;
}

function renderVideo(outDir, frameCount, fps) {
  if (!canRun('ffmpeg')) {
    console.log('ffmpeg not found, skipping mp4 render. PNG frames are ready.');
    return null;
  }
  const seqDir = expandFrames(outDir, frameCount, fps);
  const video = path.join(outDir, 'first-workout-mobile.mp4');
  const res = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      path.join(seqDir, 'frame-%04d.png'),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      video,
    ],
    { stdio: 'inherit' },
  );
  if (res.status !== 0) throw new Error('ffmpeg failed to render the tutorial video');
  return video;
}

async function recordFirstWorkout(page, renderPage, outDir) {
  const captions = CAPTIONS['first-workout'];
  await page.goto(page.url() || DEFAULT_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const today = await optionalVisible([page.getByRole('button', { name: TEXT.today })]);
  if (today) await today.click();
  await page.waitForTimeout(600);

  const start = await firstVisible(
    [page.getByRole('button', { name: TEXT.startSession }), page.getByText(TEXT.startSession)],
    'start session',
  );
  await captureStep({
    appPage: page,
    renderPage,
    outDir,
    index: 1,
    ...captions[0],
    highlight: start,
  });
  await start.click();
  await page.waitForTimeout(1200);

  const add = await firstVisible(
    [page.getByRole('button', { name: TEXT.addExercise }), page.getByText(TEXT.addExercise)],
    'add exercise',
  );
  await captureStep({
    appPage: page,
    renderPage,
    outDir,
    index: 2,
    ...captions[1],
    highlight: add,
  });
  await add.click();
  await page.waitForTimeout(800);

  const search = await fillFirst(
    page,
    [
      page.getByPlaceholder(TEXT.exerciseSearch),
      page.getByRole('textbox', { name: TEXT.exerciseSearch }),
      page.locator('input[type="search"], input').first(),
    ],
    'exercise search',
    'squat',
  );
  await captureStep({
    appPage: page,
    renderPage,
    outDir,
    index: 3,
    ...captions[2],
    highlight: search,
  });

  await clickFirst(
    page,
    [
      page.getByRole('button', { name: TEXT.squat }),
      page.getByText(TEXT.squat),
      page.locator('.exercise-row, .exercise-card, .sheet-row, li').filter({ hasText: TEXT.squat }),
    ],
    'squat result',
  );
  await page.waitForTimeout(900);

  const log = await firstVisible(
    [page.getByRole('button', { name: TEXT.log }), page.getByText(TEXT.log)],
    'log set',
  );
  await captureStep({
    appPage: page,
    renderPage,
    outDir,
    index: 4,
    ...captions[3],
    highlight: log,
  });
  await log.click();
  await page.waitForTimeout(900);

  const finish = await firstVisible([page.getByRole('button', { name: TEXT.finish })], 'finish');
  await captureStep({
    appPage: page,
    renderPage,
    outDir,
    index: 5,
    ...captions[4],
    highlight: finish,
  });
  await finish.click();
  await page.waitForTimeout(500);
  const confirm = await optionalVisible([page.getByRole('button', { name: TEXT.confirmFinish })]);
  if (confirm) await confirm.click();
  await page.waitForTimeout(1000);

  return 5;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.scenario !== 'first-workout') throw new Error(`Unknown scenario: ${args.scenario}`);

  const outDir = path.join(args.out, `${args.scenario}-${stamp()}`);
  ensureDir(path.join(outDir, 'raw'));
  ensureDir(path.join(outDir, 'frames'));
  ensureDir(args.profile);

  const context = await chromium.launchPersistentContext(args.profile, {
    ...PHONE,
    headless: false,
    viewport: PHONE.viewport,
    recordVideo: { dir: path.join(outDir, 'raw-video'), size: PHONE.viewport },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(args.url, { waitUntil: 'domcontentloaded' });

  if (!args.noSigninPause) await pauseForSignin(page, args.url);

  const renderPage = await context.newPage();
  const frameCount = await recordFirstWorkout(page, renderPage, outDir);
  await renderPage.close();

  const video = args.noVideo ? null : renderVideo(outDir, frameCount, args.fps);
  fs.writeFileSync(
    path.join(outDir, 'README.md'),
    [
      `# ${args.scenario}`,
      '',
      `Source URL: ${args.url}`,
      `Frames: ${path.relative(ROOT, path.join(outDir, 'frames'))}`,
      video ? `Video: ${path.relative(ROOT, video)}` : 'Video: skipped',
      '',
      'This recorder uses a persistent local Chromium profile. Sign in once, then rerun scenarios without logging in again.',
    ].join('\n'),
  );

  console.log(`\nTutorial output: ${outDir}`);
  if (video) console.log(`Video: ${video}`);
  if (!args.keepOpen) await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
