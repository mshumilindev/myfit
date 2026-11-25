/** SPO-307 (R7, R27): a catalog program is recognised by `origin`, is never editable and survives normalising. */
import { describe, expect, it, vi } from 'vitest';
import { isCatalogProgram, normalizeProgram, type Program } from './model';

vi.mock('../../api', async (orig) => ({
  ...(await orig<typeof import('../../api')>()),
  currentUid: () => 'u1',
}));

const base: Program = {
  id: 'tl-u1-x',
  name: 'A: B',
  weeks: 4,
  daysPerWeek: 3,
  status: 'active',
  authorId: 'u1',
  dayNames: {},
  targetMuscles: {},
  items: [],
};

describe('catalog program marker', () => {
  it('is set only by origin', () => {
    expect(isCatalogProgram(base)).toBe(false);
    expect(isCatalogProgram({ ...base, origin: { v: 1, id: 'x' } })).toBe(true);
  });
  it('survives normalizeProgram (the list and Today read through it)', () => {
    const n = normalizeProgram({ ...base, origin: { v: 1, id: 'x' } } as Program);
    expect(isCatalogProgram(n)).toBe(true);
  });
  it('is not an own (editable) program for the activity suggestions', async () => {
    const { isOwnProgram } = await import('../../data/programActivities');
    const a = (program: object) => ({ program }) as never;
    expect(isOwnProgram(a({ ...base }))).toBe(true);
    expect(isOwnProgram(a({ ...base, origin: { v: 1, id: 'x' } }))).toBe(false);
  });
});

describe('ProgramTitle', () => {
  it('puts the athlete first in the accent colour for a catalog program only', async () => {
    const { render, cleanup } = await import('@testing-library/react');
    const { createElement } = await import('react');
    const { ProgramTitle } = await import('./ProgramTitle');
    const cat = render(
      createElement(ProgramTitle, {
        program: { name: 'Reg Park: 5x5', origin: { v: 1, id: 'x' } } as never,
      }),
    );
    expect(cat.container.querySelector('.pg-who')?.textContent).toBe('Reg Park');
    expect(cat.container.textContent).toBe('Reg Park: 5x5');
    cleanup();
    const plain = render(createElement(ProgramTitle, { program: { name: 'A: B' } }));
    expect(plain.container.querySelector('.pg-who')).toBeNull();
    cleanup();
  });
});
