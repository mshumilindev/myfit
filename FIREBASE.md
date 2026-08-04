# Spotter on Firebase — deploy & migration runbook

The backend moved from the self-hosted Express + SQLite server to Firebase:

- **Hosting** serves the built PWA (`client/dist`) at https://spotter-64c3b.web.app.
- **Firestore** holds all tracker/user/program data; the client reads & writes it
  directly (offline-first) — see `firestore.rules`.
- **Cloud Storage** holds avatars at `avatars/{uid}/photo` — see `storage.rules`.
  Browser reads/writes need CORS on the bucket (`storage.cors.json`); apply with
  the GCS API / `gsutil cors set storage.cors.json gs://<bucket>`.
- **Cloud Functions** (`functions/`) do only the privileged / cross-user work:
  auth (bcrypt → Firebase **custom token**), admin, trainer, programs assignment,
  profile reads, and an hourly auto-finish job.

Identity: the app keeps its own bcrypt credential store in Firestore. `login`/
`register`/`claim` verify the password and return a Firebase custom token; the
client calls `signInWithCustomToken`, so Firestore/Storage rules see the user and
the `role` claim.

## 0. One-time project setup

1. Put the project on the **Blaze** plan (Cloud Functions require it).
2. Install tooling and sign in:
   ```
   npm i -g firebase-tools
   firebase login
   ```
3. In the Firebase console enable: **Firestore** (Native mode), **Storage**, and
   Authentication (no provider needed — custom tokens work without one, but keep
   Authentication turned on).

## 1. Install & build

```
# from the repo root
cd functions && npm install && npm run build && cd ..
cd client   && npm install && npm run build && cd ..
```

`client/npm run build` runs `tsc --noEmit` first — fix any type errors it reports
(this is the real typecheck the sandbox couldn't run). `functions/npm run build`
does the same for the backend.

## 2. Deploy

```
firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting
```

Or piecemeal while iterating, e.g. `firebase deploy --only functions`.

The first Firestore query on `programs` (by author) and the collection-group
`workouts` query used by auto-finish may prompt to create an index — the CLI
prints a link, or `firebase deploy --only firestore:indexes` applies
`firestore.indexes.json`.

## 3. Migrate existing data (SQLite → Firestore + Storage)

Run this once, on a machine that has the old DB and a service-account key:

1. Firebase console → Project settings → Service accounts → **Generate new
   private key** → save as `serviceAccountKey.json` (keep it secret; don't commit).
2. Dry run, then for real:
   ```
   node scripts/migrate-to-firestore.mjs --db ~/.gym-tracker/gym.sqlite --key ./serviceAccountKey.json --dry
   node scripts/migrate-to-firestore.mjs --db ~/.gym-tracker/gym.sqlite --key ./serviceAccountKey.json
   ```
   Flags: `--media <dir>` (default `<db dir>/media/avatars`), `--bucket` (default
   `spotter-64c3b.firebasestorage.app`). It needs `firebase-admin` and
   `better-sqlite3` (`npm i firebase-admin better-sqlite3`).

The script is idempotent (writes by document id), so it's safe to re-run.

## 4. Local testing with emulators (optional)

```
firebase emulators:start
```

Point the client at the emulators by adding, at the top of `client/src/firebase.ts`
(guarded by `import.meta.env.DEV`), `connectAuthEmulator` / `connectFirestoreEmulator`
/ `connectFunctionsEmulator` / `connectStorageEmulator`. Ask and I'll wire that up.

## Notes / what changed

- The client's old offline mutation queue is gone; Firestore's persistent cache
  now provides offline writes and cross-device live updates via `onSnapshot`.
- Notices, mark-as-read, presence pings, reminder computation and local
  auto-finish are plain client Firestore operations — no functions involved.
- The Cloudflare tunnel and the embedded server in the Electron app are no longer
  used for the web PWA (desktop app was left as-is per scope).
- `functions/serviceAccountKey.json` and any exported `serviceAccountKey.json`
  must never be committed — add them to `.gitignore`.
