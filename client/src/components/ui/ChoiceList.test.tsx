import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChoiceList, type ChoiceOption } from './ChoiceList';

afterEach(cleanup);

const options: ChoiceOption[] = [
  { id: 'a', title: 'Shift a week', description: 'Moves everything.', tag: 'Suggested' },
  { id: 'b', title: 'Skip the week', description: 'Drops it.' },
];

describe('ChoiceList', () => {
  it('is a labelled radiogroup with one radio per option', () => {
    render(<ChoiceList options={options} value={null} onChange={vi.fn()} label="Plan change" />);
    expect(screen.getByRole('radiogroup', { name: 'Plan change' })).toBeTruthy();
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(2);
    expect(radios.every((r) => !r.checked)).toBe(true);
  });

  it('the description is the accessible description of each radio', () => {
    render(<ChoiceList options={options} value={null} onChange={vi.fn()} label="L" />);
    const r = screen.getByRole('radio', { name: /Skip the week/ });
    const id = r.getAttribute('aria-describedby') as string;
    expect(document.getElementById(id)?.textContent).toBe('Drops it.');
  });

  it('marks the chosen one checked and selected, others not', () => {
    const { container } = render(
      <ChoiceList options={options} value="b" onChange={vi.fn()} label="L" />,
    );
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.checked)).toEqual([false, true]);
    const cards = container.querySelectorAll('.uichoice-opt');
    expect(cards[0].className).not.toContain('uicard--selected');
    expect(cards[1].className).toContain('uicard--selected');
    expect(cards[1].className).toContain('uicard--accent');
  });

  it('shows the tag only on options that have one', () => {
    render(<ChoiceList options={options} value={null} onChange={vi.fn()} label="L" />);
    expect(screen.getAllByText('Suggested')).toHaveLength(1);
  });

  it('choosing an option reports its id', () => {
    const onChange = vi.fn();
    render(<ChoiceList options={options} value="a" onChange={onChange} label="L" />);
    fireEvent.click(screen.getByRole('radio', { name: /Skip the week/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('locked: no radios, others dim, the picked card stays, group is flagged', () => {
    const { container } = render(
      <ChoiceList options={options} value="a" onChange={vi.fn()} label="L" locked />,
    );
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('radiogroup').className).toContain('is-locked');
    const cards = container.querySelectorAll('.uichoice-opt');
    expect(cards[0].className).not.toContain('is-dim');
    expect(cards[1].className).toContain('is-dim');
    expect(screen.getByText('Skip the week')).toBeTruthy();
  });

  it('renders an empty group for no options and merges className', () => {
    render(<ChoiceList options={[]} value={null} onChange={vi.fn()} label="L" className="mine" />);
    const g = screen.getByRole('radiogroup');
    expect(g.children).toHaveLength(0);
    expect(g.className).toContain('mine');
  });
});
