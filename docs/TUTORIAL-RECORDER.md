# Spotter mobile tutorial recorder

Recorder builds product-looking mobile lessons from the real Spotter UI. It opens
Chromium in a phone viewport, lets a human sign in with a test account, then runs
the scenario against the live DOM and captures annotated frames.

## First run

Install the browser once if Playwright has not downloaded it yet:

```bash
npx playwright install chromium
```

Start Spotter locally:

```bash
npm run dev
```

Run the first mobile lesson:

```bash
npm run tutorial:mobile:first-workout
```

Chromium opens at `http://127.0.0.1:5173`. Sign in as the test account in that
window, land on the app, then press `Enter` in the terminal. The recorder will
walk through the real Today/session UI and capture:

- raw screenshots;
- annotated PNG frames with captions and highlights;
- `first-workout-mobile.mp4` when `ffmpeg` is installed.

Outputs are written to `tutorials/out/mobile/...` and are ignored by git.

## Useful variants

Record against production or staging:

```bash
npm run tutorial:mobile -- --url https://spotter-64c3b.web.app
```

Capture frames only:

```bash
npm run tutorial:mobile:first-workout -- --no-video
```

Reuse the signed-in browser profile without pausing:

```bash
npm run tutorial:mobile:first-workout -- --no-signin-pause
```

The persistent profile lives in `.tutorial-profile/mobile-chromium` and is ignored
by git.
