import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Select } from './Select';

afterEach(cleanup);

const options = (
  <>
    <option value="a">All gyms</option>
    <option value="b">North</option>
  </>
);

describe('Select', () => {
  it('stacks the label above the well and names the select by it', () => {
    const { container } = render(<Select label="Gym">{options}</Select>);
    expect(screen.getByRole('combobox', { name: /Gym/ })).toBeTruthy();
    expect(container.querySelector('.uifield-l')?.textContent).toBe('Gym');
    expect(container.querySelector('.uifield-pre')).toBeNull();
    expect((container.firstChild as HTMLElement).className).toContain('uifield--md');
  });

  it('labelInline puts the label inside the well and sets aria-label', () => {
    const { container } = render(
      <Select label="Gym" labelInline>
        {options}
      </Select>,
    );
    expect(container.querySelector('.uifield-l')).toBeNull();
    expect(container.querySelector('.uifield-box .uifield-pre')?.textContent).toBe('Gym');
    expect((container.firstChild as HTMLElement).className).toContain('uifield--inline');
    expect(screen.getByRole('combobox').getAttribute('aria-label')).toBe('Gym');
  });

  it('labelInline without a label behaves as a plain select', () => {
    const { container } = render(<Select labelInline>{options}</Select>);
    expect((container.firstChild as HTMLElement).className).not.toContain('uifield--inline');
    expect(screen.getByRole('combobox').hasAttribute('aria-label')).toBe(false);
  });

  it('error replaces the hint, is an alert and marks the select invalid', () => {
    const { container } = render(
      <Select label="Gym" hint="Pick one" error="Required">
        {options}
      </Select>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Required');
    expect(screen.queryByText('Pick one')).toBeNull();
    expect(screen.getByRole('combobox').getAttribute('aria-invalid')).toBe('true');
    expect((container.firstChild as HTMLElement).className).toContain('uifield--err');
  });

  it('shows the hint when there is no error', () => {
    render(
      <Select label="Gym" hint="Pick one">
        {options}
      </Select>,
    );
    expect(screen.getByText('Pick one').className).toContain('uifield-hint');
    expect(screen.getByRole('combobox').hasAttribute('aria-invalid')).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('maps size, forwards ref and fires onChange / disabled', () => {
    const ref = createRef<HTMLSelectElement>();
    const onChange = vi.fn();
    const { container, rerender } = render(
      <Select ref={ref} size="sm" onChange={onChange} aria-label="G">
        {options}
      </Select>,
    );
    expect((container.firstChild as HTMLElement).className).toContain('uifield--sm');
    expect(ref.current).toBe(screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(ref.current?.value).toBe('b');
    rerender(
      <Select ref={ref} disabled aria-label="G">
        {options}
      </Select>,
    );
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
  });
});
