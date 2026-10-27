import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemePreviewDock } from './ThemePreviewDock';

afterEach(cleanup);

const props = {
  themeName: 'Cyberpunk',
  newLabel: 'New',
  hint: 'Nothing is saved until you confirm.',
  label: 'Theme preview',
  keepLabel: 'Keep current',
  useLabel: 'Use Cyberpunk',
};

describe('ThemePreviewDock', () => {
  it('is a labelled region (not a modal dialog) with the name, the New tag and the hint', () => {
    render(<ThemePreviewDock {...props} onKeep={vi.fn()} onUse={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Theme preview' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Cyberpunk')).toBeTruthy();
    expect(screen.getByText('New').className).toContain('uitag');
    expect(screen.getByText(props.hint)).toBeTruthy();
  });

  it('Keep and Use call their own handler once', () => {
    const onKeep = vi.fn();
    const onUse = vi.fn();
    render(<ThemePreviewDock {...props} onKeep={onKeep} onUse={onUse} />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep current' }));
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onUse).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use Cyberpunk' }));
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('has no scrim and no backdrop that could swallow taps', () => {
    const { container } = render(<ThemePreviewDock {...props} onKeep={vi.fn()} onUse={vi.fn()} />);
    expect(container.querySelector('.scrim, .dialog-scrim')).toBeNull();
  });
});
