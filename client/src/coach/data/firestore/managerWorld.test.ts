import { describe, expect, it } from 'vitest';
import { createManagerWorldPort } from './managerWorld';
import type { ManagerBook, ManagerClient } from './managerRings';

const row = (id: string, ready: boolean): ManagerClient => ({
  clientId: id,
  cid: `cid-${id}`,
  trainerId: 't1',
  trainerName: 'Olena',
  name: `Client ${id}`,
  ready,
});

function bookOf(rows: ManagerClient[]): ManagerBook {
  return {
    clients: () => rows,
    ready: () => Promise.resolve(),
    watch: () => () => undefined,
  } as unknown as ManagerBook;
}

describe('manager world', () => {
  it('lists the team clients with every consent off and nothing a manager must not see', async () => {
    const port = createManagerWorldPort({
      manager: { id: 'm1', name: 'Max' },
      book: bookOf([row('a', true), row('b', false)]),
      now: () => 5,
    });
    const w = await port.load({ signal: new AbortController().signal });
    expect(w.clients.map((c) => c.name)).toEqual(['Client a', 'Client b']);
    for (const c of w.clients) {
      expect(Object.values(c.consent).every((l) => l === 'off')).toBe(true);
      expect(c.lastSessionAt).toBeNull();
    }
    expect(w.inputs).toEqual([]);
    expect(w.slots).toEqual([]);
    expect(port.peek()?.data.clients).toHaveLength(2);
    await expect(port.save({} as never, w.book)).resolves.toBeUndefined();
  });

  it('peek is null before the first client is known', () => {
    const port = createManagerWorldPort({
      manager: { id: 'm1', name: 'Max' },
      book: bookOf([]),
    });
    expect(port.peek()).toBeNull();
  });
});
