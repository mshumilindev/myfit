# Spotter desktop shell (macOS first)

A thin Electron shell around the **hosted** Spotter web app. There is no product code here: all development happens in
`client/`, and every Firebase Hosting deploy reaches the desktop app without a new shell release. Design and decisions:
SPO-154 / SPO-157.

## Run locally

```sh
npm run start -w desktop                                   # opens https://spotter-64c3b.web.app
SPOTTER_URL=http://localhost:5173 npm run start -w desktop # against a local dev server
```

## Build an unsigned DMG (no Apple Developer account needed)

```sh
npm run dmg -w desktop            # host architecture → desktop/release/Spotter-<version>-<arch>.dmg
npm run dmg:universal -w desktop  # Intel + Apple Silicon
```

The DMG is built with `electron-builder` fetched by `npx` at a pinned version (no new dependency in the lockfile).
A DMG you build yourself has no quarantine flag, so Gatekeeper does not block it. One you download from elsewhere
(e.g. the manual `Desktop DMG (unsigned)` workflow artifact) is blocked until you allow it in
System Settings → Privacy & Security, or run `xattr -dr com.apple.quarantine /Applications/Spotter.app`.

## When does the app need reinstalling?

- Web changes (anything in `client/`): never; the shell loads the deployed site.
- Shell changes (Electron version, `src/`, bridge, icons): install a new DMG. Automatic shell updates on macOS need a
  signed app (Developer ID + notarization), planned in SPO-157 once the Apple Developer account exists.

## Bridge: `window.spotterNative`

Exposed by `src/preload.ts`; contract in `src/shared.ts`. The web app must feature-detect `window.spotterNative` and each
method and keep working without it (browser / PWA). Methods: `getAppVersion()`, `notify(title, body?)`,
`setBadge(count)`, `openExternal(url)`; fields: `bridgeVersion`, `platform`. Change the bridge only additively.

## Security

`contextIsolation`, `sandbox`, no Node in the renderer; navigation is limited to the app origin (other https links open
in the system browser); permissions are limited to notifications, camera and geolocation for the app origin.

## Not done yet (SPO-157)

Signing + notarization, auto-update and stable/beta channels, APNs push, deep links, CI release, removal of legacy
`server/` (SPO-139), web-side use of the bridge.

## Windows (unsigned installer)

```sh
npm run exe -w desktop   # NSIS x64 + arm64 → desktop/release/Spotter-<version>-<arch>.exe (best built on Windows)
```

Or run the manual `Desktop EXE (unsigned)` workflow (`windows-latest`) and download the `spotter-exe` artifact.
Unsigned: Windows SmartScreen shows a warning ("More info" → "Run anyway"). Closing the window hides the app to the
tray (all platforms); quit via tray menu or File → Exit. Signing / Microsoft Store / auto-update: SPO-159.

## Direct distribution and updates (no stores yet)

1. Bump `version` in `desktop/package.json`, then run the manual `Desktop release (draft)` workflow.
2. It builds the Windows installer (`Spotter-Setup-<version>.exe`, x64 + arm64, with `latest.yml`) and the macOS DMG and
   attaches them to a **draft** GitHub Release. Check it, then publish the release; share the release link.
3. Windows: the installed app checks that release every 6 h, downloads in the background and installs on quit (or via
   the tray item "Перезапустити й оновити"). Only the shell is updated this way; the web app updates itself from hosting.
4. macOS: unsigned, no in-app shell update (needs Developer ID signing, SPO-162) — reinstall the new DMG when the shell
   changes (rare).
Unsigned installers: Windows SmartScreen warns ("More info" → "Run anyway"); macOS needs right-click → Open for a
downloaded DMG. Microsoft Store / signing are separate later tasks.
