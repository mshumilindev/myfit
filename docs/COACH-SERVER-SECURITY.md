# Coaching server security (iteration 14)

Operator notes for everything the SERVER-SEC pass added. Code: `functions/src/coach/**`, `functions/src/vault.ts`,
`firestore.rules`, `firebase.json`. Tests: `tests/coach-server`, `tests/rules`, `tests/firebase-headers.test.ts`,
`tests/vault-server.test.ts`, `client/src/coachCrypto/signingPins.test.ts`.

## Switches and parameters

| Name                      | Kind                   | Default                         | Meaning                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ---------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COACH_ENFORCE_APPCHECK`  | deploy param (boolean) | `false`                         | `true` makes every coach callable, `vaultKey` and the signing publishers reject calls without a valid App Check token. Turn on only after the web build ships a reCAPTCHA App Check key (`VITE_APPCHECK_SITE_KEY`) and the metrics show verified traffic.                                                 |
| `APP_ORIGIN`              | deploy param (string)  | `https://spotter-64c3b.web.app` | Origin of invite links: `<origin>/#/invite/<token>`. Only https (or http on localhost) is accepted, anything else falls back to the default. One helper (`functions/src/coach/inviteLink.ts`) builds and parses it; the client agent owns `client/src/coach/inviteLink.ts` and must keep the same format. |
| `VAULT_KV`                | deploy param (string)  | `1`                             | Current vault key version (see "DEK rotation").                                                                                                                                                                                                                                                           |
| `VITE_COACH_SIGNING_PINS` | client build env       | unset                           | JSON array of `{kid, pub}` signing-key pins (see "Signing pin").                                                                                                                                                                                                                                          |

Set a param at deploy time (`firebase deploy --only functions` prompts, or `functions/.env.<project>`).

## Hosting headers

`firebase.json` serves, on every path: an enforced CSP (default-src none, exact script/style URLs for leaflet and Puter
because the app loads them; `frame-ancestors 'none'`, `object-src 'none'`, `upgrade-insecure-requests`), a stricter
Report-Only CSP with `require-trusted-types-for 'script'` (collect violations before enforcing), `X-Frame-Options: DENY`,
HSTS (2 years, includeSubDomains, no preload), `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
`Permissions-Policy` (camera and geolocation for self only), `COOP: same-origin-allow-popups` (reCAPTCHA / sign-in popups
keep working), `nosniff`. `tests/firebase-headers.test.ts` guards the shape and that every inline handler in
`client/index.html` is covered by a hash. Moving from Report-Only to enforced: drop leaflet/Puter script hosts first (or
self-host them), then copy the Report-Only value into `Content-Security-Policy`.

## Roles, suspension, deletion

- Rules do not trust the token claim alone: `liveUser()` reads `users/{uid}` and requires the same role and a status other
  than `suspended` (`freshCoach()` / `isTrainerOrAdmin()`).
- Demotion (admin changes a trainer to member) and account deletion call `endTrainerRelationships`; suspension pauses
  (rules, `requireRole`, `coachRead` refuse at once) and resumes when lifted. All three revoke refresh tokens.
- Relationship end (`endRelationship`) also deletes plan, schedule, live doc, evidence, `prg-*` programs and assignment,
  rate counters. `adminDeleteUser` runs `purgeAccountCoaching` (conversations with messages, notes, requests, keyring;
  coaching, summaries, trainer notes and decisions about the client, coach and device keys, invites). The audit entries
  other users hold about reads stay on purpose (they are those users' records, 400-day retention).
- Account deletion (SPO-285) is ONE cascade, `functions/src/accountDeletionCore.ts`, used by `adminDeleteUser` and by the
  self-service `deleteMyAccount` (the caller's own uid only; the password is verified on the server as the step-up, five
  attempts per 15 minutes, the last admin cannot delete itself). After `purgeAccountCoaching` it removes the team the
  account owns (members go back to their own team) or its place in another team, programs and their assignments, invites,
  passkeys and challenges, login counters (`loginAttempts.identifier`), `sleepSchedules/{uid}`, legacy trainer notes it wrote,
  Storage `avatars/{uid}/`, `users/{uid}` with every subcollection, username, credentials, and last the Auth user. Every step
  is delete-if-present, so a failed run is finished by running it again. Kept: other people's own records (audit, consentLog,
  notices, 90-day team activity entries). Test: `tests/coach-server/accountDeletion.test.ts` ("registry empty after deletion").

## Legacy callables

`athleteWorkout`, `athleteExerciseHistory`, `trainerClients`, `trainerClientDetail`, `profileUser`, `adminUserDetail`,
`adminExportUser` authorize through `legacyCut()`: the coach of record on an ACTIVE, non-program `coaching/{client}` gets
the same per-category levels as `coachRead`; an admin has no bypass except for clients they coach themselves.
`trainerAddNote` accepts only a sealed envelope (`{noteId, at, keyEpoch, enc}`); plaintext `text` is refused.

## Message rate limit

Counted at trigger time with SERVER time in `rateLimits/{cid}_{from}` (30 per rolling minute per sender, retried triggers
are not double counted). The client-chosen `at` is irrelevant to the limit; rules additionally bound `at` to +-2 min of
request time and `coachExport`-style callables refuse a skew over `MAX_AT_SKEW` (120 s). The sweep purges stale counters.

## Export audit

`coachExport` is the server path: with `release:false` it checks consent per client and category, writes the audit entry
(`via: export`) and returns `{exportId, expiresAt, clients}` (grant TTL `EXPORT_GRANT_TTL`); with `release` it also returns
the data via `coachRead`. The client-side log line remains a secondary record.

## Signing pin

The Ed25519 key that signs coach keys and device keys is pinned in the client build. `config/coachSigning` is read only for
a rotation announcement `next: {kid, pub, by, sig}` signed by an already pinned key; a swapped `pub` in the document is
ignored. No pins: dev and tests fall back to the document, a production build trusts nobody (fails closed).

- Create the value: `node scripts/pin-coach-signing.mjs --kid k1 --key signing.pem` -> `VITE_COACH_SIGNING_PINS=[...]`.
- Rotate: deploy the new secret (`COACH_SIGNING_KEY`), ship a build with BOTH pins (`--add`), generate the announcement with
  `COACH_SIGNING_KEY_OLD=... node scripts/coach-signing-rotate.mjs --old-kid k1 --new-kid k2 --new-pub new.pem`, write the
  JSON into `config/coachSigning`, later drop the old pin. Coach keys must be re-signed by the callable (they are
  re-signed on the next publish).

## Vault key and DEK rotation

`vaultKey` derives `HKDF(master, uid, "spotter.vault.dek.v<kv>")`; v1 equals the original derivation. It refuses suspended
accounts, writes `users/{uid}/keyLog/{day}-kv{n}` (version, count, day; never a key) BEFORE answering, and returns
`{kv, current, key, salt}`; a client may ask for an older `kv` (never a newer one). Rotation plan: (1) set `VAULT_KV=2` and
deploy; (2) clients fetch current and old, re-seal each sealed collection in the background (the vault already keeps a
version tag per envelope), (3) when the last client re-sealed (watch `keyLog`) retire v1 by lowering the maximum accepted
`kv` floor. A bulk server-side re-wrap is NOT offered: it would need all sealed data in plaintext on the server.

## Legacy migration (Q-19)

Admin callable `coachMigrateLegacy({dryRun, limit, after})`; `dryRun` is true unless exactly `false`. It creates
`coaching/{client}` (mode `app`, every consent OFF, `migratedFrom`), the conversation and notices for each user with
`users.trainerId` and no relationship; reconciles a pointer that disagrees with the coaching doc; skips unavailable
trainers and suspended clients. Idempotent; resumable with `next` -> `after`. Run a dry run first, read the counts, then
run with `dryRun:false` page by page.

## Rules interpreter limits

`tests/rules/engine/rulesEngine.ts` models int/float, timestamps, durations, the 10-document get() budget and own-property
lookups. NOT modelled: query provability (`list` is judged per document), `request.query`, `getAfter`, token claims other
than those given, int/float arithmetic corners (`int / int`), exact operator errors on mixed types, callables/triggers.
Run the emulator suite where Java 21 exists: `npx firebase emulators:exec --only firestore "npx vitest run tests/rules/coach.rules.test.ts"`.

## Residuals

- `assignments/{member}` readable by any trainer (Programs screen `documentId() in` query); only memberId + programId.
- `sharedGyms` open write (pre-existing, no personal data).
- Plans/schedules cannot compare their `keyEpoch` to the conversation (the cid is an HMAC); AAD binds cid + epoch instead.
- Live docs of an ended relationship rely on the end routine deleting them.
- A client may grant any uid its vault key (grants are useless without a relationship).

## Screen lock removed (iteration 18)

The idle lock (blur + password prompt after 15 minutes, `VITE_COACH_IDLE_MINUTES`) is gone from the Coach app; there is no manual lock button and no lock screen. Why:

- It protected nothing real. A page reload restored the session and the vault key (the key is cached non-extractably in IndexedDB, `autoVault.ts`), so the "lock" was a CSS blur that any refresh removed. A control that a refresh bypasses is theatre, and it interrupted trainers mid-session.
- The real boundaries stay: **sign-out** (the session ends, the vault key and the sealed local caches are wiped, `vaultIO.ts` + `deviceWipe.ts`), **consent end / relationship end** (client data wiped, conversation keys rotated), and the **re-authentication before irreversible or data-exporting actions** (CSV export, end a relationship, withdraw an invite; `security/reauth.ts`, unchanged).
- A page reload keeps the trainer signed in and decrypting, with no prompt anywhere (pinned by `autoVault.test.ts` "works offline from the cached key" and `security/reauth.test.tsx` "Coach shell has no idle lock").
