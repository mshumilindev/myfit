# Program editor tool

`client/src/tools/programEditor/` is one standalone tool. The user asked for it to become the single place the program is
edited, so it can later grow into a professional constructor. This page is the contract for whoever extends it.

## 1. Shape

```
host (Coach / athlete app / story)
  owns: the document, draft + save + send, words, exercise knowledge, anatomy figure
        |   doc (ProgramDoc)     ^   onChange(next, meta)
        v                        |
  <ProgramEditor host={...} doc onChange readOnly audience partner initial focus />
  owns: operations, history, pipeline, check engine, screens
```

Controlled: the tool never keeps the program. It keeps UI state (selected day / row, pane) and the undo history of the
documents it emitted. A document that arrives from outside (a reload after a conflict) clears history on purpose.

## 2. Document

`ProgramDoc` = `{ name, dayNames, targetMuscles, items[], activities?, ... }`, weekdays ISO 1..7. Plain JSON: safe to store,
send, diff. All ops are generic (`<P extends ProgramDoc>`), spread their input, and so keep host fields (`id`, `status`,
sealed blobs). Coach `Program` and the app's `Program` are passed in as they are.

## 3. The host (`ProgramEditorHost`)

| Field                                             | Purpose                                                                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                                            | `coach` (writes for someone: preview, partner days) or `self` (own program). Sets `DEFAULT_FEATURES`.                                                                  |
| `catalog`                                         | `facts(name)`, `search(query)`. Synchronous and local: the editor works offline.                                                                                       |
| `labels`, `words`                                 | Strings, from the host's dictionary (five locales live in the host). `labels` is `ProgramEditorLabels`; a host dictionary that has the keys satisfies it structurally. |
| `activities`, `equipment`, `weekOrder`, `library` | Pickers, week start, "copy from a template or a client".                                                                                                               |
| `features`                                        | Switch parts off: `library, copyDay, activities, markers, supersets, targets, muscleDays, preview, history`.                                                           |
| `checkContext`, `checkRules`, `describeFinding`   | Check rules provider (section 5).                                                                                                                                      |
| `middleware`                                      | Op middleware (section 6).                                                                                                                                             |
| `slots`                                           | `canvas`, `panes`, `muscleMap`, `preview` (section 4).                                                                                                                 |

Read-only: `<ProgramEditor readOnly />` (a disabled pane; every op is a no-op). Draft / save / publish ports are not in the
tool: the Coach host has `ProgramPort` + `draftStore`, the app host saves with its own Firestore code. Both receive `onChange`.

## 4. Extension points

- **Canvas / layout renderer.** `slots.canvas: ComponentType<CanvasProps>` replaces the week + day canvas. It receives
  `state: EditorState` (doc, day, mode, selection, pane, readOnly, labels, host) and `actions: EditorActions`
  (`edit`, `selectDay`, `select`, `openPane`, `addExercise`, `undo`, `redo`...). The default is `WeekCanvas`, exported, so a new
  canvas can wrap it. A grid/timeline/spreadsheet constructor is a different canvas, nothing else changes.
- **Inspector panels.** `slots.panes[id] = { title, render }`; open with `actions.openPane(id)`. Appears in the inspector
  (wide) or the sheet (phone).
- **Library panels.** `host.library` feeds the built-in copy pane; a different source = a `pane` that calls `actions.edit`.
- **Preview.** `slots.preview` replaces the "what the client sees" renderer (`PreviewProps`).
- **Anatomy figure.** `slots.muscleMap`; without it the muscle chips are the picker.
- **Check rules.** `host.checkRules(builtIn) => rules`. A rule is `{ id, run(input) => Finding[] }`; findings of an unknown
  `kind` are described by `host.describeFinding`. `runCheck(doc, env)` is pure and also usable without the UI (the Coach
  draft store computes it for the Send gate).
- **Op middleware.** `host.middleware: OpMiddleware[]`, `({prev, next, label}) => doc`. Return `prev` to veto, a changed copy to
  normalise. Pure.
- **No hotkeys**, by product rule; a key handler in the folder fails the architecture test.

## 5. Stories and tests

Stories `Tools/Program editor`: coach, self, read only, with check findings, long uk and pl strings, phone 390. Tests: see the README.

## 6. Migration status

There is ONE program editor implementation: this tool.

| Surface                                                                    | Host                                                                                                                                                      |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coach editor and Check before sending                                      | `coach/program/EditorScreen.tsx`, `CheckScreen.tsx`, `toolHost.tsx` (mode `coach`), at `#/c/programs/<programId>/edit` and `/check`.                      |
| Athlete app Programs screen and the member's review of a trainer's program | `views/programs/ProgramPage.tsx` around `selfEditor.tsx` (mode `self`, `readOnly` for the review), at `#/programs/<programId>/edit` and `#/programs/new`. |

`views/programs/ProgramBuilder.tsx` and `DayEditor.tsx` (the legacy 4-step builder) are gone. The page keeps what is not editing:
name, length, status, "start from" (CSV import, duplicate), save / activate / archive / delete / assign (Firestore and callables),
CSV export, leaving with unsaved changes. The app model (`views/programs/model.ts`) keeps storage and validation only; the
operations (add / patch / remove rows, warm-up exercises, activities, copy day) are the tool's `model/ops.ts`.

### What the tool gained for the athlete host

Switches (`features`): `weekSetup` (seven weekday toggles, asks before a day with content becomes rest), `dayNames` (name field on the
day card), `cardio` (add a cardio machine, edit its minutes). Host fields: `newRows` (`targets` = 3 x 10, the athlete default; `bare` =
the Coach default), `cardio`, `exerciseLinks` (details / history), `warmupTarget`, `slots.dayTag` (the "With your trainer" tag),
`ExerciseFacts.flag` / `CatalogHit.flag` (the athlete's health limits, shown, never blocking), `CatalogHit.id`. Warm-up markers hold a
list of catalog exercises (reps or seconds). `EditorActions.toggleDay`. `ProgramEditorProps.focus.nonce` moves a running editor to a
day (the page's "fix this day" button).

### Behaviour intentionally changed or dropped when the builder moved onto the tool

- The phone no longer walks four steps (basics, week, days, review): the page is one scroll (basics, week strip, day, readiness line);
  the tool's sheet edits a row on a phone. The review step's day list is the tool's day strip; the readiness line stays.
- Removing a planned activity: no question when it is still as added; a confirm when the person changed its minutes, effort or
  timing (`activityHasContent`). Either way an Undo toast is shown and the history Undo restores it. (Iteration 12.)
- Making a day with content a rest day still asks. Activities on a rest day are shown read-only under the editor, as before.
- Rows are edited in the inspector / sheet, not in an expandable row ("More" options are the pane's sections). The exercise picker is the
  tool's search pane (muscle chips + search). Iteration 12 restored the rest: the Add pane offers "Create <name>" for a typed name the
  catalog does not know (feature `customExercise`, `host.canonicalName` spells known names the catalog way, names are cleaned and cut at
  120 characters, kept by name inside the sealed program; the shared catalog is only extended from the session's own sheet), and the
  athlete host passes the session's real `ExercisePicker` (plain program mode) as `slots.exercisePicker` behind "Browse all exercises".
- Saving or activating replaces the document, so undo history starts again after a save.
- Warm-up exercises are one line each (name + target) with an Edit drawer (reps or seconds, and a weight field for loaded moves through
  `host.warmupWeighted`; stored in kg, shown in `host.weightUnit`). Iteration 12.

## 7. The page: one layout, two hosts (iteration 13)

The user's rule: the editor is a separate, self-contained INTERFACE with a 100% identical design in the Coach app and in the athlete
app. Only the colour (the accent ramp of the app: `.app-coach` or the athlete default) and the functions may differ.

`EditorPage` (`ui/EditorPage.tsx`, `EditorPage.css`) is the whole page. A host never draws page chrome, never adds page CSS and never
styles an element; it fills FIXED SLOTS:

| Slot                             | Position                                                                                           | Coach host                                                                                         | Athlete host                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `chrome.back`                    | back pill, top left                                                                                | opener (client tab or Programs list)                                                               | Programs                                       |
| `chrome.title`, `chrome.subject` | h1 and avatar + one line                                                                           | "Edit program", client + program + version                                                         | "Edit program", you + program + length         |
| `chrome.state`                   | live text left of the buttons                                                                      | Saving / Unsaved changes / Draft saved                                                             | the same strings                               |
| `chrome.actions`                 | button cluster, the last one is the main action; on a phone the same buttons sit in the sticky bar | Check before sending, Save draft, Send                                                             | Save draft, Activate / Save                    |
| `chrome.menu`                    | overflow menu, last in the cluster                                                                 | none                                                                                               | Assign, Duplicate, Export CSV, Archive, Delete |
| `chrome.notices`                 | strips under the header                                                                            | save errors, conflict, sent                                                                        | save error                                     |
| `band`                           | the info band (Card): caps label + status tag, rows, ONE note                                      | shared-program row, trainer days, version row with diff; note: "Send unlocks when these are fixed" | name, length, start from; note: readiness      |
| (editor)                         | toolbar (undo, redo, week summary), training days, day card, inspector (sheet on a phone)          | same                                                                                               | same                                           |
| `chrome.footer`                  | quiet notes under the page                                                                         | none                                                                                               | rest-day activities, weight note               |

Slot content is built of kit elements and the tool's `Band*` pieces (`BandRow`, `BandFields`, `BandField`, `BandText`, `ChangeList`).
Both hosts pass the same page width (`--pe-page-max`), the same spacing and the same inspector width (no host overrides `--pe-gut` / `--pe-insp`).
`PageFrame` is the same chrome without the editor; the Coach "Check before sending" page uses it.

### URLs

- Athlete app: `#/programs/<programId>/edit` (a saved program), `#/programs/new` (not saved yet: blank, import or suggestion; the first
  save turns it into `#/programs/<id>/edit`). `#/programs/<id>` is the same as `/edit`. A link to a program that is not there falls back to
  `#/programs`. Back pops the history entry the list pushed, or goes to the list.
- Coach app: `#/c/programs/<programId>/edit` and `#/c/programs/<programId>/check`, `programId` = the plan program of the client
  (`prg-<clientId>`). `?client=<clientId>` records that the page was opened from that client's Program tab: Back returns there; without
  it Back returns to the Programs list. The old URLs `#/c/clients/<id>/program/edit|check` are redirected (the hash is rewritten in place).

### How the identity is verified

- `ui/EditorPage.pair.test.tsx`: the Storybook host pair (`stories/HostPair.tsx`) renders the same DOM skeleton (tags, roles, kit and `pe-`
  classes) for seven states; `coach/program/pageIdentity.test.tsx` does the same with the REAL hosts at 1440, 768 and 390.
  `ui/domSkeleton.ts` lists the functional slots that are compared as containers only and the optional parts, each with its reason.
- Storybook `Tools/Program editor page` (state x host), shot at 1440 / 768 / 390 and compared with `scripts/page-pair-diff.py`, which
  normalises the accent and reports the differing regions by slot. The result is in `docs/PROGRAM-EDITOR-PAGE-DIFF.md`.
