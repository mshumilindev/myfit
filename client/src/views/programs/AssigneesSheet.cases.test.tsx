import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssigneesSheet, type MemberAssignment } from './AssigneesSheet';
import { AvatarStack, ToggleRow } from './pieces';
import { ActivityChips, useActivityLine } from './ProgramActivities';
import { freshProgram, type Person, type Program } from './model';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { DAY, freezeClock, NOW, setDesktop } from '../__fixtures__/viewKit';

const PEOPLE: Person[] = [
  { id: 'a', name: 'Ada Lovelace' },
  { id: 'b', name: 'Bob Marley' },
  { id: 'c', name: 'Cleo Patra', avatar: true, avatarRev: 2 },
];
const program = (over: Partial<Program> = {}): Program => ({
  ...freshProgram('Push'),
  id: 'p1',
  weeks: 6,
  status: 'active',
  ...over,
});
const ASSIGN: MemberAssignment[] = [
  { memberId: 'a', programId: 'p1', startedAt: NOW - 15 * DAY },
  { memberId: 'b', programId: 'p2', startedAt: NOW - DAY },
];

function open(over: Partial<Parameters<typeof AssigneesSheet>[0]> = {}) {
  const props = {
    program: program(),
    people: PEOPLE,
    assignments: ASSIGN,
    programNames: new Map([['p2', 'Legs']]),
    onSave: vi.fn(async () => undefined),
    onClose: vi.fn(),
    ...over,
  };
  return { ...render(<AssigneesSheet {...props} />), props };
}
const member = (name: string) => screen.getByRole('checkbox', { name: new RegExp(name) });
const save = () =>
  screen.getByRole('button', {
    name: new RegExp(`^(${en.save}|${en.saving})`),
  }) as HTMLButtonElement;

beforeEach(() => {
  freezeClock();
  setLocale('en');
  setDesktop(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AssigneesSheet', () => {
  it('splits members into "on this program" (with the week they are in) and other clients (with their hint)', () => {
    open();
    expect(screen.getByText(en.pgOnThisProgram(1))).toBeTruthy();
    expect(screen.getByText(en.pgOtherClients)).toBeTruthy();
    // started 15 days ago = third week of six
    expect(screen.getByText(en.pgWeekOf(3, 6))).toBeTruthy();
    expect(screen.getByText(en.pgOnOther('Legs'))).toBeTruthy();
    expect(screen.getByText(en.pgNoProgram)).toBeTruthy();
    expect(screen.getByText(`${en.progStatusActive} · ${en.progWeeksCount(6)}`)).toBeTruthy();
    expect(member('Ada').getAttribute('aria-checked')).toBe('true');
    expect(member('Bob').getAttribute('aria-checked')).toBe('false');
  });

  it('caps the week at the program length and counts open-ended programs by week number', () => {
    open({ assignments: [{ memberId: 'a', programId: 'p1', startedAt: NOW - 100 * DAY }] });
    expect(screen.getByText(en.pgWeekOf(6, 6))).toBeTruthy();
    cleanup();
    open({ program: program({ weeks: 0, status: 'draft' }) });
    expect(screen.getByText(en.progWeekN(3))).toBeTruthy();
    expect(screen.getByText(`${en.progStatusDraft} · ${en.progOpenEnded}`)).toBeTruthy();
  });

  it('shows the archived status and an unknown other program as "another program"', () => {
    open({
      program: program({ status: 'archived' }),
      programNames: new Map(),
    });
    expect(screen.getByText(`${en.progStatusArchived} · ${en.progWeeksCount(6)}`)).toBeTruthy();
    expect(screen.getByText(en.pgOnOther(en.pgAnotherProgram))).toBeTruthy();
  });

  it('Save is disabled until something changes, then reports the delta on the button', () => {
    open();
    expect(save().disabled).toBe(true);
    fireEvent.click(member('Cleo'));
    expect(save().disabled).toBe(false);
    expect(save().textContent).toContain('+1');
    fireEvent.click(member('Ada'));
    expect(screen.getByText(en.pgWillBeRemoved)).toBeTruthy();
    expect(save().textContent).toContain('−1');
    // ticking Ada back in cancels the removal
    fireEvent.click(member('Ada'));
    expect(save().textContent).not.toContain('−');
  });

  it('adding someone who is on another program warns that it will switch', () => {
    open();
    fireEvent.click(member('Bob'));
    expect(screen.getByText(en.pgOnOtherSwitch('Legs'))).toBeTruthy();
  });

  it('saves adds and removes together and closes', async () => {
    const { props } = open();
    fireEvent.click(member('Cleo'));
    fireEvent.click(member('Bob'));
    fireEvent.click(member('Ada'));
    fireEvent.click(save());
    expect(save().textContent).toContain(en.saving);
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(props.onSave).toHaveBeenCalledWith(['c', 'b'], ['a']);
  });

  it('a failed save stays open, shows the error and lets you retry', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const { props } = open({ onSave });
    fireEvent.click(member('Cleo'));
    fireEvent.click(save());
    expect(await screen.findByText(en.pgSaveFailed)).toBeTruthy();
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(save());
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(screen.queryByText(en.pgSaveFailed)).toBeNull();
  });

  it('search narrows both lists by name tokens', () => {
    open();
    fireEvent.change(screen.getByPlaceholderText(en.pgSearchClients), { target: { value: 'bob' } });
    expect(screen.queryByText('Ada Lovelace')).toBeNull();
    expect(screen.getByText('Bob Marley')).toBeTruthy();
    expect(screen.queryByText(en.pgOnThisProgram(1))).toBeNull();
  });

  it('with no clients says so instead of a list', () => {
    open({ people: [] });
    expect(screen.getByText(en.progNoClients)).toBeTruthy();
    expect(screen.queryByPlaceholderText(en.pgSearchClients)).toBeNull();
  });
});

describe('program page pieces', () => {
  it('ToggleRow labels the switch with its text, reports toggles and honours disabled', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ToggleRow label="Warm-up" hint="five minutes" on={false} onToggle={onToggle} />,
    );
    expect(screen.getByText('five minutes')).toBeTruthy();
    const sw = screen.getByRole('switch', { name: 'Warm-up' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<ToggleRow label="Warm-up" on disabled onToggle={onToggle} />);
    expect((screen.getByRole('switch', { name: 'Warm-up' }) as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it('ToggleRow with a non-text label has no aria-label of its own', () => {
    render(<ToggleRow label={<b>Rich</b>} on onToggle={() => undefined} />);
    expect(screen.getByRole('switch').getAttribute('aria-label')).toBeNull();
  });

  it('AvatarStack shows the first three people and a +N for the rest', () => {
    const many: Person[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: `Person ${id}` }));
    const { container } = render(<AvatarStack people={many} />);
    expect(container.querySelectorAll('.pg-av').length).toBe(4);
    expect(container.querySelector('.pg-av-more')?.textContent).toBe('+2');
    cleanup();
    const small = render(<AvatarStack people={many.slice(0, 2)} max={5} />);
    expect(small.container.querySelectorAll('.pg-av').length).toBe(2);
    expect(small.container.querySelector('.pg-av-more')).toBeNull();
  });

  it('activity chips read "Run · 20 min", with the time of day only when asked and not "any"', () => {
    const list = [
      { id: '1', day: 2, type: 'run', minutes: 20, effort: 'light', when: 'after' },
      { id: '2', day: 2, type: 'sauna', minutes: 15, effort: 'light', when: 'any' },
    ] as never;
    const { container } = render(<ActivityChips list={list} />);
    const chips = [...container.querySelectorAll('.pg-actchips > *')].map((c) => c.textContent);
    expect(chips).toEqual([
      `${en.actType.run} · 20 ${en.minShort}`,
      `${en.actType.sauna} · 15 ${en.minShort}`,
    ]);
  });

  it('renders no chip row for an empty list; the line helper appends the time of day', () => {
    const { container } = render(<ActivityChips list={[]} />);
    expect(container.innerHTML).toBe('');
    let line!: ReturnType<typeof useActivityLine>;
    function Probe() {
      line = useActivityLine();
      return null;
    }
    render(<Probe />);
    const a = {
      id: '1',
      day: 1,
      type: 'run',
      minutes: 30,
      effort: 'light',
      when: 'after',
    } as never;
    expect(line(a)).toBe(`${en.actType.run} · 30 ${en.minShort}`);
    expect(line(a, true)).toMatch(/ · 30 min · .+/);
    expect(line({ ...(a as object), when: 'any', type: 'unknown-type' } as never, true)).toBe(
      `unknown-type · 30 ${en.minShort}`,
    );
  });
});
