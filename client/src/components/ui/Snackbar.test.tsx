import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Snackbar } from './Snackbar';

afterEach(cleanup);

describe('Snackbar', () => {
  it('is a polite status with fixed position and the ok tone by default', () => {
    render(<Snackbar text="Saved" />);
    const el = screen.getByRole('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.className).toContain('uisnack--fixed');
    expect(el.className).toContain('uit--ok');
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(el.querySelector('.uisnack-s')).toBeNull();
    expect(el.querySelector('button')).toBeNull();
  });

  it('renders the sub line inside the text block', () => {
    render(<Snackbar text="Dance" sub="120 min logged" />);
    expect(screen.getByText('120 min logged').className).toBe('uisnack-s');
  });

  it('inline position and custom tone / className', () => {
    render(<Snackbar text="x" position="inline" tone="danger" className="mine" />);
    const cls = screen.getByRole('status').className;
    expect(cls).toContain('uisnack--inline');
    expect(cls).toContain('uit--danger');
    expect(cls).toContain('mine');
  });

  it('tone="inherit" adds no tone class', () => {
    render(<Snackbar text="x" tone="inherit" />);
    expect(screen.getByRole('status').className).not.toContain('uit--');
  });

  it('action button fires its handler and can carry a fuller aria-label', () => {
    const onClick = vi.fn();
    render(
      <Snackbar
        text="Logged"
        action={{ label: 'Undo', ariaLabel: 'Undo logging Dance', onClick }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Undo logging Dance' });
    expect(btn.textContent).toBe('Undo');
    expect(btn.getAttribute('type')).toBe('button');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('action without ariaLabel is named by its label', () => {
    render(<Snackbar text="Logged" action={{ label: 'Undo', onClick: () => {} }} />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });
});
