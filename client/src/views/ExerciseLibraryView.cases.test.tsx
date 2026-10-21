import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExerciseLibraryView } from './ExerciseLibraryView';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { makeShell, reseed, setDesktop } from './__fixtures__/viewKit';

beforeEach(() => {
  setLocale('en');
  reseed();
  setDesktop(false);
});
afterEach(cleanup);

describe('ExerciseLibraryView', () => {
  it('is a tab titled "Exercises" that hosts the gallery in library mode', () => {
    const { container } = render(
      <ExerciseLibraryView shell={makeShell()} libTab="library" onLibTab={() => undefined} />,
    );
    expect(screen.getAllByText(en.exercisesTabLabel).length).toBeGreaterThan(0);
    expect(container.querySelector('.exg-tabwrap')).toBeTruthy();
    expect(container.querySelector('.exl-head h2')?.textContent).toBe(en.exercisesTitle);
  });

  it('switching to "My exercises" reports the tab to the parent, which owns the state', () => {
    const onLibTab = vi.fn();
    render(<ExerciseLibraryView shell={makeShell()} libTab="library" onLibTab={onLibTab} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.libTabMine) }));
    expect(onLibTab).toHaveBeenCalledWith('mine');
  });

  it('the controlled tab decides what is shown', () => {
    const { container } = render(
      <ExerciseLibraryView shell={makeShell()} libTab="mine" onLibTab={() => undefined} />,
    );
    expect(container.querySelector('.exl-head h2')?.textContent).toBe(en.libTabMine);
  });
});
