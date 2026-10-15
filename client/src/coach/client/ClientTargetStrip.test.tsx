import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clientEn as t } from '../../i18n/coachClient.en';
import type { ProgramAssignment } from '../../data/programMine';
import { setExerciseUnit } from '../../store';
import { setViewport } from '../testViewport';
import { applyProgramLayer } from '../data/firestore/clientProgram';
import { ClientTargetStrip } from './ClientExtras';
import { configureClientCoach } from './data/config';
import { createFixturesClientChatPort } from './data/__fixtures__/chat';
import { createFixturesClientPort } from './data/__fixtures__/fixtures';

beforeEach(() => {
  setViewport(1440);
  configureClientCoach({
    port: createFixturesClientPort({ scenario: 'active' }),
    chat: createFixturesClientChatPort({ unread: 0 }),
  });
});
afterEach(() => {
  cleanup();
  setExerciseUnit('Barbell Squat', 'kg');
  configureClientCoach();
});

const row = (id: string, day: number, over: Record<string, unknown> = {}) => ({
  id,
  day,
  position: 0,
  name: 'Barbell Squat',
  kind: 'strength' as const,
  sets: 4,
  reps: 5,
  durationMin: null,
  equipment: [],
  ...over,
});
const runnable = {
  id: 'prg-c1-2',
  name: 'Block',
  weeks: 6,
  daysPerWeek: 2,
  // the plaintext template keeps the structure, drop set included; the layer adds the sealed prescription
  items: [row('a', 2, { dropLast: true }), row('b', 4, { sets: 3, reps: 8 })],
};
const layer = {
  program: {
    items: [
      row('a', 2, { targetWeight: 120, targetRpe: 8, restSec: 150, note: 'Pause at the bottom' }),
      row('b', 4, { sets: 3, reps: 8, targetWeight: 90, targetRpe: 7, restSec: 120 }),
    ],
    activities: [],
  },
};
const assignment = (): ProgramAssignment =>
  ({
    program: applyProgramLayer(runnable as never, layer as never),
    assignedBy: 'trainer-iryna',
    week: 1,
    done: 0,
    total: 12,
    expectedSoFar: 1,
    adherence: null,
  }) as never;

describe('session target strip (the workout screen)', () => {
  it('shows weight, RPE, rest, the cue and the drop set of the row the exercise was started from, not of the first row with that name', async () => {
    render(<ClientTargetStrip exName="Barbell Squat" planItemId="b" assignment={assignment()} />);
    await waitFor(() => expect(screen.getByText(/90 kg/)).toBeTruthy());
    expect(screen.getByText(/RPE 7/)).toBeTruthy();
    expect(screen.getByText(/2:00/)).toBeTruthy();
    expect(screen.queryByText(/120 kg/)).toBeNull();
  });
  it('the other row carries its own cue and the last-set drop', async () => {
    render(<ClientTargetStrip exName="Barbell Squat" planItemId="a" assignment={assignment()} />);
    await waitFor(() => expect(screen.getByText(/120 kg/)).toBeTruthy());
    expect(screen.getByText(/RPE 8/)).toBeTruthy();
    expect(screen.getByText(/2:30/)).toBeTruthy();
    expect(screen.getByText('Pause at the bottom')).toBeTruthy();
    expect(screen.getByText(new RegExp(t.seDropLast))).toBeTruthy();
  });
  it('without the layer (old data) the plain template still shows sets and reps', async () => {
    const plain = { ...assignment(), program: runnable } as never;
    render(<ClientTargetStrip exName="Barbell Squat" planItemId="a" assignment={plain} />);
    await waitFor(() => expect(screen.getByText(/4 × 5/)).toBeTruthy());
    expect(screen.queryByText(/kg$/)).toBeNull();
  });
});

describe('units', () => {
  it("a lift the athlete trains in lb shows the trainer's kg target in lb (the program stores kg)", async () => {
    setExerciseUnit('Barbell Squat', 'lb');
    render(<ClientTargetStrip exName="Barbell Squat" planItemId="a" assignment={assignment()} />);
    await waitFor(() => expect(screen.getByText(/264\.6 lb/)).toBeTruthy()); // 120 kg
    expect(screen.queryByText(/120 kg/)).toBeNull();
  });
});
