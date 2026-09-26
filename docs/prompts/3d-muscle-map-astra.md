# Brief: interactive 3D muscle map for Spotter (React Three Fiber)

You are a senior front-end engineer working inside an existing production codebase. Your job is to
add an **interactive 3D muscle body** to the Spotter gym-tracker PWA, as a _hero_ visualisation, without
breaking anything that exists today. Work in small verified slices. Do not invent facts about the
repo — everything you need is stated below; if something is missing, inspect the code first.

---

## 1. Ground truth about the codebase (do not hallucinate beyond this)

- Stack: **React + Vite + TypeScript (strict)**, PWA (vite-plugin-pwa, `generateSW`, offline-first),
  Firebase (Firestore + offline queue). Dark theme only. Client lives in `client/`.
- Gates that must stay green on every slice: `tsc --noEmit` = 0 errors, `eslint` = 0, `vitest run`
  green (currently 23 files / 220 tests), and a clean `vite build`.
  React Compiler ESLint rules are on (`react-hooks/purity`, `react-hooks/set-state-in-effect`,
  `react-hooks/static-components`) — no `Date.now()` in render, no components defined inside
  render, no `setState` directly inside `useEffect`.
- i18n: 5 locales (`client/src/i18n/{en,uk,pl,lt,et}.ts`) with **compile-time key parity**
  (`Strings = typeof en`). Any new user-facing string must be added to all five or `tsc` fails.
  Use `useT()` / `t()`.
- **Design tokens** are the only source of colour/radius (`client/src/styles.css :root`):
  `--color-accent(-100…-950)`, `--color-neutral-100…900`, `--color-rest-200/300/400/700/800/900`,
  semantic families `--color-ok|danger|kcal` each with `-tint/-text/-line`, surfaces `--color-bg`,
  `--color-surface`, `--color-text`, `--color-divider`, radii `--radius-sm/md/lg/sheet`,
  glass tokens `--glass-*`, `--font`. **No raw hex in views/components.** Read
  `docs/UI-KIT.md` and `docs/UI-REFACTOR-PLAN.md` first — they define the rules.
- A UI kit is being extracted into `client/src/components/ui/` (`Button`, `Card`, `Chip`, `Banner`
  exist, each with a co-located `.css`). Every primitive must appear in the dev-only gallery at
  `#/uikit` (`client/src/components/ui/Gallery.tsx`) in all its states — that gallery is the
  acceptance surface.

### The current 2D muscle map (keep it — this is what you extend, not replace)

- Library: npm `body-muscles@^1.0.0` — exports `FRONT_MUSCLES` / `BACK_MUSCLES` SVG path data.
- Component file: `client/src/components/Muscle.tsx`. Public API used across the app:
  - `MuscleIcon({ muscle, variant: 'chip'|'chipLg'|'row'|'figure'|'full', tone })` — tiny marks
    in chips/rows, auto-crops the figure to the relevant body part (arm for biceps, legs for
    squat…). Used in ProgramsView, ProgressView, MuscleHistoryView, etc.
  - `MuscleHeatmap({ colors: Partial<Record<MuscleGroup, string>>, width?, className? })` —
    renders front + back SVG figures side by side, each muscle filled with the given colour.
    Rendered in `client/src/views/ProgressView.tsx` (≈ line 655 with volume/fatigue lens colours,
    ≈ line 685 with brass colours).
  - `SessionMuscleMap.tsx` — per-session variant.
- Muscle vocabulary (`MuscleGroup` in `client/src/data/exercises.ts`):
  `chest, back, lats, traps, lower_back, shoulders, biceps, triceps, forearms, quads, adductors,
hamstrings, glutes, abductors, calves, core, neck, fullbody, cardio`.
  Notes: `back` is a legacy umbrella (finer groups `lats/traps/lower_back` are what the catalog
  emits now); `fullbody` and `cardio` are not anatomical regions — do not try to paint them.
- Zone colours (`client/src/volume.ts`): `ZONE_COLOR: Record<Zone, string>` with
  `none → var(--color-neutral-800)`, `under → var(--color-neutral-600)`,
  `productive → var(--color-ok)`, `high → var(--color-accent)`, `over → var(--color-danger)`.
  **These are CSS variable strings, not hex.** A 3D material needs a real colour, so resolve
  them at runtime with `getComputedStyle(document.documentElement).getPropertyValue(...)` (or a
  tiny `resolveToken()` helper) — never hardcode the hex; the map must recolour if tokens change.

---

## 2. What we want

A **real 3D, rotatable, tappable human muscle body** that shows per-muscle colour (the same
`colors` contract as `MuscleHeatmap`), used only on _hero_ surfaces where there is room:

1. The volume/fatigue heatmap panel in `ProgressView` (replaces the two flat figures there).
2. Later: the exercise-detail screen (out of scope for the first delivery — design the component
   so it can be dropped there).

Everything small — chips, row icons, session recap marks — **stays 2D** via the existing
`MuscleIcon`. A 3D model cannot auto-crop into a 15 px chip. This is a hybrid by design.

### Important reality check

You do not generate 3D meshes natively. **Do not try to synthesise anatomy geometry yourself.**
Source an existing, properly licensed, _muscle-segmented_ human model where each muscle (or
muscle group) is a separate mesh/node so it can be coloured and hit-tested individually.
Candidates to evaluate (verify licence and segmentation before choosing):

- **Z-Anatomy** (open-source, Blender-based, CC BY-SA 4.0) — muscles are separate objects.
- **BodyParts3D** (Database Center for Life Science, CC BY 2.1 JP) — per-part meshes.
- Any Sketchfab / TurboSquid model with an explicit CC-BY or paid commercial licence and
  per-muscle separation.

Before committing to a model, **stop and report**: name, licence, attribution requirement,
whether attribution must be visible in-app, mesh count, raw size, and how cleanly its parts map
onto our 16 paintable muscle groups. Ask for approval. Licensing is the user's call, not yours.

---

## 3. Technical design (follow this unless you find a real reason not to — then say why)

- **Renderer:** `three` + `@react-three/fiber` + `@react-three/drei` (`OrbitControls` with
  rotate + zoom only, no pan; `useGLTF`; `Bounds`/`Center`). Add these as dependencies.
- **Asset pipeline (must be reproducible, checked into the repo):**
  - A script (`scripts/build-body-model.*`, Node or Python) that takes the source model, keeps
    only the muscle nodes we need, merges each anatomical group into one mesh named exactly by
    our `MuscleGroup` id (`quads`, `lats`, …), decimates to a mobile-safe budget, and exports a
    single **glTF binary with Draco compression** (`gltf-transform` / `gltf-pipeline`).
  - A JSON manifest `client/public/body/manifest.json` with the model version, licence and
    attribution string, and the list of node names → `MuscleGroup`.
  - **Budget:** ≤ 1.5 MB compressed for the whole body, ≤ 60k triangles total. Report actual
    numbers.
- **Component:** `client/src/components/ui/MuscleBody3D.tsx` (+ `MuscleBody3D.css`), props:
  ```ts
  {
    colors: Partial<Record<MuscleGroup, string>>;   // same contract as MuscleHeatmap
    selected?: MuscleGroup | null;
    onSelect?: (m: MuscleGroup | null) => void;     // tap/click a muscle
    view?: 'front' | 'back' | 'auto';               // initial camera; user can rotate
    height?: number | string;
    interactive?: boolean;                          // false = static, no controls (for cards)
  }
  ```
  - Materials: matte (MeshStandardMaterial, low metalness, roughness ~0.8) so the token colours
    read exactly; unpainted muscles use `--color-neutral-800`; a thin darker outline/rim so
    adjacent muscles of the same zone stay distinguishable. Selected muscle: brighter + subtle
    emissive from the same token. Background transparent (the app's diamond/glass field shows
    through).
  - Hit-testing per merged muscle mesh; tap highlights + calls `onSelect`. Hover on desktop.
  - **Lazy load everything 3D** with `React.lazy` + `Suspense`, so the three.js bundle and the
    glTF never load until the panel is on screen. Show the existing `MuscleHeatmap` (2D) as the
    Suspense fallback **and** as the permanent fallback when WebGL is unavailable / on
    `prefers-reduced-motion` / when the device reports low memory (`navigator.deviceMemory < 3`).
    The 2D map must remain fully functional — never regress it.
  - Respect the PWA: the glTF must be precached by the service worker (add it to the workbox
    `globPatterns`/`includeAssets` config in `vite.config.*`) so the map works offline.
  - Accessibility: a visually-hidden list of muscles + their zone labels mirrors the 3D scene;
    keyboard users can cycle muscles with arrow keys and select with Enter.
- **Wire-up:** in `ProgressView`, swap the two `MuscleHeatmap` usages for `MuscleBody3D` behind
  a small `useIsDesktop()`/feature check, keeping the lens toggle (volume / fatigue / readiness)
  driving `colors` exactly as today. Keep the zone legend row.
- **Gallery:** add a "MuscleBody3D" group to `#/uikit` showing: all-zones-painted, one muscle
  selected, `interactive={false}`, and the 2D fallback state.

---

## 4. Working loop (non-negotiable)

Small slice → verify live → gates → verify again. Concretely:

1. Slice A — pipeline + manifest + budget report + licence report. **Stop for approval.**
2. Slice B — `MuscleBody3D` rendering the model with static colours in the gallery only. Screenshot.
3. Slice C — interactivity (rotate/zoom/tap/select/keyboard) in the gallery. Screenshot.
4. Slice D — fallbacks (Suspense → 2D, no-WebGL → 2D, reduced motion, low memory). Prove each.
5. Slice E — wire into `ProgressView` behind the check; before/after screenshots; the 2D path
   still renders where it should.
6. Slice F — PWA precache + offline check; bundle-size report (`vite build` output: the 3D chunk
   must be a separate lazy chunk, and the initial app bundle must not grow).

After every slice: `tsc` 0, `eslint` 0, `vitest run` green, clean build, and a screenshot of the
gallery + the touched screen. Do not proceed to the next slice on a red gate.

---

## 5. Acceptance criteria

- Rotates smoothly (≥ 50 fps) on a mid-range Android phone and iPhone in the installed PWA;
  first paint of the 3D panel ≤ 1.5 s on 4G after the initial cache.
- Per-muscle colours match `ZONE_COLOR` tokens exactly (resolved at runtime), including after a
  token change in `styles.css`.
- Tapping any painted muscle selects it and fires `onSelect`; the 2D `MuscleIcon`/`MuscleHeatmap`
  API and visuals are unchanged everywhere else in the app.
- Works offline; initial bundle size unchanged; 3D code + model live in lazy chunks/assets.
- Licence and attribution handled exactly as the chosen model requires, and approved by the user.
- All five locales updated for any new strings; `#/uikit` shows the component in all states.

## 6. How to report

Per slice: what changed (files), gate results, the numbers (triangles, MB, fps if measured),
screenshots, and any decision you need from the user — especially the model/licence choice.
Keep it short; no tour of the code.
