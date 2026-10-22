import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { enrichedCatalog } from '../data/equipmentCatalog';
import { localizedEquipName } from '../data/equipmentI18n';
import type { KitEvidence } from '../gymEvidence';
import type { Gym } from '../types';

const addGymKit = vi.fn();
const restoreGymKit = vi.fn();
const markGymKitNotHere = vi.fn();
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  addGymKit: (...a: unknown[]) => addGymKit(...a),
  restoreGymKit: (...a: unknown[]) => restoreGymKit(...a),
  markGymKitNotHere: (...a: unknown[]) => markGymKitNotHere(...a),
}));

import { GymKitCard, GymKitReviewSheet, GymKitTray, GymKitUndo, KitDots } from './GymKit';

const gym = { id: 'g1', name: 'Iron', lat: 0, lng: 0, radiusM: 100 } as Gym;
const withImg = enrichedCatalog().find((e) => e.image)!;
const ITEM = withImg.id;
const UNKNOWN = 'zz-unknown-item';
const ev = (itemId: string, over: Partial<KitEvidence> = {}): KitEvidence => ({
  itemId,
  cls: 'barbell',
  sessions: 3,
  lastAt: 1,
  lifts: ['Squat', 'Deadlift', 'Row'],
  used: [true, false, true],
  medium: true,
  ...over,
});
const PREV = { items: ['a'], inventory: ['b'] };

beforeEach(() => {
  setLocale('en');
  addGymKit.mockReset();
  restoreGymKit.mockReset();
  markGymKitNotHere.mockReset();
  addGymKit.mockReturnValue(PREV);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('KitDots', () => {
  it('pads with empty dots up to eight and fills the used ones', () => {
    const { container } = render(<KitDots used={[true, false, true]} />);
    const dots = [...container.querySelectorAll('.gk-dot')];
    expect(dots).toHaveLength(8);
    expect(dots.filter((d) => d.classList.contains('none'))).toHaveLength(5);
    expect(dots.slice(5).map((d) => d.classList.contains('on'))).toEqual([true, false, true]);
  });

  it('never pads below zero when there are more than eight sessions', () => {
    const { container } = render(<KitDots used={Array(10).fill(true)} />);
    expect(container.querySelectorAll('.gk-dot')).toHaveLength(10);
    expect(container.querySelectorAll('.gk-dot.none')).toHaveLength(0);
  });
});

describe('GymKitUndo', () => {
  it('announces the addition, singular and plural', () => {
    const { rerender } = render(
      <GymKitUndo gym={gym} prev={PREV} count={1} onDone={() => undefined} />,
    );
    expect(screen.getByRole('status').textContent).toContain('Added to Iron');
    rerender(<GymKitUndo gym={gym} prev={PREV} count={4} onDone={() => undefined} />);
    expect(screen.getByRole('status').textContent).toContain('Iron updated · +4');
    rerender(<GymKitUndo gym={gym} prev={PREV} count={2} onDone={() => undefined} />);
    expect(screen.getByRole('status').textContent).toContain('Iron updated · +2'); // two is already "updated"
  });

  it('restores the previous kit on Undo and finishes', () => {
    const onDone = vi.fn();
    render(<GymKitUndo gym={gym} prev={PREV} count={1} onDone={onDone} floating />);
    expect(screen.getByRole('status').className).toContain('floating');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(restoreGymKit).toHaveBeenCalledWith('g1', PREV);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('dismisses itself after six seconds and cancels the timer on unmount', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { unmount } = render(<GymKitUndo gym={gym} prev={PREV} count={1} onDone={onDone} />);
    act(() => void vi.advanceTimersByTime(5999));
    expect(onDone).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
    unmount();
    const onDone2 = vi.fn();
    const r = render(<GymKitUndo gym={gym} prev={PREV} count={1} onDone={onDone2} />);
    r.unmount();
    act(() => void vi.advanceTimersByTime(7000));
    expect(onDone2).not.toHaveBeenCalled();
  });
});

describe('GymKitTray', () => {
  it('names the item and gym, shows the evidence count and the photo', () => {
    const { container } = render(
      <GymKitTray
        gym={gym}
        ev={ev(ITEM, { sessions: 1 })}
        onDismiss={() => undefined}
        onAdded={() => undefined}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain(
      `${localizedEquipName(withImg, 'en')} isn’t on Iron’s list`,
    );
    expect(screen.getByText('Seen once here')).toBeTruthy();
    expect(container.querySelector('img.gk-thumb')!.getAttribute('src')).toBe(
      withImg.image!.thumbUrl,
    );
  });

  it('falls back to the raw id and a placeholder icon for an unknown item', () => {
    const { container } = render(
      <GymKitTray
        gym={gym}
        ev={ev(UNKNOWN)}
        onDismiss={() => undefined}
        onAdded={() => undefined}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain(UNKNOWN);
    expect(container.querySelector('.gk-thumb-empty')).toBeTruthy();
  });

  it('adds the item and reports the previous kit; dismiss is separate', () => {
    const onAdded = vi.fn();
    const onDismiss = vi.fn();
    render(<GymKitTray gym={gym} ev={ev(ITEM)} onDismiss={onDismiss} onAdded={onAdded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(addGymKit).toHaveBeenCalledWith('g1', [ITEM]);
    expect(onAdded).toHaveBeenCalledWith(PREV);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not report an add that the store rejected', () => {
    addGymKit.mockReturnValue(null);
    const onAdded = vi.fn();
    render(<GymKitTray gym={gym} ev={ev(ITEM)} onDismiss={() => undefined} onAdded={onAdded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdded).not.toHaveBeenCalled();
  });
});

describe('GymKitReviewSheet', () => {
  const items = [ev('a-item', { medium: true }), ev('b-item', { medium: false, lifts: ['Curl'] })];

  it('switches on only items seen at least twice and counts them in the button', () => {
    render(
      <GymKitReviewSheet
        gym={gym}
        items={items}
        onClose={() => undefined}
        onAdded={() => undefined}
      />,
    );
    const sw = screen.getAllByRole('switch') as HTMLInputElement[];
    expect(sw.map((s) => s.checked)).toEqual([true, false]);
    expect(screen.getByRole('button', { name: 'Add 1 item' })).toBeTruthy();
    expect(screen.getByText('Update Iron')).toBeTruthy();
    expect(screen.getByText('Squat, Deadlift')).toBeTruthy(); // only two lifts shown
  });

  it('uses a custom title when given', () => {
    render(
      <GymKitReviewSheet
        gym={gym}
        title="Custom"
        items={items}
        onClose={() => undefined}
        onAdded={() => undefined}
      />,
    );
    expect(screen.getByText('Custom')).toBeTruthy();
  });

  it('toggles items; zero picked disables Add', () => {
    render(
      <GymKitReviewSheet
        gym={gym}
        items={items}
        onClose={() => undefined}
        onAdded={() => undefined}
      />,
    );
    const [a, b] = screen.getAllByRole('switch');
    fireEvent.click(b);
    expect(screen.getByRole('button', { name: 'Add 2 items' })).toBeTruthy();
    fireEvent.click(a);
    fireEvent.click(b);
    expect(
      (screen.getByRole('button', { name: 'Add 0 items' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('"Not at this gym" removes the row and tells the store', () => {
    render(
      <GymKitReviewSheet
        gym={gym}
        items={items}
        onClose={() => undefined}
        onAdded={() => undefined}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Not at this gym' })[0]);
    expect(markGymKitNotHere).toHaveBeenCalledWith('g1', 'a-item');
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    // the removed item is no longer counted as picked
    expect(
      (screen.getByRole('button', { name: 'Add 0 items' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('adds the picked items, closes and reports count + previous kit', () => {
    const onClose = vi.fn();
    const onAdded = vi.fn();
    render(<GymKitReviewSheet gym={gym} items={items} onClose={onClose} onAdded={onAdded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 item' }));
    expect(addGymKit).toHaveBeenCalledWith('g1', ['a-item']);
    expect(onClose).toHaveBeenCalled();
    expect(onAdded).toHaveBeenCalledWith(PREV, 1);
  });

  it('closes without reporting when the store rejects', () => {
    addGymKit.mockReturnValue(null);
    const onAdded = vi.fn();
    const onClose = vi.fn();
    render(<GymKitReviewSheet gym={gym} items={items} onClose={onClose} onAdded={onAdded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 item' }));
    expect(onClose).toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });
});

describe('GymKitCard', () => {
  it('renders nothing without evidence', () => {
    const { container } = render(<GymKitCard gym={gym} items={[]} title="T" sub="S" />);
    expect(container.firstChild).toBeNull();
  });

  it('previews at most three items and offers a review count', () => {
    const items = ['a', 'b', 'c', 'd'].map((i) => ev(i));
    const { container } = render(
      <GymKitCard gym={gym} items={items} title="Seen" sub="Not listed" />,
    );
    expect(container.querySelectorAll('.gk-row.compact')).toHaveLength(3);
    expect(screen.getByText('Seen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Review 4' })).toBeTruthy();
  });

  it('opens the review sheet, then swaps to Undo after adding, and Undo restores', () => {
    const items = [ev('a-item')];
    render(<GymKitCard gym={gym} items={items} title="Seen" sub="Not listed" />);
    fireEvent.click(screen.getByRole('button', { name: 'Review 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 item' }));
    expect(screen.getByRole('status').textContent).toContain('Added to Iron');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(restoreGymKit).toHaveBeenCalledWith('g1', PREV);
    // back to the card
    expect(screen.getByRole('button', { name: 'Review 1' })).toBeTruthy();
  });
});
