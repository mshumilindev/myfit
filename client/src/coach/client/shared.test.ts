import { describe, expect, it, vi } from 'vitest';
import { getClientShared, publishClientShared } from './shared';

const base = {
  hasTrainer: true,
  trainerFirst: 'Oleh',
  unread: 1,
  unreadLabel: '1 unread message',
  markerLegend: 'Session',
  markerDay: 'Session with Oleh',
};

describe('publishClientShared', () => {
  it('does not notify when the published content is structurally the same (render-loop guard)', () => {
    publishClientShared(null);
    const listener = vi.fn();
    // subscribe through the public hook source: a re-publish of equal data must not change the snapshot identity
    publishClientShared({ ...base, trainerDays: new Set([1, 2]), notifs: [] });
    const first = getClientShared();
    publishClientShared({ ...base, trainerDays: new Set([2, 1]), notifs: [] });
    expect(getClientShared()).toBe(first);
    listener();
    publishClientShared({ ...base, unread: 2, trainerDays: new Set([1, 2]), notifs: [] });
    expect(getClientShared()).not.toBe(first);
    publishClientShared(null);
  });

  it('treats equal notifs by value, different notifs as a change', () => {
    publishClientShared(null);
    const n = { id: 'a', kind: 'trainer', ts: 1, title: 't', subtitle: 's', nav: '#/x' } as never;
    publishClientShared({ ...base, trainerDays: new Set(), notifs: [n] });
    const first = getClientShared();
    publishClientShared({
      ...base,
      trainerDays: new Set(),
      notifs: [{ ...(n as object) } as never],
    });
    expect(getClientShared()).toBe(first);
    publishClientShared({
      ...base,
      trainerDays: new Set(),
      notifs: [{ ...(n as object), title: 'changed' } as never],
    });
    expect(getClientShared()).not.toBe(first);
    publishClientShared(null);
  });

  it('a row that only differs by its timestamp is the same row (the "now"-stamped unread row looped forever)', () => {
    publishClientShared(null);
    const row = (ts: number) =>
      ({
        id: 'trainer:msg:1',
        kind: 'trainer',
        ts,
        title: 't',
        subtitle: 's',
        nav: '#/x',
      }) as never;
    publishClientShared({ ...base, trainerDays: new Set(), notifs: [row(1)] });
    const first = getClientShared();
    publishClientShared({ ...base, trainerDays: new Set(), notifs: [row(2)] });
    expect(getClientShared()).toBe(first);
    publishClientShared(null);
  });
});
