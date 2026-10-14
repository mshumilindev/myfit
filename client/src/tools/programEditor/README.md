# Program editor (standalone tool)

One tool, two hosts: the Coach dashboard (`mode: 'coach'`) and the athlete app (`mode: 'self'`).
Full guide and extension points: `docs/PROGRAM-EDITOR-TOOL.md`; page differences between the two hosts: `docs/PROGRAM-EDITOR-PAGE-DIFF.md`;
kit group and status of the dashboard: `docs/UI-KIT.md` (Coach in the kit) and `docs/COACH-STATUS.md`.
Inspector panes live in `ui/panes/` (one module per family); `ui/Panes.tsx` is the entry (`PaneBody`, `paneTitle`). Catalog types: `host.catalog.ts`.

```tsx
import {
  ProgramEditor,
  runCheck,
  type ProgramDoc,
  type ProgramEditorHost,
} from '../tools/programEditor';

<ProgramEditor
  doc={doc}
  onChange={(next, meta) => setDoc(next)}
  host={host}
  audience="Oleh Bondar"
/>;
```

## What is in the box

| Part          | Where               | Notes                                                                                                                                                 |
| ------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document      | `model/doc.ts`      | Plain JSON (`ProgramDoc`). A host program is structurally a `ProgramDoc`; host-only fields survive every op.                                          |
| Operations    | `model/ops.ts`      | Pure, immutable: `addItem`, `patchItem`, `moveItem`, `supersetWith`, `toggleMuscle`, ...                                                              |
| History       | `model/history.ts`  | Snapshot undo/redo (`record`, `undo`, `redo`). The editor resets it when a document arrives from outside.                                             |
| Pipeline      | `model/pipeline.ts` | `applyEdit` runs host `middleware` before history and `onChange`.                                                                                     |
| Diff          | `model/diff.ts`     | `diffPrograms(a, b)` -> `Change[]` (version rows, "sent" summaries).                                                                                  |
| Check         | `check/engine.ts`   | `runCheck(doc, env)` -> `Check` (findings, volume, push/pull). Rules are a list: `host.checkRules`.                                                   |
| UI            | `ui/`               | `ProgramEditor`, `WeekCanvas`, `CheckReport`. Kit only; layout CSS only; tokens only.                                                                 |
| Page          | `ui/EditorPage.tsx` | `EditorPage` / `PageFrame`: THE page of both apps (header, state, actions, menu, info band, footer, phone bar). Hosts fill slots; see docs section 7. |
| Host contract | `host.ts`           | `ProgramEditorHost`: catalog, labels, words, activities, library, features, middleware, slots.                                                        |

## The rules of this folder (enforced by `architecture.test.ts`)

- Imports: this folder, `components/ui/**`, the `Icon`, `react`. Nothing from `coach/**`, `views/**`, Firestore, `store`, or a host
  dictionary. A host passes words in (`host.labels`, `host.words`); the tool never reads a dictionary.
- CSS: tokens only (no hex, no raw px outside media queries), no raw `button` / `input`, no key handlers (no hotkeys).
- The tool does not store anything. Draft, save and send are the host's (the Coach draft store, the app's Firestore save);
  the tool reports `onChange(next, { kind: 'edit' | 'undo' | 'redo', label })`.

## Tests and stories

`model/model.test.ts`, `check/check.test.ts`, `ui/ProgramEditor.test.tsx`, `architecture.test.ts`; the hosts have their own:
`coach/CoachProgramRoutes.test.tsx` (mounted CoachApp), `views/programs/selfEditor.test.tsx`. Identity of the page in both apps:
`ui/EditorPage.pair.test.tsx` (Storybook pair) and `coach/program/pageIdentity.test.tsx` (the real hosts).
Stories: `Tools/Program editor/*` (`stories/ProgramEditor.stories.tsx`), `Tools/Program editor page/*` (the page in both hosts: `stories/HostPair.stories.tsx`), built on `stories/demoHost.tsx`, the shortest example of a host.
