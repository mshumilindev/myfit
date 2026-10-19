/** Calendar settings form: working hours, range, the trainer's gyms, validation and the sealed save. */
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import { setViewport } from '../testViewport';
import { CalendarSettingsForm } from './CalendarSettingsForm';
import {
  configureCalendarSettings,
  createMemoryCalendarSettingsPort,
  useCalendarSettings,
  type CalendarSettingsPort,
} from './calendarSettings';
import { defaultSettings, type CalendarSettings, type GymWeek } from './hours';
import { configureScheduleGyms, type Gym } from './types';

const MON = Math.floor(Date.UTC(2026, 9, 5) / 86_400_000);
const allDay: GymWeek = Array.from({ length: 7 }, () => [[0, 1440] as const]);
const office: GymWeek = [
  ...Array.from({ length: 5 }, () => [[360, 1380] as const]),
  [[480, 1200] as const],
  [],
];
const weekdays: GymWeek = Array.from({ length: 7 }, (_, i) =>
  i < 5 ? [[420, 1320] as const] : [],
);
const gym = (id: string, name: string, hours?: GymWeek): Gym => ({
  id,
  name,
  short: name.slice(0, 2),
  ...(hours ? { hours } : {}),
});

beforeEach(() => setViewport(1440));
afterEach(() => {
  cleanup();
  configureCalendarSettings(null);
  configureScheduleGyms(null);
});

async function open(initial: CalendarSettings | null, port?: Partial<CalendarSettingsPort>) {
  const mem = createMemoryCalendarSettingsPort(initial);
  const save = vi.fn(mem.save);
  configureCalendarSettings({ load: mem.load, save: port?.save ?? save });
  // the real screen shows the form after the settings loaded
  const hook = renderHook(() => useCalendarSettings());
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  const onClose = vi.fn();
  render(<CalendarSettingsForm t={t} locale="en" today={MON + 2} onClose={onClose} />);
  return { save, onClose };
}

describe('working hours', () => {
  it('shows a switch and a from-to pair for each working day, "Day off" for the others', async () => {
    await open(null);
    const form = screen.getByRole('form', { name: t.hsTitle });
    expect(within(form).getByLabelText('Monday')).toBeTruthy();
    expect((within(form).getByLabelText('Monday') as HTMLInputElement).checked).toBe(true);
    expect((within(form).getByLabelText('Saturday') as HTMLInputElement).checked).toBe(false);
    expect((within(form).getByLabelText(`Monday: ${t.hsFrom}`) as HTMLInputElement).value).toBe(
      '07:00',
    );
    expect((within(form).getByLabelText(`Monday: ${t.hsTo}`) as HTMLInputElement).value).toBe(
      '21:00',
    );
    expect(within(form).getAllByText(t.hsDayOff)).toHaveLength(2);
  });

  it('switching a day off hides its times; on again restores the 07:00-21:00 default', async () => {
    await open(null);
    fireEvent.click(screen.getByLabelText('Monday'));
    expect(screen.queryByLabelText(`Monday: ${t.hsFrom}`)).toBeNull();
    fireEvent.click(screen.getByLabelText('Saturday'));
    expect((screen.getByLabelText(`Saturday: ${t.hsFrom}`) as HTMLInputElement).value).toBe(
      '07:00',
    );
  });

  it('an end less than an hour after the start shows the order error and disables Save; fixing it re-enables', async () => {
    const { save } = await open(null);
    fireEvent.change(screen.getByLabelText(`Tuesday: ${t.hsTo}`), { target: { value: '07:30' } });
    expect(screen.getByRole('alert').textContent).toBe(t.hsOrder);
    const saveBtn = screen.getByRole('button', { name: t.hsSave }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    fireEvent.submit(screen.getByRole('form', { name: t.hsTitle }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(`Tuesday: ${t.hsTo}`), { target: { value: '08:00' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveBtn.disabled).toBe(false);
  });

  it('clearing a time field is ignored; a stored end of midnight reads 23:59', async () => {
    const s = defaultSettings();
    s.working = s.working.map((d, i) => (i === 0 ? { start: 360, end: 1440 } : d));
    await open(s);
    const end = screen.getByLabelText(`Monday: ${t.hsTo}`) as HTMLInputElement;
    expect(end.value).toBe('23:59');
    fireEvent.change(screen.getByLabelText(`Monday: ${t.hsFrom}`), { target: { value: '' } });
    expect((screen.getByLabelText(`Monday: ${t.hsFrom}`) as HTMLInputElement).value).toBe('06:00');
  });
});

describe('range', () => {
  it('each mode explains itself', async () => {
    await open(null);
    const status = () => screen.getByRole('status').textContent;
    expect(status()).toBe(t.hsRangeAuto);
    fireEvent.click(screen.getByRole('button', { name: t.hsWorking }));
    expect(status()).toBe(t.hsRangeWorking);
    fireEvent.click(screen.getByRole('button', { name: t.hs24 }));
    expect(status()).toBe(t.hsRange24);
  });
});

describe('gyms', () => {
  it('no gyms: the explanation, no list, no "none ticked" hint; with a gym source the Add button is offered', async () => {
    configureScheduleGyms(() => []);
    await open(null);
    expect(screen.getByText(t.hsNoGyms)).toBeTruthy();
    expect(screen.queryByText(t.hsGymsNone)).toBeNull();
    expect(screen.queryByText(t.hsGymsCount(0, 0))).toBeNull();
    expect(screen.getByRole('button', { name: t.hsGymsAdd })).toBeTruthy();
  });

  it('without a gym source (test doubles only) there is no Add button', async () => {
    await open(null);
    expect(screen.queryByRole('button', { name: t.hsGymsAdd })).toBeNull();
  });

  it("lists the trainer's gyms with their hours; ticking counts them and Save stores the ids", async () => {
    configureScheduleGyms(() => [
      gym('a', 'Iron Yard', office),
      gym('b', 'Night Gym', allDay),
      gym('c', 'Park', weekdays),
      gym('d', 'Mystery'),
    ]);
    const { save, onClose } = await open(null);
    const list = screen.getByRole('region', { name: t.hsGyms });
    expect(within(list).getByText(`06:00–23:00 · ${t.scWeekendShort} 08:00–20:00`)).toBeTruthy();
    expect(within(list).getByText(t.hsGym24)).toBeTruthy();
    expect(within(list).getByText('07:00–22:00')).toBeTruthy();
    expect(within(list).getByText(t.hsGymNoHours)).toBeTruthy();
    expect(screen.getByText(t.hsGymsNone)).toBeTruthy();
    expect(screen.getByText(t.hsGymsCount(0, 4))).toBeTruthy();
    fireEvent.click(within(list).getByLabelText('Iron Yard'));
    fireEvent.click(within(list).getByLabelText('Night Gym'));
    expect(screen.getByText(t.hsGymsCount(2, 4))).toBeTruthy();
    expect(screen.queryByText(t.hsGymsNone)).toBeNull();
    fireEvent.click(within(list).getByLabelText('Night Gym')); // untick
    fireEvent.click(screen.getByRole('button', { name: t.hs24 }));
    fireEvent.click(screen.getByRole('button', { name: t.hsSave }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0][0];
    expect(saved).toMatchObject({ v: 1, gymIds: ['a'], range: '24h' });
    expect(saved.working[0]).toEqual({ start: 420, end: 1260 });
    expect(saved.working[5]).toBeNull();
  });

  it('a gym that is no longer in the list is not counted as chosen', async () => {
    configureScheduleGyms(() => [gym('a', 'Iron Yard', office)]);
    const s = { ...defaultSettings(), gymIds: ['a', 'deleted-gym'] };
    await open(s);
    expect(screen.getByText(t.hsGymsCount(1, 1))).toBeTruthy();
    expect(screen.queryByText(t.hsGymsNone)).toBeNull();
  });

  it('with a gym source installed there is an "Add a gym" button that opens the picker', async () => {
    configureScheduleGyms(() => []);
    await open(null);
    fireEvent.click(screen.getByRole('button', { name: t.hsGymsAdd }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});

describe('saving', () => {
  it('a failed save keeps the form open with an alert; the next try can succeed', async () => {
    let fail = true;
    const save = vi.fn(async () => {
      if (fail) throw new Error('offline');
    });
    const { onClose } = await open(null, { save });
    fireEvent.click(screen.getByRole('button', { name: t.hsSave }));
    expect(await screen.findByText(t.hsFail)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: t.hsSave }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByText(t.hsFail)).toBeNull();
  });

  it('Save is disabled while saving (no double write)', async () => {
    let release!: () => void;
    const save = vi.fn(() => new Promise<void>((r) => (release = r)));
    await open(null, { save });
    fireEvent.click(screen.getByRole('button', { name: t.hsSave }));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: t.hsSave }) as HTMLButtonElement).disabled).toBe(
        true,
      ),
    );
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });

  it('a second submit (Enter in a field) while saving does not write twice', async () => {
    let release!: () => void;
    const save = vi.fn(() => new Promise<void>((r) => (release = r)));
    await open(null, { save });
    const form = screen.getByRole('form', { name: t.hsTitle });
    fireEvent.submit(form);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: t.hsSave }) as HTMLButtonElement).disabled).toBe(
        true,
      ),
    );
    fireEvent.submit(form);
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });

  it('Cancel closes without saving', async () => {
    const { save, onClose } = await open(null);
    fireEvent.click(screen.getByRole('button', { name: t.bdCancel }));
    expect(onClose).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
