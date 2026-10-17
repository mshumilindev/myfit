import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PresetChips } from './PresetChips';

afterEach(cleanup);

const items = [
  { id: 'a', label: 'Today', selected: true },
  { id: 'b', label: 'Week' },
  { id: 'c', label: 'Month', disabled: true },
];

describe('PresetChips', () => {
  it('renders a labelled group of toggle buttons with aria-pressed', () => {
    render(<PresetChips items={items} label="Range" />);
    expect(screen.getByRole('group', { name: 'Range' })).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(buttons[0].className).toContain('is-on');
    expect(buttons[1].className).not.toContain('is-on');
  });

  it('click calls the chip handler; disabled chips do not', () => {
    const a = vi.fn();
    const c = vi.fn();
    render(
      <PresetChips
        items={[
          { id: 'a', label: 'A', onClick: a },
          { id: 'c', label: 'C', disabled: true, onClick: c },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('A'));
    fireEvent.click(screen.getByText('C'));
    expect(a).toHaveBeenCalledTimes(1);
    expect(c).not.toHaveBeenCalled();
    expect((screen.getByText('C') as HTMLButtonElement).disabled).toBe(true);
  });

  it('defaults: wrap layout, sm size, accent tone', () => {
    render(<PresetChips items={items} label="x" />);
    const cls = screen.getByRole('group').className;
    expect(cls).toContain('uipc--wrap');
    expect(cls).toContain('uipc--sm');
    expect(cls).toContain('uit--accent');
  });

  it('layout, size and tone map to classes; grid sets the column count', () => {
    render(<PresetChips items={items} label="x" layout="grid" size="lg" tone="ok" />);
    const el = screen.getByRole('group');
    expect(el.className).toContain('uipc--grid');
    expect(el.className).toContain('uipc--lg');
    expect(el.className).toContain('uit--ok');
    expect(el.style.getPropertyValue('--uipc-cols')).toBe('3');
  });

  it('non-grid layouts set no column variable', () => {
    render(<PresetChips items={items} label="x" layout="scroll" />);
    expect(screen.getByRole('group').style.getPropertyValue('--uipc-cols')).toBe('');
  });

  it('readOnly renders a list of items with no buttons', () => {
    render(
      <PresetChips
        readOnly
        label="Week"
        layout="grid"
        items={[
          { id: 'm', label: 'M', selected: true, ariaLabel: 'Mon, training' },
          { id: 't', label: 'T' },
        ]}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    const list = screen.getByRole('list', { name: 'Week' });
    expect(list.className).toContain('uipc--static');
    const li = screen.getAllByRole('listitem');
    expect(li).toHaveLength(2);
    expect(li[0].className).toContain('is-on');
    expect(li[0].getAttribute('aria-label')).toBe('Mon, training');
    expect(li[1].className).not.toContain('is-on');
  });
});
