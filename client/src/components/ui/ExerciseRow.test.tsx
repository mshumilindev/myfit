import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExerciseRow } from './ExerciseRow';

afterEach(cleanup);

describe('ExerciseRow', () => {
  it('bare exercise: name and picture only, no sub line', () => {
    const { container } = render(<ExerciseRow name="Squat" />);
    expect(screen.getByText('Squat')).toBeTruthy();
    expect(container.querySelector('.uirow-s')).toBeNull();
    expect(container.querySelector('.uitile')).not.toBeNull();
    expect(container.firstElementChild?.tagName).toBe('DIV');
  });

  it('renders the image, sub and prescription lines', () => {
    const { container } = render(
      <ExerciseRow name="Squat" image="/s.png" sub="Quads" prescription="3 x 6 · RPE 8" />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/s.png');
    expect(container.querySelector('.uiex-sub')?.textContent).toBe('Quads');
    expect(container.querySelector('.uiex-rx')?.textContent).toBe('3 x 6 · RPE 8');
  });

  it('prescription alone renders without the sub span', () => {
    const { container } = render(<ExerciseRow name="Squat" prescription="3 x 6" />);
    expect(container.querySelector('.uiex-sub')).toBeNull();
    expect(container.querySelector('.uiex-rx')).not.toBeNull();
  });

  it('shows the superset badge', () => {
    render(<ExerciseRow name="Squat" badge="A1" />);
    expect(screen.getByText('A1').className).toBe('uiex-badge');
  });

  it('is dense and strong by default; dense=false drops it', () => {
    const { container, rerender } = render(<ExerciseRow name="Squat" />);
    const row = () => container.firstElementChild as HTMLElement;
    expect(row().className).toContain('uirow--dense');
    expect(row().className).toContain('uirow--strong');
    rerender(<ExerciseRow name="Squat" dense={false} />);
    expect(row().className).not.toContain('uirow--dense');
  });

  it('onClick makes it a button that fires; selected and aria pass through', () => {
    const onClick = vi.fn();
    render(
      <ExerciseRow
        name="Squat"
        onClick={onClick}
        selected
        aria-label="Pick Squat"
        aria-pressed
        chevron
      />,
    );
    const btn = screen.getByRole('button', { name: 'Pick Squat' });
    expect(btn.className).toContain('is-selected');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(btn.querySelector('.uirow-chev')).not.toBeNull();
  });

  it('drops aria-pressed when the row is not a button', () => {
    const { container } = render(<ExerciseRow name="Squat" aria-pressed />);
    expect(container.firstElementChild?.getAttribute('aria-pressed')).toBeNull();
  });

  it('thumb size reaches the picture and trailing renders', () => {
    const { container } = render(
      <ExerciseRow name="Squat" image="/s.png" thumb={56} trailing={<i data-testid="tr" />} />,
    );
    expect(
      (container.querySelector('img') as HTMLElement).style.getPropertyValue('--uithumb'),
    ).toBe('56px');
    expect(screen.getByTestId('tr')).toBeTruthy();
  });
});
