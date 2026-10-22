import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Segmented, type SegmentedOption } from './Segmented';

afterEach(cleanup);

const opts: SegmentedOption<string>[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', disabled: true },
];

describe('Segmented', () => {
  it('is a labelled group of toggle buttons with aria-pressed on the selected one', () => {
    render(<Segmented options={opts} value="b" onChange={() => {}} label="Pick" />);
    expect(screen.getByRole('group', { name: 'Pick' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('fires onChange with the option value; a disabled option does not fire', () => {
    const onChange = vi.fn();
    render(<Segmented options={opts} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onChange).toHaveBeenCalledWith('a');
    fireEvent.click(screen.getByRole('button', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    for (const b of screen.getAllByRole('button')) {
      expect(b.getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('tabs mode uses tablist / tab / aria-selected instead of aria-pressed', () => {
    render(<Segmented options={opts} value="a" onChange={() => {}} tabs label="T" />);
    expect(screen.getByRole('tablist', { name: 'T' })).toBeTruthy();
    const tab = screen.getByRole('tab', { name: 'Alpha' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(tab.hasAttribute('aria-pressed')).toBe(false);
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('false');
  });

  it('maps variant, size, tone and layout flags to classes', () => {
    const { container } = render(
      <Segmented
        options={opts}
        value="a"
        onChange={() => {}}
        variant="buttons"
        size="lg"
        tone="rest"
        hug
        stacked
        className="x"
      />,
    );
    const cls = (container.firstChild as HTMLElement).className;
    for (const c of [
      'uiseg--buttons',
      'uiseg--lg',
      'uit--rest',
      'uiseg--hug',
      'uiseg--stack',
      'x',
    ]) {
      expect(cls).toContain(c);
    }
    expect(cls).not.toContain('uiseg--fill');
    expect(cls).not.toContain('uiseg--scroll');
  });

  it('defaults to equal columns; hug/fill/scroll drop the inline grid; 5+ options are dense', () => {
    const { container, rerender } = render(
      <Segmented options={opts} value="a" onChange={() => {}} />,
    );
    const root = () => container.firstChild as HTMLElement;
    expect(root().style.gridTemplateColumns).toContain('repeat(3');
    expect(root().className).toContain('uiseg--md');
    expect(root().className).not.toContain('is-dense');
    rerender(<Segmented options={opts} value="a" onChange={() => {}} fill />);
    expect(root().style.gridTemplateColumns).toBe('');
    expect(root().className).toContain('uiseg--fill');
    const five = ['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }));
    rerender(<Segmented options={five} value="1" onChange={() => {}} scroll />);
    expect(root().className).toContain('is-dense');
    expect(root().className).toContain('uiseg--scroll');
  });

  it('adds a numeric badge to the accessible name and hides zero', () => {
    render(
      <Segmented
        options={[
          { value: 1, label: 'Programs', badge: 3 },
          { value: 2, label: 'Plans', badge: 12 },
          { value: 3, label: 'Empty', badge: 0 },
          { value: 4, label: 'Custom', badge: 5, ariaLabel: 'Custom minutes' },
        ]}
        value={1}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Programs, 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Plans, 9+' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Empty' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Custom minutes' })).toBeTruthy();
  });

  it('renders icon, compact flag and a non-numeric badge node as given', () => {
    const { container } = render(
      <Segmented
        options={[
          { value: 'x', label: 'X', icon: 'check', compact: true, badge: <i data-testid="b" /> },
        ]}
        value="x"
        onChange={() => {}}
      />,
    );
    const btn = container.querySelector('.uiseg-opt') as HTMLElement;
    expect(btn.className).toContain('is-on');
    expect(btn.className).toContain('is-compact');
    expect(btn.querySelector('.ui-icon')).not.toBeNull();
    expect(screen.getByTestId('b')).toBeTruthy();
  });
});
