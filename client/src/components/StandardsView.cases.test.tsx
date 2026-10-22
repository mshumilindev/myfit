import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import type { BodyMetrics, Exercise, Workout } from '../types';
import { StandardsView } from './StandardsView';

const ex = (name: string, weight: number, reps = 1): Exercise => ({
  id: name,
  name,
  position: 0,
  sets: [{ id: 's1', position: 0, reps, weight, isWarmup: false }],
});
const wo = (...exercises: Exercise[]): Workout => ({
  id: 'w1',
  startedAt: Date.UTC(2026, 8, 1, 10),
  finishedAt: Date.UTC(2026, 8, 1, 11),
  autoFinished: false,
  exercises,
});
const body = (over: Partial<BodyMetrics> = {}): BodyMetrics => ({
  sex: 'male',
  weights: [{ id: 'a', at: 1, weight: 80 }],
  ...over,
});

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('StandardsView', () => {
  it('gates on missing sex and bodyweight, naming exactly what is missing', () => {
    render(<StandardsView finished={[]} body={{ weights: [] }} />);
    expect(screen.getByRole('heading', { level: 4 })).toBeTruthy();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('#/profile/me');
    expect(document.querySelector('.std-gate-b')!.textContent!.toLowerCase()).toMatch(
      /sex.*bodyweight/,
    );
  });

  it('gates when only the bodyweight is missing', () => {
    render(<StandardsView finished={[]} body={body({ weights: [] })} />);
    const text = document.querySelector('.std-gate-b')!.textContent!.toLowerCase();
    expect(text).toContain('bodyweight');
    expect(text).not.toContain('sex');
  });

  it('gates when only the sex is missing', () => {
    render(<StandardsView finished={[]} body={body({ sex: undefined })} />);
    const text = document.querySelector('.std-gate-b')!.textContent!.toLowerCase();
    expect(text).toContain('sex');
    expect(text).not.toContain('bodyweight');
  });

  it('uses the LATEST weigh-in, whatever the array order', () => {
    render(
      <StandardsView
        finished={[]}
        body={body({
          weights: [
            { id: 'a', at: 5, weight: 91.4 },
            { id: 'b', at: 9, weight: 77.6 },
            { id: 'c', at: 1, weight: 120 },
          ],
        })}
      />,
    );
    expect(screen.getByText('78 kg')).toBeTruthy();
  });

  it('shows every discipline as not started when nothing is trained', () => {
    const { container } = render(<StandardsView finished={[]} body={body()} />);
    expect(container.querySelector('.std-section-lab')).toBeTruthy();
    expect(container.querySelectorAll('.std-card').length).toBeGreaterThan(5);
    expect(container.querySelectorAll('.std-badge.todo').length).toBe(
      container.querySelectorAll('.std-card').length,
    );
    expect(container.querySelector('.std-foot')).toBeNull();
  });

  it('marks achieved tiers and the next target for a trained lift', () => {
    const { container } = render(
      <StandardsView finished={[wo(ex('Bench Press', 100))]} body={body()} />,
    );
    const card = container.querySelector('#std-bench') as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.querySelector('.std-best .num')!.textContent).toBe('103'); // Epley e1RM of 100 x 1
    expect(card.querySelectorAll('.std-rank.on').length).toBeGreaterThan(0);
    expect(card.querySelectorAll('.std-rank.target')).toHaveLength(1);
    expect(card.querySelector('.std-next')!.textContent).toMatch(/^\+\d+ kg → /);
    const fill = card.querySelector('.std-fill') as HTMLElement;
    expect(fill.style.width).toMatch(/^\d+%$/);
    expect(within(card).getByText(/Now/i)).toBeTruthy();
  });

  it('says "below the first tier" when a lift exists but is under every norm', () => {
    const { container } = render(
      <StandardsView finished={[wo(ex('Bench Press', 20))]} body={body()} />,
    );
    const card = container.querySelector('#std-bench') as HTMLElement;
    expect(card.querySelector('.std-cur.muted')).toBeTruthy();
    expect(card.querySelectorAll('.std-rank.on')).toHaveLength(0);
    expect(card.querySelector('.std-fill')).toBeTruthy();
  });

  it('shows the max-reached note when the top tier is cleared', () => {
    const { container } = render(
      <StandardsView finished={[wo(ex('Bench Press', 400))]} body={body()} />,
    );
    const card = container.querySelector('#std-bench') as HTMLElement;
    expect(card.querySelector('.std-next.ok')).toBeTruthy();
    expect(card.querySelectorAll('.std-rank.target')).toHaveLength(0);
    expect((card.querySelector('.std-fill') as HTMLElement).style.width).toBe('100%');
  });

  it('computes the powerlifting total only when squat, bench and deadlift all exist', () => {
    const two = render(
      <StandardsView finished={[wo(ex('Bench Press', 100), ex('Squat', 120))]} body={body()} />,
    );
    expect(two.container.querySelector('#std-total .std-badge.todo')).toBeTruthy();
    two.unmount();
    const three = render(
      <StandardsView
        finished={[wo(ex('Bench Press', 100), ex('Squat', 120), ex('Deadlift', 150))]}
        body={body()}
      />,
    );
    expect(three.container.querySelector('#std-total .std-best .num')!.textContent).toBe('382'); // e1RM sum: 103.3 + 124 + 154.9
  });

  it('uses the female table and label for female profiles', () => {
    const { container } = render(<StandardsView finished={[]} body={body({ sex: 'female' })} />);
    const bodyVals = [...container.querySelectorAll('.std-body-val')].map((e) => e.textContent);
    expect(bodyVals).toEqual(['80 kg', 'Female']);
    const m = render(<StandardsView finished={[]} body={body()} />);
    expect([...m.container.querySelectorAll('.std-body-val')].map((e) => e.textContent)[1]).toBe(
      'Male',
    );
  });

  it('offers a profile edit link', () => {
    render(<StandardsView finished={[]} body={body()} />);
    expect(document.querySelector('a.std-editlink')!.getAttribute('href')).toBe('#/profile/me');
  });
});
