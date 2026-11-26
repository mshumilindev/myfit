import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockCountdown } from './BlockCountdown';

afterEach(cleanup);
const base = {
  title: '12 min · target 8 rounds',
  goLabel: 'GO',
  hint: 'Get in position',
  cancelLabel: 'Cancel',
  ariaLabel: 'Get ready',
  onCancel: () => {},
};

describe('BlockCountdown', () => {
  it('shows the digit, the title and the hint in a modal dialog', () => {
    render(<BlockCountdown {...base} n={5} />);
    const d = screen.getByRole('dialog', { name: 'Get ready' });
    expect(d.textContent).toContain('5');
    expect(d.textContent).toContain('12 min · target 8 rounds');
    expect(d.className).not.toContain('uicd--last');
  });
  it('warns on the last three seconds and turns green on GO', () => {
    const { rerender } = render(<BlockCountdown {...base} n={3} />);
    expect(screen.getByRole('dialog').className).toContain('uicd--last');
    rerender(<BlockCountdown {...base} n={0} go hint="Clock running" />);
    const d = screen.getByRole('dialog');
    expect(d.className).toContain('uicd--go');
    expect(d.className).not.toContain('uicd--last');
    expect(d.textContent).toContain('GO');
    expect(d.textContent).toContain('Clock running');
  });
  it('fills one dot per second left; all on GO', () => {
    const { container, rerender } = render(<BlockCountdown {...base} n={2} />);
    expect(container.querySelectorAll('.uicd-dots i.on')).toHaveLength(4); // 5,4,3 and 2 are lit: elapsed + current
    rerender(<BlockCountdown {...base} n={0} go />);
    expect(container.querySelectorAll('.uicd-dots i.on')).toHaveLength(5);
  });
  it('Cancel and tap-to-skip call back', async () => {
    const onCancel = vi.fn();
    const onSkip = vi.fn();
    render(<BlockCountdown {...base} n={4} onCancel={onCancel} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('progressbar'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
