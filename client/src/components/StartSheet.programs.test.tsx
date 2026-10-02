import { setLocale } from '../i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { StartSheet } from './StartSheet';

const shell = (): Shell => ({
  openOverlay: vi.fn(),
  replaceOverlay: vi.fn(),
  goTab: vi.fn(),
  goPlaybook: vi.fn(),
  openStart: vi.fn(),
  toast: vi.fn(),
  snack: vi.fn(),
  signOut: vi.fn(),
  queueLength: 0,
});

beforeEach(() => setLocale('en'));

afterEach(cleanup);

describe('Start sheet · Programs entry', () => {
  it('has a Programs tile next to Home set that opens the Programs tab and closes the sheet', () => {
    const sh = shell();
    const onClose = vi.fn();
    render(<StartSheet shell={sh} onClose={onClose} />);
    const programs = screen.getByText('Programs').closest('button');
    const home = screen.getByText('Home set').closest('button');
    expect(programs?.parentElement).toBe(home?.parentElement);
    fireEvent.click(programs!);
    expect(sh.goTab).toHaveBeenCalledWith('programs');
    expect(onClose).toHaveBeenCalled();
  });
});
