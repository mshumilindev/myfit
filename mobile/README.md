# Spotter Android shell (SPO-158)

A thin [Capacitor](https://capacitorjs.com) shell around the **hosted** Spotter web app. There is no product code here:
all development happens in `client/`, and every Firebase Hosting deploy reaches the Android app without a new APK.
Design and decisions: SPO-155 (`claude/SPO-155-android-app-spike.md` in the Spotter project). Distribution is a **direct
APK link only**; Google Play is a separate task (SPO-190), native push is SPO-191.

This folder is self-contained (not an npm workspace). iOS can be added next to `android/` later (SPO-161).

## What is in the shell

- `capacitor.config.json`: `server.url` points at the deployed site (`https://spotter-64c3b.web.app`), HTTPS only,
  no cleartext, WebView debugging off, `errorPath: error.html` (offline page packaged in `www/`).
- `android/app/src/main/java/com/spotter/app/MainActivity.java`: injects `window.spotterNative` at document start, only
  for the app origin: `{ bridgeVersion: 1, platform: 'android', getAppVersion() }`. Same additive contract as the
  desktop shell (`desktop/src/shared.ts`). The web app must feature-detect it and keep working without it
  (`isNativeShell()` in `client/src/pwaInstall.ts` hides the "create shortcut" button).
- Permissions: camera and location (as allowed by `Permissions-Policy` in `firebase.json`). No push, no Health Connect yet.
- `android:allowBackup="false"`: the WebView data (IndexedDB with the E2EE key) is not copied into device backups.
- Version: `version` in `mobile/package.json` (`x.y.z`); `versionCode = x*10000 + y*100 + z`.
- App id: `com.spotter.app`. It is permanent once users install it; check it is free in the Android Developer Console
  before the first distributed build (SPO-155, section 7.2).

## Build

Needs JDK 21 and the Android SDK (platform 36). The generated `android/` files `capacitor.build.gradle`,
`capacitor.settings.gradle`, `app/src/main/assets/*` and `capacitor-cordova-android-plugins/` are not committed:
run `cap sync` first.

```sh
cd mobile
npm ci
npx cap sync android
cd android && ./gradlew assembleDebug      # debug-signed APK: app/build/outputs/apk/debug/app-debug.apk
```

Local web against a dev server: change `server.url` temporarily (and set `"cleartext": true` for `http://`); do not commit it.

## CI and release (direct distribution)

Manual workflow **Android APK** (`.github/workflows/android-apk.yml`):

1. One-time: create a release key and store it as repository secrets. **Keep the key forever**: an APK can update an
   installed one only if it has the same key and a higher `versionCode`.
   ```sh
   keytool -genkeypair -v -keystore spotter-release.jks -alias spotter -keyalg RSA -keysize 4096 -validity 10000
   base64 -i spotter-release.jks | pbcopy   # → secret ANDROID_KEYSTORE_BASE64
   ```
   Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
2. Bump `version` in `mobile/package.json`, run the workflow with `signed=true` (and `draft_release=true` to attach the
   APK + `SHA256SUMS.txt` to a draft GitHub Release `android-v<version>`). Publish the release by hand, share its link.
3. `signed=false` builds a debug-signed APK for tests only (not for distribution). `smoke=true` also installs the APK on an
   emulator (API 34), starts it and saves a screenshot and logcat as the `spotter-smoke` artifact.

The job summary shows the APK size, Gradle build time and SHA-256.

## Install on a phone

Open the APK link on the phone and allow **Install unknown apps** for the browser/file manager when asked. Play Protect
may warn about an unknown developer. Installing a newer APK over the old one keeps the session and data.

## When does the app need reinstalling?

- Web changes (anything in `client/`): never; the shell loads the deployed site.
- Shell changes (Capacitor version, `MainActivity`, permissions, icons, `server.url`): install a new APK.

## Android developer verification

Google is rolling out mandatory developer verification for certified devices (from 2026-09-30 in Brazil, Indonesia,
Singapore, Thailand; global in 2027). Direct APKs are affected; see SPO-155, section 7.2. Decision for the owner: a Full
distribution account (one-time fee, identity check) or a Limited one (free, up to 20 devices).

## Not done yet

PoC run on a device/emulator with measured numbers, native push (SPO-191), Health Connect, in-app shell update,
Google Play (SPO-190), web-side use of the bridge beyond `isNativeShell()`.
