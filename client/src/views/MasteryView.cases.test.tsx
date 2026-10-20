import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { computeMastery, MASTERY_RANKS, sublevelRoman } from '../mastery';
import { __getStateForTests } from '../store';
import { emptyState, freezeClock, makeShell, NOW, richState, seed } from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  setMasteryHistory: (...a: unknown[]) => m.history(...a),
}));

import { MasteryBadge, MasteryRankUp, MasteryView } from './MasteryView';

const compute = () => {
  const s = __getStateForTests();
  return computeMastery(s, Date.now(), {
    trainingSinceYear: s.mastery.sinceYear,
    trainingPattern: s.mastery.pattern,
  });
};
const open = () => {
  const onClose = vi.fn();
  const out = render(<MasteryView shell={makeShell()} onClose={onClose} />);
  return { ...out, onClose };
};
const back = () => fireEvent.click(screen.getByRole('button', { name: en.backAction }));
const tiles = () => [...document.querySelectorAll('.mst-tile')] as HTMLElement[];

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  m.history.mockReset();
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('MasteryView: detail', () => {
  it('shows the rating, the rank with its sublevel and the four-axis balance', () => {
    const r = compute();
    expect(r.calibrating).toBe(false);
    open();
    expect(document.querySelector('.mst-hero-num')?.textContent).toBe(String(r.rating));
    expect(document.querySelector('.mst-rank-name')?.textContent).toBe(en.masteryRank[r.rank.id]);
    expect(document.querySelector('.mst-rank-line .rn')?.textContent).toBe(
      sublevelRoman(r.sublevel),
    );
    const rows = [...document.querySelectorAll('.mst-bal-row')];
    expect(rows).toHaveLength(4);
    expect(rows.map((x) => x.querySelector('.mst-bal-num')?.textContent)).toEqual([
      String(r.axes.strength.score),
      String(r.axes.consistency.score),
      String(r.axes.experience.score),
      String(r.axes.practice.score),
    ]);
    expect(rows[0].textContent).toContain(en.masteryAxis.strength);
  });

  it('tells how far the next sublevel is, or the rank meaning at the top', () => {
    const r = compute();
    open();
    if (r.nextRank)
      expect(document.querySelector('.mst-rank-meaning')?.textContent).toContain(
        String(r.toNextSublevel),
      );
    else
      expect(document.querySelector('.mst-rank-meaning')?.textContent).toBe(
        en.masteryRankMeaning[r.rank.id],
      );
  });

  it('the strength, consistency and experience tiles read from the facts', () => {
    const r = compute();
    open();
    const [str, con, exp] = tiles();
    expect(str.textContent).toContain(`${r.axes.strength.score}/100`);
    expect(str.textContent).toContain(en.masteryRelativeToYou);
    expect(con.textContent).toContain(
      en.masteryConsistencyRead(
        Number(r.axes.consistency.facts.perWeek ?? 0),
        Number(r.axes.consistency.facts.activeWeeks ?? 0),
      ),
    );
    expect(exp.textContent).toContain(
      en.masteryExperienceRead(Number(r.axes.experience.facts.years ?? 0)),
    );
    expect(exp.textContent).toContain(en.masteryAppMeasured);
  });

  it('the back arrow closes the screen from the detail page', () => {
    const { onClose } = open();
    back();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates to the shortfalls and back', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByText(en.masterySeeShortfall));
    expect(screen.getByText(en.masteryShortfall)).toBeTruthy();
    expect(screen.getByText(en.masteryShortfallIntro)).toBeTruthy();
    expect(document.querySelector('.mst-sf-below .num')?.textContent).toBe(
      String(compute().toNextSublevel),
    );
    back();
    expect(screen.getByText(en.masteryBalanceTitle)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lists each shortfall with its fix, source and impact', () => {
    const r = compute();
    open();
    fireEvent.click(screen.getByText(en.masterySeeShortfall));
    const rows = [...document.querySelectorAll('.mst-sf-row')];
    expect(rows).toHaveLength(r.shortfalls.length);
    r.shortfalls.forEach((sf, i) => {
      expect(rows[i].querySelector('.mst-sf-title')?.textContent).toBe(
        en.masteryFix[sf.signal ?? sf.axis],
      );
      expect(rows[i].querySelector('.mst-imp')?.textContent).toBe(en.masteryImpact[sf.impact]);
      const sub = rows[i].querySelector('.mst-sf-sub')?.textContent;
      expect(sub).toContain(en.masteryAxis[sf.axis]);
      if (sf.signal) expect(sub).toContain(en.masterySignal[sf.signal]);
    });
  });

  it('shows the ladder with done, current and locked rungs', () => {
    const r = compute();
    open();
    fireEvent.click(screen.getByText(en.masterySeeRanks));
    const rungs = [...document.querySelectorAll('.mst-rung')];
    expect(rungs).toHaveLength(MASTERY_RANKS.length);
    // top rank first
    expect(rungs[0].querySelector('.mst-rung-name')?.textContent).toBe(
      en.masteryRank[MASTERY_RANKS[MASTERY_RANKS.length - 1].id],
    );
    const cur = document.querySelector('.mst-rung.current')!;
    expect(cur.textContent).toContain(en.masteryYouAreHere);
    expect(cur.querySelector('.mst-rung-name')?.textContent).toBe(en.masteryRank[r.rank.id]);
    expect(cur.querySelectorAll('.mst-pips .on')).toHaveLength(r.sublevel);
    expect(cur.querySelector('.mst-rung-thr')?.textContent).toBe(String(r.rating));
    const done = document.querySelectorAll('.mst-rung.done').length;
    const locked = document.querySelectorAll('.mst-rung.locked').length;
    expect(done).toBe(r.rankIndex);
    expect(locked).toBe(MASTERY_RANKS.length - 1 - r.rankIndex);
    const lockedThr = [...document.querySelectorAll('.mst-rung.locked .mst-rung-thr')].map(
      (x) => x.textContent,
    );
    lockedThr.forEach((x) => expect(Number(x)).toBeGreaterThan(r.rating - 1));
    back();
    expect(screen.getByText(en.masteryBalanceTitle)).toBeTruthy();
  });

  it('opens the practice-signal sheet with one row per signal', () => {
    const r = compute();
    open();
    fireEvent.click(screen.getByText(en.masteryPracticeSignals));
    const sheet = document.querySelector('.mst-practice-sheet') as HTMLElement;
    expect(sheet).toBeTruthy();
    const rows = sheet.querySelectorAll('.mst-ps-row');
    expect(rows).toHaveLength(r.practice.length);
    r.practice.forEach((sig, i) => {
      expect(rows[i].querySelector('.mst-ps-name')?.textContent).toBe(en.masterySignal[sig.key]);
      expect(rows[i].querySelector('.mst-st')?.textContent).toBe(en.masteryStatus[sig.status]);
      expect(rows[i].querySelector('.mst-ps-read')?.textContent?.length).toBeGreaterThan(0);
    });
    expect(within(sheet).getByText(`${r.axes.practice.score}/100`)).toBeTruthy();
  });

  it('explains each practice signal in words for a well-rounded history', () => {
    open();
    fireEvent.click(screen.getByText(en.masteryPracticeSignals));
    const read = (key: keyof typeof en.masterySignal) =>
      [...document.querySelectorAll('.mst-ps-row')]
        .find((r) => r.querySelector('.mst-ps-name')?.textContent === en.masterySignal[key])
        ?.querySelector('.mst-ps-read')?.textContent;
    // SPO-152: lats/traps/lower back count toward "back" coverage, so only core is skipped in this history.
    expect(read('coverage')).toBe(en.mrSkipped(en.muscleGroups.core));
    expect(read('warmup')).toBe(en.mrWarm(100));
    expect(read('cooldown')).toBe(en.mrCooldownLow);
    expect(read('cardio')).toBe(en.mrCardioOk);
    expect(read('recovery')).toBe(en.mrRecoveryOk);
    expect(read('rest')).toBe(en.mrRestOk);
    expect(read('structure')).toBe(en.mrStructureOk);
    expect(read('volume')).toContain(en.muscleGroups.triceps);
    expect(read('progression')).toContain('Barbell Bench Press');
  });

  it('explains the weak side of the signals when the history is thin', () => {
    const s = richState();
    const finished = s.workouts.filter((w) => w.finishedAt).slice(0, 12);
    seed({
      ...s,
      workouts: finished.map((w) => ({ ...w, exercises: w.exercises.slice(0, 1) })),
    });
    open();
    fireEvent.click(screen.getByText(en.masteryPracticeSignals));
    const read = (key: keyof typeof en.masterySignal) =>
      [...document.querySelectorAll('.mst-ps-row')]
        .find((r) => r.querySelector('.mst-ps-name')?.textContent === en.masterySignal[key])
        ?.querySelector('.mst-ps-read')?.textContent;
    expect(read('cardio')).toBe(en.mrCardioLow);
    expect(read('recovery')).toBe(en.mrRecoveryHard);
    expect(read('volume')).toContain(en.muscleGroups.chest);
  });

  it('the experience tile opens the calibration editor; saving stores the year and pattern', () => {
    const { onClose } = open();
    fireEvent.click(tiles()[2]);
    expect(screen.getByText(en.masteryBeenTraining)).toBeTruthy();
    // not calibrating -> no hero
    expect(screen.queryByText(en.masteryCalibTitle)).toBeNull();
    const year = new Date(NOW).getFullYear() - 1;
    expect(screen.getByText(en.masteryTrainingSince(year))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '-' }));
    fireEvent.click(screen.getByRole('button', { name: '-' }));
    expect(screen.getByText(en.masteryTrainingSince(year - 2))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText(en.masteryTrainingSince(year - 1))).toBeTruthy();
    fireEvent.click(screen.getByText(en.masteryPattern.frequent));
    fireEvent.click(screen.getByText(en.masterySave));
    expect(m.history).toHaveBeenCalledWith(year - 1, 'frequent');
    // back on the detail page, the screen is not closed
    expect(screen.getByText(en.masteryBalanceTitle)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the year stepper cannot pass the current year or go below 1960', () => {
    open();
    fireEvent.click(tiles()[2]);
    const nowYear = new Date(NOW).getFullYear();
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText(en.masteryTrainingSince(nowYear))).toBeTruthy();
    for (let i = 0; i < nowYear - 1960 + 5; i++)
      fireEvent.click(screen.getByRole('button', { name: '-' }));
    expect(screen.getByText(en.masteryTrainingSince(1960))).toBeTruthy();
  });

  it('a stored history is the starting point of the editor and marks experience self-reported', () => {
    const s = richState();
    seed({ ...s, mastery: { ...s.mastery, sinceYear: 2015, pattern: 'occasional' } });
    open();
    expect(tiles()[2].textContent).toContain(en.masterySelfReported);
    fireEvent.click(tiles()[2]);
    expect(screen.getByText(en.masteryTrainingSince(2015))).toBeTruthy();
    fireEvent.click(screen.getByText(en.masterySave));
    expect(m.history).toHaveBeenCalledWith(2015, 'occasional');
  });

  it('the back arrow in the editor goes to the detail page', () => {
    const { onClose } = open();
    fireEvent.click(tiles()[2]);
    back();
    expect(screen.getByText(en.masteryBalanceTitle)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('MasteryView: calibrating', () => {
  beforeEach(() => seed(emptyState()));

  it('opens straight on the calibration page with provisional rank and confidence', () => {
    const r = compute();
    expect(r.calibrating).toBe(true);
    open();
    expect(screen.getByText(en.masteryCalibTitle)).toBeTruthy();
    expect(screen.getByText(en.masteryCalibBody(r.sessions))).toBeTruthy();
    expect(screen.getByText(en.masteryProvisional)).toBeTruthy();
    expect(document.querySelector('.mst-calib-rank')?.textContent).toBe(
      `~ ${en.masteryRank[r.rank.id]}`,
    );
    expect(screen.getByText(en.masteryConfLevel[r.confidence])).toBeTruthy();
    expect(screen.getByText(en.masteryConfBuilds(r.sessionsToFirm))).toBeTruthy();
    const full = [...document.querySelectorAll('.mst-conf-bars i')].filter(
      (i) => (i as HTMLElement).style.width === '100%',
    );
    expect(full).toHaveLength(r.confidence === 'high' ? 3 : r.confidence === 'med' ? 2 : 1);
  });

  it('back closes the whole screen; saving the history also leaves the editor', () => {
    const { onClose } = open();
    back();
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText(en.masterySave));
    expect(m.history).toHaveBeenCalledWith(new Date(NOW).getFullYear() - 1, 'continuous');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('MasteryBadge', () => {
  it('header badge announces the rating and opens on click', () => {
    const onOpen = vi.fn();
    render(<MasteryBadge onOpen={onOpen} />);
    const r = compute();
    const b = screen.getByRole('button', { name: `${en.masteryTitle} · ${r.rating}` });
    fireEvent.click(b);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('header badge while calibrating is unlabelled by rating', () => {
    seed(emptyState());
    const onOpen = vi.fn();
    render(<MasteryBadge onOpen={onOpen} />);
    const b = screen.getByRole('button', { name: en.masteryTitle });
    expect(b.className).toContain('calib');
    fireEvent.click(b);
    expect(onOpen).toHaveBeenCalled();
  });

  it('rail variant shows the rating and, while calibrating, only the title', () => {
    const onOpen = vi.fn();
    const r = compute();
    const { unmount } = render(<MasteryBadge variant="rail" onOpen={onOpen} />);
    fireEvent.click(screen.getByLabelText(`${en.masteryTitle} · ${r.rating}`));
    expect(onOpen).toHaveBeenCalledTimes(1);
    unmount();
    seed(emptyState());
    render(<MasteryBadge variant="rail" onOpen={onOpen} />);
    expect(screen.getByLabelText(en.masteryTitle)).toBeTruthy();
    expect(document.querySelector('.mst-railbadge-ring.calib')).toBeTruthy();
  });
});

describe('MasteryRankUp', () => {
  it('names the new rank, the two strongest axes and the next focus', () => {
    const r = compute();
    const onClose = vi.fn();
    const onSeeNext = vi.fn();
    render(<MasteryRankUp m={r} onClose={onClose} onSeeNext={onSeeNext} />);
    expect(screen.getByText(en.masteryRose)).toBeTruthy();
    expect(document.querySelector('.mst-rankup-rank')?.textContent).toContain(
      en.masteryRank[r.rank.id],
    );
    const moved = [...document.querySelectorAll('.mst-rankup-moved-row')].map((x) => x.textContent);
    expect(moved).toHaveLength(2);
    const top = (['strength', 'consistency', 'experience', 'practice'] as const)
      .map((k) => r.axes[k].score)
      .sort((a, b) => b - a);
    expect(moved[0]).toContain(`· ${top[0]}`);
    expect(moved[1]).toContain(`· ${top[1]}`);
    if (r.shortfalls[0]) {
      expect(document.querySelector('.mst-rankup-next')?.textContent).toContain(
        en.masteryFix[r.shortfalls[0].signal ?? r.shortfalls[0].axis],
      );
    }
    fireEvent.click(screen.getByText(en.masterySeeNext));
    expect(onSeeNext).toHaveBeenCalledTimes(1);
  });

  it('closes by the X button or the scrim, but not by clicking the card', () => {
    const r = compute();
    const onClose = vi.fn();
    render(<MasteryRankUp m={r} onClose={onClose} onSeeNext={vi.fn()} />);
    fireEvent.click(document.querySelector('.mst-rankup-card') as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.cancel }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector('.mst-rankup-scrim') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders insignia for every tier of rank (chevrons, bars, stars, laurels)', () => {
    const r = compute();
    const out: string[] = [];
    MASTERY_RANKS.forEach((rank, i) => {
      const { container, unmount } = render(
        <MasteryRankUp
          m={{ ...r, rankIndex: i, rank, nextRank: null }}
          onClose={vi.fn()}
          onSeeNext={vi.fn()}
        />,
      );
      const svg = container.querySelector('.mst-rankup-seal svg')!;
      out.push(
        `${svg.querySelectorAll('path').length}p${svg.querySelectorAll('rect').length}r${svg.querySelectorAll('polygon').length}g`,
      );
      unmount();
    });
    // chevrons: i+1 paths; bars: rects + cap; stars: polygons; laurels from rank 7
    expect(out[0]).toBe('1p0r1g');
    expect(out[2]).toBe('3p0r1g');
    expect(out[3]).toBe('1p1r1g');
    expect(out[5]).toBe('1p3r1g');
    expect(out[6]).toBe('0p0r2g');
    expect(out[7]).toBe('2p0r3g');
    expect(MASTERY_RANKS.length).toBeGreaterThanOrEqual(9);
  });
});
