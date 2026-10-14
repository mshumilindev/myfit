/**
 * The two hosts of the program editor PAGE side by side in Storybook: the Coach app (`.app-coach` accent ramp) and the
 * athlete app, each with its OWN slot content (the real `AssignmentCard` / `AthleteBandBody`), the SAME fixture document.
 * `scripts/page-pair-diff.py` shoots both per state and width and compares them with the accent normalised: what differs
 * must sit in a functional slot (band rows, action buttons), never in the layout.
 */
import { useState } from 'react';
import { AssignmentCard } from '../../../coach/program/editor/AssignmentCard';
import { fixtureWorldLite } from '../../../coach/program/__fixtures__/fixtures';
import { createFixturesProgramPort } from '../../../coach/program/__fixtures__/programPort';
import { LOCALES } from '../../../i18n';
import { pgEn } from '../../../i18n/coachProgram.en';
import { AthleteBandBody } from '../../../views/programs/ProgramPage';
import type { Program } from '../../../views/programs/model';
import { diffPrograms } from '../model/diff';
import { addMarker, addWarmupExercise, addActivity } from '../model/ops';
import { emptyDoc, type ProgramDoc } from '../model/doc';
import type { EditorScene } from '../ui/ProgramEditor';
import type { PageButton, PageMenuItem } from '../ui/EditorPage';
import { EditorPage } from '../ui/EditorPage';
import { demoDoc, demoHost } from './demoHost';

export type PairHostKind = 'coach' | 'athlete';
export type PairState =
  'empty' | 'selected' | 'activity' | 'warmup' | 'findings' | 'readonly' | 'muscles';

const p = pgEn;
const t = LOCALES.en;

/** One fixture document per state: the same for both hosts. */
export function pairDoc(state: PairState): { doc: ProgramDoc; scene: EditorScene } {
  switch (state) {
    case 'empty':
      return { doc: emptyDoc('Upper / Lower 3x'), scene: {} };
    case 'activity': {
      const d = addActivity(demoDoc(), {
        day: 1,
        type: 'run',
        minutes: 40,
        effort: 'moderate',
        when: 'after',
      });
      return { doc: d, scene: { day: 1, itemId: d.activities![d.activities!.length - 1].id } };
    }
    case 'warmup': {
      let d = addMarker(demoDoc(), 1, 'warmup');
      const id = d.items.find((i) => i.kind === 'warmup')!.id;
      d = addWarmupExercise(d, id, { name: 'Lateral Raise', reps: 15, weight: 4 });
      d = addWarmupExercise(d, id, { name: 'Plank', durationSec: 30 });
      return { doc: d, scene: { day: 1, itemId: id } };
    }
    case 'muscles':
      return { doc: demoDoc(), scene: { day: 5 } };
    default:
      return { doc: demoDoc(), scene: { rowName: 'Barbell Bench Press' } };
  }
}

export function HostPair({ host, state }: { host: PairHostKind; state: PairState }) {
  const init = pairDoc(state);
  const [doc, setDoc] = useState<ProgramDoc>(init.doc);
  const readOnly = state === 'readonly';
  const blocked = state === 'findings';
  const noop = () => undefined;
  const [bundle] = useState(() => {
    const port = createFixturesProgramPort({ world: fixtureWorldLite(), warm: true });
    return port.peek('c1')!;
  });
  const [versionOpen, setVersionOpen] = useState(false);

  const coach = host === 'coach';
  const editorHost = demoHost({ mode: coach ? 'coach' : 'self' });
  const back = { label: p.edBack, text: coach ? 'Clients' : t.progTitle, onClick: noop };

  const actions: PageButton[] = readOnly
    ? []
    : coach
      ? [
          {
            id: 'check',
            label: p.edCheck(blocked ? 2 : 0),
            shortLabel: p.edCheckShort(blocked ? 2 : 0),
            variant: blocked ? 'primary' : 'secondary',
            icon: blocked ? 'warning' : 'list-checks',
            onClick: noop,
          },
          { id: 'save', label: p.edSaveDraft, onClick: noop },
          {
            id: 'send',
            label: p.edSendTo('Oleh'),
            shortLabel: p.edSendShort,
            variant: blocked ? 'secondary' : 'primary',
            ariaDisabled: blocked,
            describedBy: blocked ? 'pe-band-note' : undefined,
            onClick: noop,
          },
        ]
      : [
          { id: 'save', label: t.pgSaveDraft, onClick: noop },
          {
            id: 'primary',
            label: blocked ? t.pgFillDay('Wednesday') : t.progActivate,
            variant: 'primary',
            onClick: noop,
          },
        ];
  const menu: PageMenuItem[] = coach
    ? []
    : [
        { id: 'dup', label: t.progDuplicate, icon: 'copy', onSelect: noop },
        { id: 'csv', label: t.csvExport, icon: 'download-simple', onSelect: noop },
        { id: 'del', label: t.delete, icon: 'trash', onSelect: noop },
      ];

  const draftAsProgram = { ...(doc as unknown as Program), weeks: 8 } as Program;
  const band = coach
    ? {
        label: p.edBandAssignment,
        status: { label: p.ptDraft(bundle.draftVersion), tone: 'neutral' as const },
        note:
          blocked && !readOnly
            ? {
                id: 'pe-band-note',
                tone: 'illness' as const,
                icon: 'warning',
                text: p.edSendUnlocks,
                items: [{ id: 'range-0', label: 'Legs: 4 of 10 sets', onClick: noop }],
              }
            : undefined,
        children: (
          <AssignmentCard
            p={p}
            locale="en"
            bundle={bundle}
            draft={draftAsProgram}
            trainerDays={bundle.trainerDays}
            clientName="Oleh Bondar"
            wide
            changes={diffPrograms(doc, doc)}
            versionOpen={versionOpen}
            onVersionToggle={() => setVersionOpen(!versionOpen)}
            canEdit
            dirty={false}
            onToggleDay={noop}
            onClearStale={noop}
            onSetTimes={noop}
            onCopyTo={noop}
          />
        ),
      }
    : {
        label: p.edBandProgram,
        status: { label: t.progStatusDraft, tone: 'neutral' as const },
        note: readOnly
          ? undefined
          : {
              id: 'pe-band-note',
              tone: blocked ? ('illness' as const) : ('ok' as const),
              icon: blocked ? 'warning-circle' : 'check',
              text: blocked ? t.pgNeedsContent('Wednesday') : t.pgReadyAll(3),
            },
        children: (
          <AthleteBandBody
            draft={draftAsProgram}
            readOnly={readOnly}
            showStartFrom={!readOnly && state === 'empty'}
            onChange={(next) => setDoc(next as unknown as ProgramDoc)}
            onImport={noop}
            onDuplicate={noop}
          />
        ),
      };

  return (
    <div className={coach ? 'app-coach' : undefined} data-host={host}>
      <EditorPage
        chrome={{
          back,
          title: p.edTitle,
          subject: {
            name: coach ? 'Oleh Bondar' : 'Maria Kovalenko',
            text: coach
              ? p.edSubline('Oleh Bondar', doc.name, bundle.draftVersion)
              : `${doc.name} · ${t.progWeeksCount(8)} · ${t.progDaysCount(3)}`,
          },
          state: readOnly ? '' : p.edUnsaved,
          actions,
          menu: menu.length ? { label: p.edMoreActions, items: menu } : undefined,
        }}
        band={band}
        doc={doc}
        onChange={(next) => setDoc(next)}
        host={editorHost}
        readOnly={readOnly}
        audience={coach ? 'Oleh Bondar' : ''}
        partner={coach ? 'Iryna Melnyk' : ''}
        partnerDays={coach ? [1] : []}
        initial={init.scene}
      />
    </div>
  );
}
