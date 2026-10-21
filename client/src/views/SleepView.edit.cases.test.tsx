import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { freezeClock, NOW, richState, seed, setDesktop } from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({
  stop: vi.fn(),
  cancel: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  quality: vi.fn(),
  log: vi.fn(),
  schedule: vi.fn(),
  settings: vi.fn(),
  name: null as string | null,
}));
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  stopSleep: (...a: unknown[]) => m.stop(...a),
  cancelSleep: (...a: unknown[]) => m.cancel(...a),
  updateSleepNight: (...a: unknown[]) => m.update(...a),
  removeSleepNight: (...a: unknown[]) => m.remove(...a),
  setSleepQuality: (...a: unknown[]) => m.quality(...a),
  logSleepNight: (...a: unknown[]) => m.log(...a),
  setSleepSchedule: (...a: unknown[]) => m.schedule(...a),
  setSleepSettings: (...a: unknown[]) => m.settings(...a),
}));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getUsername: () => m.name,
}));

import { SleepView } from './SleepView';

const open = (props: Partial<React.ComponentProps<typeof SleepView>> = {}) => {
  const onClose = vi.fn();
  const out = render(<SleepView onClose={onClose} {...props} />);
  return { ...out, onClose };
};
const dlg = () => document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement;
const cls = (c: string) => document.querySelector(c) as HTMLElement;
const hh = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  Object.values(m).forEach((f) => typeof f === 'function' && 'mockReset' in f && f.mockReset());
  m.name = null;
  setDesktop(false);
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SleepView: edit a logged night', () => {
  const night = () => richState().sleeps[1];
  const edit = (id = night().id) => open({ mode: 'edit', nightId: id });

  it('prefills the clock times and duration from the night', () => {
    const n = night();
    edit();
    expect((screen.getByLabelText(en.sleepBedtimeLabel) as HTMLInputElement).value).toBe(
      hh(n.bedtime),
    );
    expect((screen.getByLabelText(en.sleepWokeLabel) as HTMLInputElement).value).toBe(hh(n.wake!));
    expect(cls('.sleep-dur-big').textContent).toMatch(/\d/);
    expect(cls('.sleep-nightof').textContent).toContain(
      en.sleepNightOf(
        new Date(n.bedtime).toLocaleDateString('en', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
      ),
    );
  });

  it('save writes the new times, date, quality and kind and closes', () => {
    const n = night();
    const { onClose } = edit();
    fireEvent.change(screen.getByLabelText(en.sleepBedtimeLabel), { target: { value: '23:00' } });
    fireEvent.change(screen.getByLabelText(en.sleepWokeLabel), { target: { value: '07:00' } });
    expect(cls('.sleep-dur-big').textContent).toBe('8h 0m');
    fireEvent.click(screen.getByText(en.sleepQuality.good));
    fireEvent.click(screen.getByText(en.sleepKindNap));
    fireEvent.click(screen.getByText(en.sleepSaveNight));
    expect(m.update).toHaveBeenCalledTimes(1);
    const [id, patch] = m.update.mock.calls[0];
    expect(id).toBe(n.id);
    expect(patch.kind).toBe('nap');
    expect(hh(patch.bedtime)).toBe('23:00');
    expect(hh(patch.wake)).toBe('07:00');
    expect(patch.wake - patch.bedtime).toBe(8 * 3600_000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a wake clock earlier than bed is read as the next morning', () => {
    edit();
    fireEvent.change(screen.getByLabelText(en.sleepBedtimeLabel), { target: { value: '22:00' } });
    fireEvent.change(screen.getByLabelText(en.sleepWokeLabel), { target: { value: '06:00' } });
    expect(cls('.sleep-dur-big').textContent).toBe('8h 0m');
  });

  it('delete asks first, cancel keeps the night, confirm removes and closes', () => {
    const n = night();
    const { onClose } = edit();
    fireEvent.click(screen.getByText(en.sleepDeleteNight));
    const d = dlg();
    expect(within(d).getByText(en.sleepDeleteConfirm)).toBeTruthy();
    fireEvent.click(within(d).getByText(en.cancel));
    expect(m.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(en.sleepDeleteNight));
    fireEvent.click(within(dlg()).getByRole('button', { name: en.sleepDeleteNight }));
    expect(m.remove).toHaveBeenCalledWith(n.id);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a nap opens as a nap; an unknown night id closes the editor', () => {
    const nap = richState().sleeps.find((s) => s.id === 'nap-1')!;
    edit(nap.id);
    expect(cls('.sleep-nightof svg')).toBeTruthy();
    cleanup();
    const { onClose } = edit('does-not-exist');
    expect(onClose).toHaveBeenCalled();
  });

  it('the back arrow closes without saving', () => {
    const { onClose } = edit();
    fireEvent.click(screen.getByRole('button', { name: en.cancel }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(m.update).not.toHaveBeenCalled();
  });
});
