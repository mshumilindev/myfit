import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { fmtKg, setLocale } from '../i18n';
import { en } from '../i18n/en';
import { buildRecap, recapRefFromId } from '../recaps';
import { __getStateForTests, latestWeight } from '../store';
import { emptyState, freezeClock, NOW, richState, seed, setDesktop } from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({ draw: vi.fn(), blob: vi.fn() }));
vi.mock('../data/shareCard', async (orig) => ({
  ...(await orig<typeof import('../data/shareCard')>()),
  drawRecapCard: (...a: unknown[]) => m.draw(...a),
  cardBlob: (...a: unknown[]) => m.blob(...a),
}));

import { periodShort, periodTitle, periodWord, RecapStory, RecapView } from './RecapView';

const recapOf = (id: string) => {
  const s = __getStateForTests();
  return buildRecap(
    recapRefFromId(id)!,
    s.workouts,
    s.activities,
    s.goals,
    latestWeight(s.bodyMetrics)?.weight ?? null,
  );
};
const view = (period: string, desktop?: boolean) => {
  const onClose = vi.fn();
  const onStory = vi.fn();
  const out = render(
    <RecapView period={period} onClose={onClose} onStory={onStory} desktop={desktop} />,
  );
  return { ...out, onClose, onStory };
};
const txt = (sel: string) => [...document.querySelectorAll(sel)].map((e) => e.textContent);
const dl = (label: string) => screen.getByRole('button', { name: label });

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  setDesktop(false);
  m.draw.mockReset().mockResolvedValue(undefined);
  m.blob.mockReset().mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('period helpers', () => {
  it('title, short name and word per kind', () => {
    const month = recapRefFromId('2026-M8')!;
    expect(periodTitle(month, 'en')).toBe('September 2026');
    expect(periodShort(month, 'en')).toBe('September');
    expect(periodWord(month, en)).toBe(en.rcPeriodMonth);
    const q = recapRefFromId('2026-Q3')!;
    expect(periodTitle(q, 'en')).toBe('Q3 2026');
    expect(periodShort(q, 'en')).toBe('Q3 2026');
    expect(periodWord(q, en)).toBe(en.rcPeriodQuarter);
    const y = recapRefFromId('2026-Y')!;
    expect(periodTitle(y, 'en')).toBe('2026');
    expect(periodShort(y, 'en')).toBe('2026');
    expect(periodWord(y, en)).toBe(en.rcPeriodYear);
  });

  it('month names follow the locale', () => {
    expect(periodTitle(recapRefFromId('2026-M8')!, 'pl')).toMatch(/wrze/);
  });
});

describe('RecapView: a closed month with a previous month to compare', () => {
  it('shows kind, title, headline and how often you showed up', () => {
    const r = recapOf('2026-M7');
    expect(r.headline).toBe('highestVolume');
    view('2026-M7');
    expect(document.querySelector('.rc-hero-band .rc-lbl')?.textContent).toBe(en.rcKindMonth);
    expect(document.querySelector('.rc-fs-34')?.textContent).toBe('August 2026');
    expect(document.querySelector('.rc-hero-band .ut-accent-hi')?.textContent).toBe(
      en.rcHlHighestVolume(en.rcPeriodMonth),
    );
    expect(screen.getByText(en.rcShowedUp(r.sessions))).toBeTruthy();
  });

  it('the four totals carry their values and signed percent deltas', () => {
    const r = recapOf('2026-M7');
    view('2026-M7');
    const stats = [...document.querySelectorAll('.rc-stat')];
    expect(stats).toHaveLength(4);
    expect(stats[0].querySelector('.rc-stat-n')?.textContent).toBe(String(r.sessions));
    expect(stats[1].querySelector('.rc-stat-n')?.textContent).toBe(
      `${Math.round(r.volumeKg / 1000)} t`,
    );
    expect(stats[1].textContent).toContain(`${Math.round(r.volumeKg).toLocaleString('en')} kg`);
    expect(stats[2].querySelector('.rc-stat-n')?.textContent).toBe(`${r.timeHours.toFixed(1)} h`);
    expect(stats[3].querySelector('.rc-stat-n')?.textContent).toBe(String(r.sets));
    expect(stats[3].textContent).toContain(en.rcSetsReps(r.reps.toLocaleString('en')));
    expect(stats[0].querySelector('.rc-num.rc-up')?.textContent).toBe(
      `+${Math.round(r.d.sessions! * 100)}%`,
    );
    expect(stats[0].querySelector('.rc-up')).toBeTruthy();
  });

  it('a drop versus the previous month shows a minus sign and the down style', () => {
    const r = recapOf('2026-M8');
    expect(r.d.sessions!).toBeLessThan(0);
    view('2026-M8');
    const delta = document.querySelector('.rc-stat .rc-delta .rc-num')!;
    expect(delta.textContent).toBe(`−${Math.abs(Math.round(r.d.sessions! * 100))}%`);
    expect(delta.className).toContain('rc-dn');
  });

  it('shows the calorie burn rounded and localised', () => {
    const r = recapOf('2026-M7');
    view('2026-M7');
    expect(document.querySelector('.rc-cal .rc-fs-28')?.textContent).toBe(
      `${Math.round(r.calories).toLocaleString('en')} ${en.rcKcal}`,
    );
    expect(screen.getByText(en.rcCalBurn)).toBeTruthy();
  });

  it('lists up to three records with the estimated 1RM, then heaviest set and biggest session', () => {
    const r = recapOf('2026-M7');
    view('2026-M7');
    const rows = document.querySelectorAll('.rc-rec-row');
    expect(rows.length).toBe(Math.min(3, r.records.length));
    expect(screen.getByText(en.rcNewRecords)).toBeTruthy();
    expect(document.querySelector('.rc-card.gold .rc-fs-22')?.textContent).toBe(String(r.prCount));
    expect(rows[0].textContent).toContain(en.rcEst1rm(fmtKg(r.records[0].e1rm)));
    expect(rows[0].textContent).toContain(fmtKg(r.records[0].weightKg));
    const minis = [...document.querySelectorAll('.rc-mini')];
    expect(minis).toHaveLength(2);
    expect(minis[0].textContent).toContain(en.rcHeaviestSet);
    expect(minis[0].textContent).toContain(r.heaviestSet!.name);
    expect(minis[1].textContent).toContain(en.rcBiggestSession);
    expect(minis[1].textContent).toMatch(/\d+(\.\d)? t/);
  });

  it('muscle distribution: up to four muscles with percent, plus the least-trained hint', () => {
    const r = recapOf('2026-M7');
    view('2026-M7');
    expect(screen.getByText(en.rcMuscleDist)).toBeTruthy();
    const card = screen.getByText(en.rcMuscleDist).closest('.rc-card') as HTMLElement;
    const rows = [...card.querySelectorAll('.uj-between')];
    expect(rows.map((x) => x.firstElementChild?.textContent)).toEqual(
      r.muscles.slice(0, 4).map((x) => en.muscleGroups[x.group]),
    );
    expect(rows.map((x) => x.querySelector('.rc-num')?.textContent)).toEqual(
      r.muscles.slice(0, 4).map((x) => `${x.pct}%`),
    );
    const bars = [...document.querySelectorAll('.rc-rank i')] as HTMLElement[];
    expect(bars[0].style.width).toBe('100%');
    if (r.leastMuscle)
      expect(screen.getByText(en.rcLeastHint(en.muscleGroups[r.leastMuscle]))).toBeTruthy();
  });

  it('consistency: training days, longest streak, perfect weeks and the weekday dots', () => {
    const r = recapOf('2026-M7');
    view('2026-M7');
    const cons = screen.getByText(en.rcConsistency).closest('.rc-card') as HTMLElement;
    expect(within(cons).getByText(en.rcTrainingDays).previousElementSibling?.textContent).toBe(
      String(r.trainingDays),
    );
    expect(within(cons).getByText(en.rcLongestStreak).previousElementSibling?.textContent).toBe(
      String(r.longestStreak),
    );
    expect(within(cons).getByText(en.rcPerfectWeeks).previousElementSibling?.textContent).toBe(
      `${r.perfectWeeks}/${r.weeksInPeriod}`,
    );
    expect(cons.querySelectorAll('.rc-dot7')).toHaveLength(7);
    expect(cons.querySelectorAll('.rc-dot7.on')).toHaveLength(r.weekdayMask.filter(Boolean).length);
  });

  it('a month shows weekly trend bars with one peak; labels are week labels', () => {
    const r = recapOf('2026-M7');
    view('2026-M7');
    expect(screen.getByText(en.rcVolTrendWeek)).toBeTruthy();
    const bars = [...document.querySelectorAll('.rc-trendbars .rc-bar')];
    expect(bars).toHaveLength(r.trend.length);
    expect(document.querySelectorAll('.rc-bar.peak')).toHaveLength(
      r.trend.filter((b) => b.peak).length,
    );
    const tallest = bars.map((b) =>
      parseFloat((b.querySelector('span') as HTMLElement).style.height),
    );
    expect(Math.max(...tallest)).toBe(100);
    expect(Math.min(...tallest)).toBeGreaterThanOrEqual(6);
  });

  it('shows goal progress with the archetype and which focus muscles were hit', () => {
    const r = recapOf('2026-M7');
    view('2026-M7');
    expect(screen.getByText(en.rcTowardGoal)).toBeTruthy();
    expect(document.querySelector('.rc-ring')?.getAttribute('style')).toContain(
      `${r.goal!.adherencePct}%`,
    );
    expect(
      screen.getByText(`${en.archetypes[r.goal!.archetype!].name} · ${en.rcBlockFocusSuffix}`),
    ).toBeTruthy();
    const tags = txt('.ul-wrap .ui-tag, .ul-wrap > *');
    expect(tags.length).toBe(Math.min(5, r.goal!.hits.length));
    r.goal!.hits.forEach((h, i) => expect(tags[i]!.endsWith('✓')).toBe(h.ok));
  });

  it('the "alongside" card shows recovery and conditioning minutes only when there are any', () => {
    const r = recapOf('2026-M7');
    view('2026-M7');
    if (r.recoveryMin > 0 || r.conditioningMin > 0) {
      const card = screen.getByText(en.rcAlongside).closest('.rc-card') as HTMLElement;
      expect(within(card).getByText(en.rcRecovery).previousElementSibling?.textContent).toContain(
        String(r.recoveryMin),
      );
      expect(
        within(card).getByText(en.rcConditioning).previousElementSibling?.textContent,
      ).toContain(String(r.conditioningMin));
    } else {
      expect(screen.queryByText(en.rcAlongside)).toBeNull();
    }
  });
});

describe('RecapView: first period and empty period', () => {
  it('a period with nothing before it says "first period" instead of deltas', () => {
    view('2026-Q3');
    expect(screen.getAllByText(en.rcFirstPeriodDelta)).toHaveLength(5);
    expect(document.querySelector('.rc-delta')).toBeNull();
    expect(document.querySelector('.rc-hero-band .ut-accent-hi')?.textContent).toBe(
      en.rcHlFirst(en.rcPeriodQuarter),
    );
    expect(document.querySelector('.rc-fs-34')?.textContent).toBe('Q3 2026');
    expect(screen.getByText(en.rcVolTrendMonth)).toBeTruthy();
    expect([...document.querySelectorAll('.rc-bar small')].map((s) => s.textContent)).toEqual(
      recapOf('2026-Q3').trend.map(
        (b) =>
          b.label ?? new Date(2026, b.month ?? 0, 1).toLocaleDateString('en', { month: 'short' }),
      ),
    );
  });

  it('a year recap names the year and uses monthly bars', () => {
    view('2026-Y');
    expect(document.querySelector('.rc-fs-34')?.textContent).toBe('2026');
    expect(document.querySelector('.rc-hero-band .rc-lbl')?.textContent).toBe(en.rcKindYear);
    expect(screen.getByText(en.rcShareYours('2026'))).toBeTruthy();
  });

  it('an empty period still renders totals of zero and no records, muscles or activity cards', () => {
    view('2025-M1');
    expect(document.querySelector('.rc-stat .rc-stat-n')?.textContent).toBe('0');
    expect(screen.queryByText(en.rcNewRecords)).toBeNull();
    expect(screen.queryByText(en.rcMuscleDist)).toBeNull();
    expect(screen.queryByText(en.rcAlongside)).toBeNull();
    expect(screen.getAllByText(en.rcHlFirst(en.rcPeriodMonth))).toHaveLength(2);
  });

  it('with no goal set the goal card is omitted', () => {
    seed({ ...richState(), goals: {} });
    view('2026-M7');
    expect(screen.queryByText(en.rcTowardGoal)).toBeNull();
  });

  it('an unknown period renders nothing', () => {
    const { container } = view('not-a-period');
    expect(container.innerHTML).toBe('');
  });

  it('a brand-new user (no workouts) can still open a recap', () => {
    seed(emptyState());
    view('2026-M8');
    expect(document.querySelector('.rc-stat .rc-stat-n')?.textContent).toBe('0');
  });
});

describe('RecapView: actions and layout', () => {
  it('back, story and share buttons in the header', () => {
    const { onClose, onStory } = view('2026-M7');
    fireEvent.click(dl(en.backAction));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(dl(en.rcPlayStory));
    expect(onStory).toHaveBeenCalledTimes(1);
    fireEvent.click(dl(en.rcShare));
    expect(document.querySelector('.share-sheet')).toBeTruthy();
  });

  it('the closing card repeats the headline and offers share and story', () => {
    const { onStory } = view('2026-M7');
    const closing = screen.getByText(en.rcWatchSave).closest('.rc-card') as HTMLElement;
    expect(closing.textContent).toContain(en.rcHlHighestVolume(en.rcPeriodMonth));
    fireEvent.click(screen.getByText(en.rcWatchSave));
    expect(onStory).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText(en.rcShareYours('August')));
    expect(document.querySelector('.share-sheet')).toBeTruthy();
  });

  it('desktop layout makes the totals span two columns', () => {
    view('2026-M7', true);
    expect(document.querySelector('.rc-view.desktop')).toBeTruthy();
    expect(document.querySelector('.rc-span2')).toBeTruthy();
  });

  it('phone layout has neither', () => {
    view('2026-M7');
    expect(document.querySelector('.rc-view.desktop')).toBeNull();
    expect(document.querySelector('.rc-span2')).toBeNull();
  });
});

describe('Recap share sheet', () => {
  const openSheet = () => {
    const out = view('2026-M7');
    fireEvent.click(dl(en.rcShare));
    return out;
  };

  it('draws the card for the period in story format on a phone and redraws on format change', async () => {
    openSheet();
    await waitFor(() => expect(m.draw).toHaveBeenCalled());
    const [canvas, model, format] = m.draw.mock.calls[0];
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(format).toBe('story');
    const r = recapOf('2026-M7');
    expect(model).toMatchObject({
      brand: 'Spotter',
      kicker: en.rcKindMonth,
      period: 'August 2026',
      headline: en.rcHlHighestVolume(en.rcPeriodMonth),
      handle: 'spotter.app',
    });
    expect(model.stats).toEqual([
      { value: String(r.sessions), label: en.rcSessions },
      { value: `${Math.round(r.volumeKg / 1000)} t`, label: en.rcVolShort },
      { value: String(r.prCount), label: 'PRs' },
    ]);
    expect(model.muscles).toHaveLength(3);
    expect(model.record.name).toBe(r.records[0].name);
    expect(model.kcal).toBe(`${Math.round(r.calories).toLocaleString('en')} ${en.rcKcal}`);
    fireEvent.click(screen.getByText(en.shareFormatSquare));
    await waitFor(() => expect(m.draw.mock.calls.at(-1)![2]).toBe('square'));
    expect(document.querySelector('.share-preview.square')).toBeTruthy();
  });

  it('a recap without a kcal figure or a record sends null for them', async () => {
    seed({ ...richState(), workouts: [], activities: [] });
    view('2026-M7');
    fireEvent.click(dl(en.rcShare));
    await waitFor(() => expect(m.draw).toHaveBeenCalled());
    expect(m.draw.mock.calls[0][1]).toMatchObject({ kcal: null, record: null, muscles: [] });
  });

  it('on a phone the primary button shares the file natively when the browser can', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    openSheet();
    await act(async () => {
      fireEvent.click(screen.getByText(en.shareToStories));
    });
    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0][0];
    expect(arg.title).toBe('August 2026');
    expect(arg.files[0].name).toBe('spotter-2026-M7.png');
    expect(arg.files[0].type).toBe('image/png');
  });

  it('and falls back to a download when native sharing of files is unavailable', async () => {
    Object.assign(navigator, { share: undefined, canShare: undefined });
    const created = vi.fn(() => 'blob:x');
    const revoked = vi.fn();
    URL.createObjectURL = created;
    URL.revokeObjectURL = revoked;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    openSheet();
    await act(async () => {
      fireEvent.click(screen.getByText(en.shareToStories));
    });
    expect(created).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoked).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
  });

  it('the save-image button downloads the PNG with the period file name', async () => {
    const names: string[] = [];
    URL.createObjectURL = () => 'blob:y';
    URL.revokeObjectURL = () => undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    openSheet();
    await act(async () => {
      fireEvent.click(dl(en.shareSaveImage));
    });
    expect(names).toEqual(['spotter-2026-M7.png']);
    click.mockRestore();
  });

  it('a cancelled native share is swallowed and the buttons come back', async () => {
    Object.assign(navigator, {
      share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')),
      canShare: () => true,
    });
    openSheet();
    await act(async () => {
      fireEvent.click(screen.getByText(en.shareToStories));
    });
    expect(
      (screen.getByText(en.shareToStories).closest('button') as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('copy writes the image to the clipboard, flips to "copied" and resets after 1.6 s', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { write } });
    (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = class {
      constructor(public items: unknown) {}
    };
    openSheet();
    await act(async () => {
      fireEvent.click(dl(en.shareCopy));
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(dl(en.shareCopied)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1700);
    });
    expect(dl(en.shareCopy)).toBeTruthy();
  });

  it('copy without clipboard image support downloads instead', async () => {
    Object.assign(navigator, { clipboard: undefined });
    (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = undefined;
    URL.createObjectURL = () => 'blob:z';
    URL.revokeObjectURL = () => undefined;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    openSheet();
    await act(async () => {
      fireEvent.click(dl(en.shareCopy));
    });
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('when the canvas yields no blob nothing is shared', async () => {
    m.blob.mockResolvedValue(null);
    const share = vi.fn();
    Object.assign(navigator, { share, canShare: () => true });
    openSheet();
    await act(async () => {
      fireEvent.click(screen.getByText(en.shareToStories));
    });
    expect(share).not.toHaveBeenCalled();
  });

  it('desktop shows a download button (and no phone-only save icon) and defaults to square', async () => {
    setDesktop(true);
    openSheet();
    expect(screen.getByText(en.shareDownload)).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.shareSaveImage })).toBeNull();
    expect(screen.queryByText(en.shareToStories)).toBeNull();
    await waitFor(() => expect(m.draw.mock.calls[0][2]).toBe('square'));
  });

  it('Escape closes the sheet', async () => {
    openSheet();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('.share-sheet')).toBeNull());
  });
});

describe('RecapStory', () => {
  const story = (period = '2026-M7') => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const onClose = vi.fn();
    const out = render(<RecapStory period={period} onClose={onClose} />);
    return { ...out, onClose };
  };
  const panel = () => document.querySelector('.rc-story-panel') as HTMLElement;
  const bars = () =>
    [...document.querySelectorAll('.rc-progress b')].map((b) => (b as HTMLElement).style.width);
  const tap = (side: 'left' | 'right') => {
    const p = panel();
    p.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
    fireEvent.click(p, { clientX: side === 'left' ? 20 : 250 });
  };

  it('opens on the title panel with one progress segment per panel', () => {
    story();
    expect(screen.getByText(en.rcWrapped('August'))).toBeTruthy();
    expect(document.querySelector('.rc-fs-48')?.textContent).toBe('August 2026');
    expect(bars()).toHaveLength(5);
    expect(document.querySelector('.rc-story')?.getAttribute('style')).toContain('--rc-replay');
  });

  it('auto-advances after 5.2 s, filling the finished segments', async () => {
    story();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5400);
    });
    expect(screen.getByText(en.rcYouMovedIn('August'))).toBeTruthy();
    expect(bars()[0]).toBe('100%');
    expect(bars()[2]).toBe('0%');
    expect(document.querySelector('.rc-story')?.getAttribute('style')).toContain('--rc-wash-cool');
  });

  it('the totals panel shows volume in tonnes, sessions, hours and kilo-calories', async () => {
    const r = recapOf('2026-M7');
    story();
    tap('right');
    expect(document.querySelector('.rc-fs-76')?.textContent).toBe(
      `${Math.round(r.volumeKg / 1000)} t`,
    );
    expect(
      screen.getByText(
        en.rcAcrossSets(`${Math.round(r.volumeKg).toLocaleString('en')} kg`, r.sets),
      ),
    ).toBeTruthy();
    expect(screen.getByText(String(r.sessions))).toBeTruthy();
    expect(
      [...document.querySelectorAll('.rc-story-center .rc-num.ut-hero')].map((e) => e.textContent),
    ).toEqual([
      String(r.sessions),
      `${r.timeHours.toFixed(1)}h`,
      `${(r.calories / 1000).toFixed(1)}k`,
    ]);
  });

  it('tapping the right side goes forward and the left side goes back, never below the first', () => {
    story();
    tap('left');
    expect(screen.getByText(en.rcWrapped('August'))).toBeTruthy();
    tap('right');
    expect(screen.getByText(en.rcYouMovedIn('August'))).toBeTruthy();
    tap('right');
    expect(screen.getByText(en.rcYouSetRecords(recapOf('2026-M7').prCount))).toBeTruthy();
    tap('left');
    expect(screen.getByText(en.rcYouMovedIn('August'))).toBeTruthy();
  });

  it('the records panel numbers the top three; the muscles panel names the two leading groups', () => {
    const r = recapOf('2026-M7');
    story();
    tap('right');
    tap('right');
    expect(
      [...document.querySelectorAll('.rc-story-center .rc-num.ut-lg')].map((e) => e.textContent),
    ).toEqual(['01', '02', '03']);
    tap('right');
    expect(
      screen.getByText(
        en.rcMuscleLed(en.muscleGroups[r.muscles[0].group], en.muscleGroups[r.muscles[1].group]),
      ),
    ).toBeTruthy();
    expect(document.querySelectorAll('.rc-rank i')).toHaveLength(3);
  });

  it('the last panel is the share card; it holds instead of closing and Share opens the sheet', async () => {
    const { onClose } = story();
    tap('right');
    tap('right');
    tap('right');
    tap('right');
    expect(screen.getByText('spotter')).toBeTruthy();
    expect(bars().every((w) => w === '100%')).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(en.rcTopRecord)).toBeTruthy();
    fireEvent.click(screen.getByText(en.rcShareCard));
    expect(document.querySelector('.share-sheet')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('tapping forward on the last panel closes the story', () => {
    const { onClose } = story();
    for (let i = 0; i < 5; i++) tap('right');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the close button closes', () => {
    const { onClose } = story();
    fireEvent.click(dl(en.backAction));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('holding the panel pauses the timer; releasing resumes it', async () => {
    story();
    const root = document.querySelector('.rc-story') as HTMLElement;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    fireEvent.pointerDown(root);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(screen.getByText(en.rcWrapped('August'))).toBeTruthy();
    fireEvent.pointerUp(root);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3400);
    });
    expect(screen.getByText(en.rcYouMovedIn('August'))).toBeTruthy();
    fireEvent.pointerDown(root);
    fireEvent.pointerLeave(root);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5400);
    });
    expect(screen.getByText(en.rcYouSetRecords(recapOf('2026-M7').prCount))).toBeTruthy();
  });

  it('the timer waits while the share sheet is open', async () => {
    story();
    tap('right');
    tap('right');
    tap('right');
    tap('right');
    fireEvent.click(screen.getByText(en.rcShareCard));
    fireEvent.keyDown(document, { key: 'Escape' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByText('spotter')).toBeTruthy();
  });

  it('a period without records or muscles has a shorter story', () => {
    seed({ ...richState(), workouts: [], activities: [] });
    story('2026-M7');
    expect(bars()).toHaveLength(3);
  });

  it('an unknown period renders nothing', () => {
    const { container } = story('bogus');
    expect(container.innerHTML).toBe('');
  });
});
