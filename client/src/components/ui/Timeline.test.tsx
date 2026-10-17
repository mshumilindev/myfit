import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { Timeline, TimelineDate, type TimelineRowSpec } from './Timeline';

afterEach(cleanup);

describe('Timeline', () => {
  it('is a labelled list with one listitem per row', () => {
    const rows: TimelineRowSpec[] = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B', sub: 'sub', value: '3 d' },
    ];
    render(<Timeline rows={rows} label="History" />);
    expect(screen.getByRole('list', { name: 'History' })).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[1]).getByText('sub').className).toBe('uitl-s');
    expect(within(items[1]).getByText('3 d').className).toBe('uitl-v');
    expect(items[0].querySelector('.uitl-s')).toBeNull();
    expect(items[0].querySelector('.uitl-v')).toBeNull();
  });

  it('renders an empty list for no rows', () => {
    render(<Timeline rows={[]} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('kind adds a row modifier except for item', () => {
    render(
      <Timeline
        rows={[
          { key: 'i', kind: 'item', label: 'i' },
          { key: 'm', kind: 'month', label: 'm' },
          { key: 'g', kind: 'gap', label: 'g' },
        ]}
      />,
    );
    const [item, month, gap] = screen.getAllByRole('listitem');
    expect(item.className).toBe('uitl-row');
    expect(month.className).toContain('uitl-row--month');
    expect(gap.className).toContain('uitl-row--gap');
  });

  it('rail variants draw their lines and markers; the rail is hidden from AT', () => {
    render(
      <Timeline
        rows={[
          { key: 's', label: 's' },
          { key: 'd', label: 'd', rail: 'dashed' },
          { key: 'n', label: 'n', rail: 'now' },
          { key: 'o', label: 'o', rail: 'origin' },
        ]}
      />,
    );
    const [s, d, n, o] = screen.getAllByRole('listitem');
    expect(s.querySelector('.uitl-rail')?.getAttribute('aria-hidden')).toBe('true');
    expect(s.querySelector('.uitl-line')?.className).toBe('uitl-line');
    expect(d.querySelector('.uitl-line')?.className).toContain('is-dashed');
    expect(n.querySelectorAll('.uitl-line')).toHaveLength(2);
    expect(n.querySelector('.to-mid')?.className).toContain('is-dashed');
    expect(n.querySelector('.from-mid')).not.toBeNull();
    expect(n.querySelector('.uitl-now')).not.toBeNull();
    expect(o.querySelector('.uitl-line.to-mid')).not.toBeNull();
    expect(o.querySelector('.uitl-end')).not.toBeNull();
    expect(s.querySelector('.uitl-now, .uitl-end')).toBeNull();
  });

  it('bars encode lane, edges, fade and tone', () => {
    render(
      <Timeline
        rows={[
          {
            key: 'b',
            label: 'b',
            bars: [
              { tone: 'illness', lane: 'single' },
              { tone: 'injury', lane: 0, top: 'edge', bottom: 'edge', faded: true },
              { tone: 'sleep', lane: 1, top: 'mid' },
            ],
          },
        ]}
      />,
    );
    const bars = document.querySelectorAll('.uitl-bar');
    expect(bars).toHaveLength(3);
    expect(bars[0].className).toContain('uitl-bar--s');
    expect(bars[0].className).toContain('top-inset');
    expect(bars[0].className).toContain('bot-inset');
    expect(bars[0].className).toContain('uit--illness');
    expect(bars[0].className).not.toContain('is-faded');
    expect(bars[1].className).toContain('uitl-bar--a');
    expect(bars[1].className).toContain('top-edge');
    expect(bars[1].className).toContain('bot-edge');
    expect(bars[1].className).toContain('is-faded');
    expect(bars[2].className).toContain('uitl-bar--b');
    expect(bars[2].className).toContain('top-mid');
  });

  it('strong emphasises the label and body', () => {
    render(<Timeline rows={[{ key: 'n', label: 'Now', strong: true }]} />);
    expect(screen.getByText('Now').className).toContain('is-strong');
    expect(document.querySelector('.uitl-body')?.className).toContain('is-strong');
  });
});

describe('TimelineDate', () => {
  it('shows day over weekday for a single day', () => {
    const { container } = render(<TimelineDate day="12" weekday="Mon" />);
    expect(container.querySelectorAll('.uitl-d')).toHaveLength(1);
    expect(container.querySelector('b')?.textContent).toBe('12');
    expect(screen.getByText('Mon')).toBeTruthy();
  });

  it('shows the start day below for a range', () => {
    const { container } = render(
      <TimelineDate day="12" weekday="Mon" startDay="3" startWeekday="Fri" />,
    );
    const ds = container.querySelectorAll('.uitl-d');
    expect(ds).toHaveLength(2);
    expect(ds[1].textContent).toBe('3Fri');
  });

  it('text replaces the day layout, with optional emphasis', () => {
    const { container, rerender } = render(<TimelineDate text="Later" day="1" />);
    expect(container.querySelector('.uitl-d')).toBeNull();
    expect(screen.getByText('Later').className).toBe('uitl-dtext');
    rerender(<TimelineDate text="Now" emphasis />);
    expect(screen.getByText('Now').className).toContain('is-em');
  });
});
