import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { defaultSupplementSettings, newSupplementEntry } from '../../supplements';
import { SUPPLEMENT_SOURCES } from '../../supplementCatalog';
import type { SupplementEntry, SupplementId } from '../../types';
import { emptyState, seed } from '../__fixtures__/viewKit';
import { SupplementsCard, SupplementsHowSheet } from './SupplementsCard';
import type { SupplementCardModel } from './supplementCardModel';

const T0 = new Date(2026, 8, 1, 10).getTime();
const ent = (id: SupplementId): SupplementEntry => newSupplementEntry(id, `e-${id}`, T0);
const hold = (entries: SupplementEntry[]) =>
  seed({
    ...emptyState(),
    supplements: {
      entries,
      checkins: {},
      settings: { ...defaultSupplementSettings(), useInCalculations: true },
      updatedAt: 1,
    },
  });
const model = (over: Partial<SupplementCardModel>): SupplementCardModel =>
  ({ strengthPct: null, weightKg: null, rpe: null, ...over }) as SupplementCardModel;

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('SupplementsHowSheet', () => {
  it('names nothing and has no settings button when nothing is saved and no link was given', () => {
    hold([]);
    render(<SupplementsHowSheet onClose={() => undefined} />);
    expect(screen.getByText(en.nicFxHowTitle)).toBeTruthy();
    expect(screen.queryByText(en.supFxTitle)).toBeNull();
    expect(screen.queryByRole('button', { name: /Use in calculations/ })).toBeNull();
    expect(screen.queryByText(SUPPLEMENT_SOURCES.creatine.cite)).toBeNull();
  });

  it('lists the sources behind the lines on the card: creatine for strength or weight, caffeine for effort', () => {
    hold([]);
    const { rerender } = render(
      <SupplementsHowSheet
        onClose={() => undefined}
        model={model({ strengthPct: { low: 0, high: 3 } as never })}
      />,
    );
    expect(screen.getByText(SUPPLEMENT_SOURCES.creatine.cite)).toBeTruthy();
    expect(screen.queryByText(SUPPLEMENT_SOURCES.caffeine.cite)).toBeNull();
    rerender(
      <SupplementsHowSheet
        onClose={() => undefined}
        model={model({ weightKg: { low: 0.5, high: 2 } as never })}
      />,
    );
    expect(screen.getByText(SUPPLEMENT_SOURCES.creatine.cite)).toBeTruthy();
    rerender(
      <SupplementsHowSheet
        onClose={() => undefined}
        model={model({ rpe: { low: 0.2, high: 0.5 } as never })}
      />,
    );
    expect(screen.getByText(SUPPLEMENT_SOURCES.caffeine.cite)).toBeTruthy();
    expect(screen.queryByText(SUPPLEMENT_SOURCES.creatine.cite)).toBeNull();
  });

  it('adds the source of every item the person takes, and flags an unverified one as approximate', () => {
    hold([ent('melatonin'), ent('vitaminD')]);
    render(<SupplementsHowSheet onClose={() => undefined} model={null} />);
    expect(
      screen.getByText(`${SUPPLEMENT_SOURCES.melatonin.cite} (${en.nicSrcApprox})`),
    ).toBeTruthy();
    expect(screen.getByText(SUPPLEMENT_SOURCES.vitaminD.cite)).toBeTruthy();
    expect(screen.getByText(en.supFxTitle)).toBeTruthy();
  });

  it('closes with Escape', async () => {
    hold([]);
    const onClose = vi.fn();
    render(<SupplementsHowSheet onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('SupplementsCard: the "How is this estimated?" sheet', () => {
  const wo = {
    id: 'w',
    startedAt: new Date(2026, 9, 7, 18).getTime(),
    finishedAt: new Date(2026, 9, 7, 19).getTime(),
    autoFinished: false,
    gymId: null,
    exercises: [],
  } as never;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 7, 19, 30).getTime());
  });
  afterEach(() => vi.useRealTimers());

  const open = () =>
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(en.nicFxHow.replace('?', '\\?')) }),
    );
  const creatine = () => hold([ent('creatine')]);

  it('without a settings link the sheet has no button; Escape closes it', async () => {
    creatine();
    render(<SupplementsCard workout={wo} />);
    open();
    expect(screen.getByText(en.supFxDisclaimer)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Use in calculations/ })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByText(en.supFxDisclaimer)).toBeNull());
  });

  it('with a link, its button closes the sheet and then opens the settings', async () => {
    creatine();
    const settings = vi.fn();
    render(<SupplementsCard workout={wo} onOpenSettings={settings} />);
    open();
    await act(
      async () => void fireEvent.click(screen.getByRole('button', { name: /Use in calculations/ })),
    );
    expect(settings).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(screen.queryByText(en.supFxDisclaimer)).toBeNull());
  });
});
