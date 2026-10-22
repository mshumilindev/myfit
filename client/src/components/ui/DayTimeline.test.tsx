import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DayTimelineDay } from './DayTimeline';

afterEach(cleanup);

describe('DayTimelineDay', () => {
  it('maps the tone to the tone class and shows date and children', () => {
    const { container } = render(
      <DayTimelineDay tone="danger" date="FRI · SEP 25 · MISSED">
        <p>card</p>
      </DayTimelineDay>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('uidt-day');
    expect(root.className).toContain('uit--danger');
    expect(screen.getByText('FRI · SEP 25 · MISSED')).toBeTruthy();
    expect(screen.getByText('card')).toBeTruthy();
  });

  it('draws a plain dot without an icon', () => {
    const { container } = render(<DayTimelineDay tone="ok" date="d" />);
    expect(container.querySelector('.uidt-dot')).not.toBeNull();
    expect(container.querySelector('.uidt-node')).toBeNull();
  });

  it('draws a named node when an icon is given', () => {
    const { container } = render(
      <DayTimelineDay tone="rest" icon="moon" nodeLabel="Rest day" date="d" />,
    );
    const node = container.querySelector('.uidt-node') as HTMLElement;
    expect(node.getAttribute('aria-label')).toBe('Rest day');
    expect(node.getAttribute('title')).toBe('Rest day');
    expect(container.querySelector('.uidt-dot')).toBeNull();
  });

  it('adds is-last and is-today only when set', () => {
    const { container, rerender } = render(<DayTimelineDay tone="ok" date="d" />);
    const root = () => container.firstChild as HTMLElement;
    expect(root().className).not.toContain('is-last');
    expect(root().className).not.toContain('is-today');
    rerender(<DayTimelineDay tone="ok" date="d" isLast isToday className="extra" />);
    expect(root().className).toContain('is-last');
    expect(root().className).toContain('is-today');
    expect(root().className).toContain('extra');
  });

  it('renders the aside only when given', () => {
    const { container, rerender } = render(<DayTimelineDay tone="ok" date="d" />);
    expect(container.querySelector('.uidt-aside')).toBeNull();
    rerender(<DayTimelineDay tone="ok" date="d" aside="52 min" />);
    expect(container.querySelector('.uidt-aside')?.textContent).toBe('52 min');
  });
});
