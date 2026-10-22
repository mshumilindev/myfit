import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setViewport } from '../../coach/testViewport';
import { ConsentPrompt } from './ConsentPrompt';
import { ConsentRow } from './ConsentRow';

afterEach(cleanup);

const base = {
  icon: 'sparkle',
  title: 'Turn on Atlas AI',
  lead: 'Your messages go to a model provider.',
  facts: [
    { icon: 'database', label: 'What', sub: 'Your question' },
    { icon: 'globe', label: 'Who', sub: 'Google' },
  ],
  factsLabel: 'Details',
  primary: 'Turn on',
  secondary: 'Not now',
  closeLabel: 'Close',
};

describe('ConsentPrompt', () => {
  it('is an alertdialog named by the title with a labelled facts list', () => {
    setViewport(390);
    render(<ConsentPrompt {...base} onPrimary={vi.fn()} onSecondary={vi.fn()} />);
    const dlg = screen.getByRole('alertdialog', { name: 'Turn on Atlas AI' });
    expect(within(dlg).getByRole('list', { name: 'Details' }).querySelectorAll('li')).toHaveLength(
      2,
    );
  });
  it('primary only reports the press; secondary and dismiss are "not now", never consent', async () => {
    setViewport(390);
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(<ConsentPrompt {...base} onPrimary={onPrimary} onSecondary={onSecondary} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onSecondary).toHaveBeenCalledTimes(2));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
  it('primary can be disabled (read gate)', () => {
    setViewport(390);
    const onPrimary = vi.fn();
    render(<ConsentPrompt {...base} primaryDisabled onPrimary={onPrimary} onSecondary={vi.fn()} />);
    const b = screen.getByRole('button', { name: 'Turn on' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(onPrimary).not.toHaveBeenCalled();
  });
});

describe('ConsentRow', () => {
  it('shows the state line and flips through the named switch', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ConsentRow
        icon="heart"
        label="Cycle tracking"
        sub="Dates"
        status="Not given"
        on={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('Not given')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Cycle tracking' }));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(
      <ConsentRow
        icon="heart"
        label="Cycle tracking"
        sub="Dates"
        status="Given · v1"
        on
        onChange={onChange}
      />,
    );
    expect(
      (screen.getByRole('switch', { name: 'Cycle tracking' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.getByText('Given · v1')).toBeTruthy();
  });
  it('disabled switch ignores input', () => {
    const onChange = vi.fn();
    render(
      <ConsentRow icon="heart" label="X" sub="s" status="Given" on disabled onChange={onChange} />,
    );
    const sw = screen.getByRole('switch', { name: 'X' }) as HTMLInputElement;
    expect(sw.disabled).toBe(true);
  });
});
