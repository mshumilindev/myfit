import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeSwatch, ThemeSwatchGrid } from './ThemeSwatch';

afterEach(cleanup);

const base = { name: 'Lime', light: '#9bd600', dark: '#c8ff2e', lightLabel: 'L', darkLabel: 'D' };

describe('ThemeSwatch', () => {
  it('is a radio in a radiogroup and reflects selected', () => {
    const { rerender } = render(
      <ThemeSwatchGrid label="Accent colour">
        <ThemeSwatch {...base} selected={false} onSelect={() => undefined} />
      </ThemeSwatchGrid>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Accent colour' })).toBeTruthy();
    const radio = screen.getByRole('radio');
    expect(radio.getAttribute('aria-checked')).toBe('false');
    expect(radio.className).not.toContain('is-selected');
    rerender(
      <ThemeSwatchGrid label="Accent colour">
        <ThemeSwatch {...base} selected onSelect={() => undefined} />
      </ThemeSwatchGrid>,
    );
    const on = screen.getByRole('radio');
    expect(on.getAttribute('aria-checked')).toBe('true');
    expect(on.className).toContain('is-selected');
  });

  it('shows the name and both codes in upper case with their labels', () => {
    render(<ThemeSwatch {...base} selected={false} onSelect={() => undefined} />);
    expect(screen.getByText('Lime')).toBeTruthy();
    expect(screen.getByText('#9BD600')).toBeTruthy();
    expect(screen.getByText('#C8FF2E')).toBeTruthy();
  });

  it('passes both colours to the diagonal split and selects on click', () => {
    const onSelect = vi.fn();
    render(<ThemeSwatch {...base} selected={false} onSelect={onSelect} />);
    const radio = screen.getByRole('radio');
    expect(radio.style.getPropertyValue('--sw-light')).toBe('#9bd600');
    expect(radio.style.getPropertyValue('--sw-dark')).toBe('#c8ff2e');
    fireEvent.click(radio);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
