import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AtlasClientsBlock } from './AtlasClientsBlock';
import { CORE_DEFAULTS } from './layout';
import { trainerFromReply, type MyTrainer } from './myTrainer';

let mockTrainer: MyTrainer | null = null;
vi.mock('./myTrainer', async (orig) => ({
  ...(await orig<typeof import('./myTrainer')>()),
  useMyTrainer: () => mockTrainer,
}));
vi.mock('./clientRoster', () => ({ useClientRoster: () => null }));

const TRAINER: MyTrainer = { id: 't1', name: 'Olena Koval', avatar: false };

function view(atlasView: 'compact' | 'auto' | 'note') {
  return render(
    <AtlasClientsBlock
      opts={{ ...CORE_DEFAULTS.atlas, atlasView }}
      withClients={false}
      onOpenCoach={() => undefined}
      onOpenClient={() => undefined}
      onWatch={() => undefined}
      onAllClients={() => undefined}
    />,
  );
}

afterEach(() => {
  cleanup();
  mockTrainer = null;
});

describe('Atlas block — my trainer', () => {
  it('without a trainer renders exactly the old block', () => {
    const { container } = view('compact');
    expect(container.querySelector('.tac-duo-tile')).toBeNull();
    expect(container.querySelector('.tac-solo')).not.toBeNull();
  });

  it('compact view with a trainer is the two-up Atlas | Trainer row', () => {
    mockTrainer = TRAINER;
    const { container } = view('compact');
    expect(container.querySelectorAll('.tac-duo .tac-duo-tile')).toHaveLength(2);
    expect(container.querySelector('.tac-solo')).toBeNull();
    expect(screen.getByText('Olena Koval')).toBeTruthy();
  });

  it('shows the trainer tile alone when Atlas is auto-hidden', () => {
    mockTrainer = TRAINER;
    const { container } = view('auto');
    expect(container.querySelectorAll('.tac-duo-tile')).toHaveLength(1);
    expect(container.querySelector('.tac-trainer')).not.toBeNull();
  });
});

describe('trainerFromReply', () => {
  it('prefers `trainer`, honours null, falls back to the access list', () => {
    expect(trainerFromReply({ trainer: TRAINER })).toEqual(TRAINER);
    expect(
      trainerFromReply({ trainer: null, access: [{ id: 'x', name: 'X', role: 'trainer' }] }),
    ).toBeNull();
    expect(trainerFromReply({ access: [{ id: 'x', name: 'X', role: 'trainer' }] })?.id).toBe('x');
    expect(trainerFromReply({ access: [{ id: 'a', name: 'A', role: 'admin' }] })).toBeNull();
  });
});
