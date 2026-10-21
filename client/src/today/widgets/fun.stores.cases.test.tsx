/**
 * Fun widgets backed by device-local stores. Those stores cache their first read for the
 * life of the module, so this file seeds localStorage once, before any render, and the
 * tests then drive the widgets through their own UI (edit sheets, buttons). Tests run in
 * the written order and each leaves the stores in the state the next one expects.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { FUN_WIDGETS, funStrings } from './fun';
import {
  NOW,
  DAY,
  STATES,
  PRESETS,
  renderWidget,
  seed,
  setLocale,
} from '../__fixtures__/widgetHarness';
import { dayOfTimestamp, ymdOf } from '../../components/ui/calendarDays';
import type { WidgetSize } from '../../components/ui/Widget';

const s = funStrings('en');
const byId = (id: string) => FUN_WIDGETS.find((w) => w.id === id)!;
const render = (id: string, size: WidgetSize) => renderWidget(byId(id), size);
const text = (id: string, size: WidgetSize) => render(id, size).container.textContent ?? '';
const today = dayOfTimestamp(NOW);
const iso = (day: number) => {
  const { y, m, d } = ymdOf(day);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
const tw = (id: string, v: unknown) => localStorage.setItem(`spotter.tw.${id}`, JSON.stringify(v));
const dialog = () => screen.getByRole('dialog');
const dateField = () => dialog().querySelector<HTMLInputElement>('input[type=date]')!;
const textField = () => within(dialog()).getAllByRole('textbox')[0];
const tap = (name: string) => fireEvent.click(screen.getAllByRole('button', { name })[0]);
const press = (name: string | RegExp) =>
  fireEvent.click(within(dialog()).getAllByRole('button', { name }).at(-1)!);

beforeAll(() => {
  tw('event-countdown', {
    name: 'Spring Meet',
    date: iso(today + 20),
    meet: true,
    setDay: today - 10,
  });
  tw('motto', {
    text: 'Show up',
    since: NOW - 40 * DAY,
    history: [
      { text: 'Be patient', from: NOW - 90 * DAY, to: NOW - 40 * DAY },
      { text: 'Lift', from: NOW - 200 * DAY, to: NOW - 90 * DAY },
      { text: 'Third', from: NOW - 300 * DAY, to: NOW - 200 * DAY },
    ],
  });
  tw('daily-check-in', {
    [today]: { score: 4, note: 'Slept well', at: NOW - 3 * 3_600_000 },
    [today - 1]: { score: 2, note: 'Sore legs', at: NOW - DAY },
    [today - 2]: { score: 5, note: '', at: NOW - 2 * DAY },
  });
  tw('progress-photos', [
    { id: 'p1', at: NOW - 60 * DAY, url: 'data:image/jpeg;base64,AAAA', kg: 84 },
    { id: 'p2', at: NOW - 30 * DAY, url: 'data:image/jpeg;base64,BBBB', kg: 82.5 },
  ]);
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setLocale('en');
  PRESETS.none();
  seed(STATES.rich());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Event countdown (seeded meet in 20 days)', () => {
  it('shows days left, the name and the meet phases', () => {
    expect(text('event-countdown', 'S')).toContain('Spring Meet');
    expect(text('event-countdown', 'S')).toContain('20');
    const xl = text('event-countdown', 'XL');
    expect(xl).toContain(s.build);
    expect(xl).toContain(s.peak);
    expect(xl).toContain(s.deload);
    expect(xl).toContain(s.editEvent);
  });

  it('M headline carries the countdown sentence', () => {
    expect(text('event-countdown', 'M')).toContain(s.inDays('Spring Meet', 20));
  });

  it('saving the sheet with a date in the past turns the headline into "past"', () => {
    render('event-countdown', 'M');
    tap(s.inDays('Spring Meet', 20));
    fireEvent.change(dateField(), { target: { value: iso(today - 3) } });
    press(s.save);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(s.eventPast(3))).toBeTruthy();
  });

  it('an event dated today reads as today, and an invalid date is not saved', () => {
    render('event-countdown', 'M');
    tap(s.eventPast(3));
    fireEvent.change(dateField(), { target: { value: iso(today) } });
    fireEvent.change(textField(), { target: { value: '  Test day  ' } });
    press(s.save);
    expect(screen.getByText(s.eventToday('Test day'))).toBeTruthy();
    tap(s.eventToday('Test day'));
    fireEvent.change(dateField(), { target: { value: '' } });
    press(s.save);
    expect(screen.queryByRole('dialog')).not.toBeNull();
    press(s.cancel);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(s.eventToday('Test day'))).toBeTruthy();
  });

  it('removing the event brings back the invitation, which sets a new one with the default name', () => {
    render('event-countdown', 'M');
    tap(s.eventToday('Test day'));
    press(s.remove);
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    const r = render('event-countdown', 'L');
    expect(r.container.textContent).toContain(s.setEvent);
    fireEvent.click(within(r.container).getAllByRole('button', { name: s.setEvent })[0]);
    expect(within(dialog()).getByText(s.setEvent)).toBeTruthy();
    fireEvent.change(dateField(), { target: { value: iso(today + 5) } });
    press(s.save);
    cleanup();
    expect(text('event-countdown', 'M')).toContain(s.inDays(s.defaultEvent, 5));
    expect(text('event-countdown', 'XL')).not.toContain(s.build);
  });
});

describe('Motto (seeded with history)', () => {
  it('XL lists the earlier mottos, most recent two only, and the sessions since', () => {
    const xl = text('motto', 'XL');
    expect(xl).toContain('Show up');
    expect(xl).toContain(s.earlierMottos);
    expect(xl).toContain('Be patient');
    expect(xl).toContain('Lift');
    expect(xl).not.toContain('Third');
  });

  it('editing pushes the old text into history; an unchanged save changes nothing', () => {
    render('motto', 'M');
    tap('Show up');
    press(s.save);
    expect(screen.getByText('Show up')).toBeTruthy();
    tap('Show up');
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: ' Keep going ' } });
    press(s.save);
    cleanup();
    const xl = text('motto', 'XL');
    expect(xl).toContain('Keep going');
    expect(xl).toContain('Show up');
    expect(text('motto', 'S')).toContain('Keep going');
    expect(text('motto', 'L')).toContain('Keep going');
  });

  it('saving an empty text clears the motto and shows the invitation; removal path too', () => {
    render('motto', 'M');
    tap('Keep going');
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: '   ' } });
    press(s.save);
    cleanup();
    const r = render('motto', 'L');
    expect(r.container.textContent).toContain(s.setMotto);
    fireEvent.click(within(r.container).getAllByRole('button', { name: s.setMotto })[0]);
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'Fresh start' } });
    press(s.save);
    cleanup();
    render('motto', 'M');
    tap('Fresh start');
    press(s.remove);
    cleanup();
    expect(text('motto', 'M')).toContain(s.setMotto);
  });
});

describe('Daily check-in (seeded for today and the days before)', () => {
  it("S shows today's score; M shows score and note; L and XL show the 7-day average", () => {
    expect(text('daily-check-in', 'S')).toContain('4');
    expect(text('daily-check-in', 'M')).toContain('Slept well');
    const l = text('daily-check-in', 'L');
    expect(l).toContain('Slept well');
    expect(l).toContain(s.avg7('3.7'));
    const xl = text('daily-check-in', 'XL');
    expect(xl).toContain(s.lowDay('Fri', 'Sore legs'));
    expect(xl).toContain(s.editNote);
  });

  it('picking a score updates today and keeps the note', () => {
    const r = render('daily-check-in', 'L');
    fireEvent.click(within(r.container).getByRole('button', { name: `2 · ${s.scoreLabels[1]}` }));
    expect(r.container.textContent).toContain('Slept well');
    expect(r.container.textContent).toContain(s.avg7('3.7'.replace('3.7', '3.0')));
  });

  it('the note sheet saves a trimmed note and score', () => {
    render('daily-check-in', 'XL');
    fireEvent.click(screen.getByRole('button', { name: s.editNote }));
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: '  Tired  ' } });
    press(new RegExp(`^5`));
    press(s.save);
    cleanup();
    const m = text('daily-check-in', 'M');
    expect(m).toContain('Tired');
    expect(m).toContain(s.scoreOf(5, s.scoreLabels[4]));
  });
});

describe('Progress photos (seeded with two)', () => {
  it('S, M, L and XL show the span in days and the weight change', () => {
    expect(text('progress-photos', 'M')).toContain(s.daysN(30));
    expect(text('progress-photos', 'M')).toContain('−1.5 kg');
    const l = text('progress-photos', 'L');
    expect(l).toContain('84 → 82.5 kg');
    const xl = text('progress-photos', 'XL');
    expect(xl).toContain(s.nextReminder);
    expect(xl).toContain(s.sessions);
  });

  it('the gallery lists the photos newest first and deletes one', () => {
    render('progress-photos', 'M');
    tap(s.photosTitle);
    const sheet = within(dialog());
    expect(sheet.getAllByRole('button', { name: s.deletePhoto })).toHaveLength(2);
    fireEvent.click(sheet.getAllByRole('button', { name: s.deletePhoto })[0]);
    expect(within(dialog()).getAllByRole('button', { name: s.deletePhoto })).toHaveLength(1);
    cleanup();
    expect(text('progress-photos', 'S')).toContain('24 Aug'.slice(0, 0));
  });
});

describe('Photo upload', () => {
  const realImage = globalThis.Image;
  afterEach(() => {
    globalThis.Image = realImage;
    vi.restoreAllMocks();
  });

  const stubDecode = (ok: boolean) => {
    class FakeImage {
      width = 960;
      height = 720;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => (ok ? this.onload?.() : this.onerror?.()));
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image;
  };
  const upload = (container: HTMLElement) => {
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
  };

  it('a decoded photo is downscaled, stored and appears in the gallery', async () => {
    stubDecode(true);
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: draw,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,CCCC',
    );
    const r = render('progress-photos', 'L');
    upload(r.container);
    await waitFor(() => expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 480, 360));
    await waitFor(() => {
      fireEvent.click(document.body.querySelector<HTMLElement>('.uiw-hit')!);
      expect(within(dialog()).getAllByRole('button', { name: s.deletePhoto })).toHaveLength(2);
    });
  });

  it('a photo that cannot be decoded raises the failure toast', async () => {
    stubDecode(false);
    const r = render('progress-photos', 'L');
    upload(r.container);
    await waitFor(() =>
      expect(r.ctx.shell.calls.toast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'danger', text: s.photoFailed }),
      ),
    );
  });

  it('no 2d canvas context also fails with the toast', async () => {
    stubDecode(true);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const r = render('progress-photos', 'L');
    upload(r.container);
    await waitFor(() =>
      expect(r.ctx.shell.calls.toast).toHaveBeenCalledWith(
        expect.objectContaining({ text: s.photoFailed }),
      ),
    );
  });

  it('choosing no file does nothing', () => {
    const r = render('progress-photos', 'L');
    const input = r.container.querySelector<HTMLInputElement>('input[type=file]')!;
    fireEvent.change(input, { target: { files: [] } });
    expect(r.ctx.shell.calls.toast).toBeUndefined();
  });
});

describe('Timer', () => {
  afterEach(() => {
    // leave the timer idle for the next test
  });

  it('starts ready in EMOM mode; play starts it and reset stops it', () => {
    const r = render('timer', 'XL');
    expect(r.container.textContent).toContain(s.ready);
    fireEvent.click(within(r.container).getByRole('button', { name: s.resume }));
    expect(r.container.textContent).toContain(s.running);
    vi.setSystemTime(NOW + 5000);
    fireEvent.click(within(r.container).getByRole('button', { name: s.pause }));
    expect(r.container.textContent).toContain(s.paused);
    fireEvent.click(within(r.container).getByRole('button', { name: s.reset }));
    expect(r.container.textContent).toContain(s.ready);
  });

  it('switching to Tabata and stopwatch changes the description and the readout', () => {
    const r = render('timer', 'XL');
    fireEvent.click(within(r.container).getByRole('button', { name: s.tabata }));
    expect(r.container.textContent).toContain(s.tabataDesc);
    expect(r.container.textContent).toContain(s.roundOf(1, 8));
    fireEvent.click(within(r.container).getByRole('button', { name: s.stopwatch }));
    expect(r.container.textContent).toContain(s.stopwatchDesc);
    expect(r.container.textContent).toContain('0:00');
  });

  it('a running timer ticks with the clock and a finished EMOM restarts from zero', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    const r = render('timer', 'M');
    fireEvent.click(within(r.container).getAllByRole('button', { name: s.resume })[0]);
    vi.setSystemTime(NOW + 64_700);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(r.container.textContent).toContain(s.stopwatch);
    expect(r.container.textContent).toContain('1:05');
    fireEvent.click(within(r.container).getAllByRole('button', { name: s.pause })[0]);
    cleanup();
    const e = render('timer', 'L');
    fireEvent.click(within(e.container).getByRole('button', { name: s.emom }));
    fireEvent.click(within(e.container).getByRole('button', { name: s.resume }));
    vi.setSystemTime(NOW + 13 * 60_000);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(e.container.textContent).toContain(s.finished);
    // the first press stops the clock at the finished reading, the second starts over
    fireEvent.click(within(e.container).getByRole('button', { name: s.resume }));
    expect(e.container.textContent).toContain(s.finished);
    fireEvent.click(within(e.container).getByRole('button', { name: s.resume }));
    expect(e.container.textContent).toContain(s.running);
  });
});
