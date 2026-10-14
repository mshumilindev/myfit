import { useMemo, useState, type ReactNode } from 'react';
import { CoachShell } from '../CoachApp';
import { configureCoachData } from '../data/config';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import type { Program } from '../../views/programs/model';
import { toMusclesMode } from '../../tools/programEditor';
import { coachCatalog } from './toolHostBase';
import { configureProgramData } from './config';
import { EditorInitialContext, type EditorScreenProps } from './EditorScreen';
import { fixtureWorldLite as buildFixtureWorldLite } from './__fixtures__/fixtures';
import { createFixturesProgramPort } from './__fixtures__/programPort';
import { setRowMode } from './ops';
import type { ProgramBundle } from './types';
import type { CoachRoute } from '../routes';

export type Scenario = (b: ProgramBundle) => ProgramBundle;

const onDraft =
  (f: (d: Program) => Program): Scenario =>
  (b) => ({ ...b, draft: f(b.draft) });

/** Three rows of the Oleh draft are "just the exercise": no sets, no targets (editor-bare-rows, diagnostics-bare). */
export const bareRows: Scenario = onDraft((d) =>
  ['Paused bench press', 'Incline Dumbbell Press', 'Weighted plank'].reduce((p, name) => {
    const it = p.items.find((i) => i.name === name);
    return it ? setRowMode(p, it.id, true) : p;
  }, d),
);

/** Lower B is defined by muscles (editor-day-muscles). */
export const musclesDay: Scenario = onDraft((d) => toMusclesMode(d, 6, coachCatalog));

export interface ProgramStoryFrameProps {
  route: CoachRoute;
  initial?: EditorScreenProps['initial'];
  scenario?: Scenario;
  /** Slow network: skeleton states. */
  delayMs?: number;
  failNext?: 'conflict' | 'offline' | 'unavailable';
}

/**
 * Stories: the real Coach shell around one program route, with the fixtures world and the fixtures program adapter
 * (created per mount so every story starts from its own store). `initial` opens a scene in the editor.
 */
export function ProgramStoryFrame({
  route: first,
  initial,
  scenario,
  delayMs,
  failNext,
}: ProgramStoryFrameProps): ReactNode {
  const [route, setRoute] = useState<CoachRoute>(first);
  useMemo(() => {
    configureCoachData({ world: createFixturesPort({ warm: true }) });
    const port = createFixturesProgramPort({
      world: buildFixtureWorldLite(),
      warm: !delayMs,
      delayMs,
      failNext,
    });
    configureProgramData({
      port: scenario
        ? {
            ...port,
            peek: (c) => {
              const b = port.peek(c);
              return b ? scenario(b) : b;
            },
            load: async (c, o) => scenario(await port.load(c, o)),
          }
        : port,
    });
  }, [scenario, delayMs, failNext]);
  return (
    <EditorInitialContext.Provider value={initial}>
      <CoachShell
        role="trainer"
        name="Iryna Melnyk"
        route={route}
        onNavigate={setRoute}
        onExitToWorkouts={() => undefined}
        onOpenProfile={() => undefined}
        onOpenShell={() => undefined}
      />
    </EditorInitialContext.Provider>
  );
}
