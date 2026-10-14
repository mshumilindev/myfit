import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareEn as sh } from '../../i18n/coachShare.en';
import { buildShareSource } from './__fixtures__/fixtures';
import { resolveShare } from './resolve';
import { ShareCardView } from './ShareCardView';
import { loadingView, SHARE_KINDS, type ShareKind, type ShareSource, type Viewer } from './types';
import { searchAll } from './search';
import { shareCardProps } from './ShareCardView';
import { useWords } from './ShareCardView';
import { renderHook } from '@testing-library/react';

afterEach(cleanup);
const T: Viewer = { side: 'trainer', clientId: 'c1' };
const src: ShareSource = buildShareSource();
const off = (cat: 'totals' | 'sets'): ShareSource => ({
  ...src,
  clients: {
    ...src.clients,
    c1: { ...src.clients.c1, consent: { ...src.clients.c1.consent, [cat]: 'off' } },
  },
});

/** One resolved view per kind and state. */
function views(kind: ShareKind) {
  const first = searchAll('', T, src).groups.find((g) => g.kind === kind)!.hits[0]?.view;
  const ref = first?.ref ?? { kind, id: 'x' };
  const base = resolveShare(ref, T, src);
  const lockedSrc =
    kind === 'workout' || kind === 'activity'
      ? off('totals')
      : kind === 'results'
        ? off('sets')
        : null;
  const lockedView = lockedSrc
    ? resolveShare(ref, T, lockedSrc)
    : { ...base, state: 'locked' as const, reason: { code: 'private' as const } };
  return {
    ok: base,
    limited: { ...base, state: 'limited' as const, limited: { cat: 'sets' as const } },
    locked: lockedView,
    removed: resolveShare({ kind, id: 'gone' }, T, src),
    loading: loadingView(ref),
  };
}

describe('ShareCard: nine kinds x five states', () => {
  for (const kind of SHARE_KINDS) {
    for (const state of ['ok', 'limited', 'locked', 'removed', 'loading'] as const) {
      it(`${kind} / ${state}`, () => {
        const v = views(kind)[state];
        const { container } = render(<ShareCardView view={v} who="Oleh" onOpen={vi.fn()} />);
        const card = container.querySelector('.uishc')!;
        expect(card).toBeTruthy();
        // one panel, one width class: every state uses the same bubble frame
        expect(card.className).toContain('uishc--bubble');
        const dead = state === 'locked' || state === 'removed';
        expect(card.tagName === 'BUTTON').toBe(!dead && state !== 'loading');
        if (state === 'loading') expect(card.getAttribute('aria-busy')).toBe('true');
        if (dead) expect(card.className).toContain(`is-${state}`);
        if (state === 'removed') expect(screen.getByText(sh.removed[kind])).toBeTruthy();
        // a dead or loading card is never a link and shows no rows
        if (dead || state === 'loading') expect(container.querySelector('.uishc-rows')).toBeNull();
      });
    }
  }

  it('a locked card never shows data of the item', () => {
    const v = views('workout').locked;
    const { container } = render(<ShareCardView view={v} who="Oleh" onOpen={vi.fn()} />);
    expect(container.textContent).not.toMatch(/\d+ min|kg|Squat|Bench/);
    expect(container.querySelector('.uishc-facts')).toBeNull();
  });

  it('every state carries a spoken name', () => {
    for (const kind of SHARE_KINDS)
      for (const v of Object.values(views(kind))) {
        const { result } = renderHook(() => useWords());
        expect(shareCardProps(result.current, v, 'Oleh').ariaLabel.length).toBeGreaterThan(0);
      }
  });

  it('tapping an openable card calls onOpen with the view', () => {
    const open = vi.fn();
    const v = views('program').ok;
    render(<ShareCardView view={v} who="Oleh" onOpen={open} />);
    screen.getByRole('button').click();
    expect(open).toHaveBeenCalledWith(v);
  });

  it('an activity with a track draws the offline route (no map tiles)', () => {
    const a = src.clients.c1.activities.find((x) => x.points && x.points.length > 1);
    if (!a) return;
    const v = resolveShare({ kind: 'activity', id: a.id, ownerId: 'c1' }, T, src);
    const { container } = render(<ShareCardView view={v} who="Oleh" />);
    expect(container.querySelector('.route-map, .gym-map')).toBeTruthy();
    expect(container.querySelector('img[src*="openstreetmap"]')).toBeNull();
  });
});

describe('chat code has no media words (text only, plan 10.1)', () => {
  it('ThreadView and the composer know no attachment / upload / image fields', async () => {
    const fs = await import('node:fs');
    for (const f of [
      '../chat/ThreadView.tsx',
      '../chat/types.ts',
      '../chat/chatStore.ts',
      '../../components/ui/ChatComposer.tsx',
    ]) {
      const text = fs
        .readFileSync(new URL(f, import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(text, f).not.toMatch(/attachment|upload|<img|\bimage\b/i);
    }
  });
});
