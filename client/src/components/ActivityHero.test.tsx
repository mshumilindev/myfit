import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActivityHero } from './ActivityHero';
import { setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests, liveActivity, startActivity } from '../store';

beforeEach(() => {
  setLocale('en');
  __replaceStateForTests({ ...__getStateForTests(), activities: [] });
});
afterEach(cleanup);

describe('ActivityHero', () => {
  it('shows the running activity with its clock, and opens it on tap', () => {
    const a = startActivity('running', 'conditioning')!;
    const onOpen = vi.fn();
    render(<ActivityHero activity={a} onOpen={onOpen} />);
    expect(screen.getByText(/^Live · /)).toBeTruthy();
    expect(screen.getByText('0:00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpen).toHaveBeenCalled();
  });

  it('pauses and resumes from the band', () => {
    const a = startActivity('yoga', 'recovery')!;
    const { rerender } = render(<ActivityHero activity={a} onOpen={() => undefined} />);
    expect(document.querySelector('.activity-live-hero.cat-recovery')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    const paused = liveActivity()!;
    expect(paused.runningSince).toBeFalsy();
    rerender(<ActivityHero activity={paused} onOpen={() => undefined} />);
    expect(screen.getByText(/^Paused · /)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(liveActivity()!.runningSince).toBeTruthy();
  });
});
