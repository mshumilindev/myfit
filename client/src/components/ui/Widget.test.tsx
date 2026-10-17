import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  Widget,
  WidgetBar,
  WidgetBars,
  WidgetDelta,
  WidgetDots,
  WidgetEmpty,
  WidgetList,
  WidgetRing,
  WidgetSpark,
  WidgetStats,
  WIDGET_SIZES,
} from './Widget';

afterEach(cleanup);

describe('Widget', () => {
  it.each(WIDGET_SIZES)('size %s maps to a class; neutral tone by default', (size) => {
    const { container } = render(<Widget size={size} title="t" />);
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain(`uiw--${size.toLowerCase()}`);
    expect(cls).toContain('uit--neutral');
    expect(cls).not.toContain('is-clickable');
    cleanup();
  });

  it('S/L/XL render kicker, badge, value + unit, title, sub and footer', () => {
    const { container } = render(
      <Widget
        size="S"
        tone="ok"
        kicker="Streak"
        badge="+2"
        value="12"
        unit="days"
        title="Name"
        sub="so far"
        footer={<button>Go</button>}
      />,
    );
    expect(container.querySelector('.uit--ok')).not.toBeNull();
    expect(screen.getByText('Streak').className).toBe('uiw-kicker');
    expect(screen.getByText('+2').className).toBe('uiw-badge');
    expect(container.querySelector('.uiw-value')?.textContent).toBe('12days');
    expect(screen.getByText('days').className).toBe('uiw-unit');
    expect(screen.getByText('Name').className).toBe('uiw-name');
    expect(screen.getByText('so far').className).toBe('uiw-sub');
    expect(container.querySelector('.uiw-footer button')).not.toBeNull();
  });

  it('renders no head, headline, body or footer when empty', () => {
    const { container } = render(<Widget size="L" />);
    for (const c of ['.uiw-head', '.uiw-headline', '.uiw-body', '.uiw-footer'])
      expect(container.querySelector(c)).toBeNull();
  });

  it('body goes before the headline unless bodyLast', () => {
    const { container, rerender } = render(
      <Widget size="L" value="1">
        <i data-testid="b" />
      </Widget>,
    );
    const order = () => Array.from(container.firstElementChild!.children).map((c) => c.className);
    expect(order()).toEqual(['uiw-body', 'uiw-headline']);
    rerender(
      <Widget size="L" value="1" bodyLast>
        <i data-testid="b" />
      </Widget>,
    );
    expect(order()).toEqual(['uiw-headline', 'uiw-body']);
  });

  it('onClick adds a hit button named by ariaLabel, or by a string title', () => {
    const onClick = vi.fn();
    const { rerender, container } = render(
      <Widget size="S" title="Weight" ariaLabel="Open weight" onClick={onClick} />,
    );
    expect((container.firstChild as HTMLElement).className).toContain('is-clickable');
    fireEvent.click(screen.getByRole('button', { name: 'Open weight' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<Widget size="S" title="Weight" onClick={onClick} />);
    expect(screen.getByRole('button', { name: 'Weight' })).toBeTruthy();
    rerender(<Widget size="S" title="Weight" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('M is a row: title falls back to value + unit, sub and an icon tile', () => {
    const { container } = render(<Widget size="M" icon="moon" value="7.5" unit="h" sub="Sleep" />);
    expect(container.querySelector('.uiw-title')?.textContent).toBe('7.5h');
    expect(screen.getByText('Sleep').className).toBe('uiw-sub');
    expect(container.querySelector('.uiw-kicker')).toBeNull();
    expect(container.querySelector('.uiw-mid')).not.toBeNull();
  });

  it('M: title wins over value; trailing is shown; clickable gets a chevron only without trailing', () => {
    const { container, rerender } = render(
      <Widget size="M" title="T" value="9" unit="u" onClick={() => {}} />,
    );
    expect(container.querySelector('.uiw-title')?.textContent).toBe('T');
    expect(container.querySelector('.uiw-go')?.getAttribute('aria-hidden')).toBe('true');
    rerender(<Widget size="M" title="T" trailing={<b>chip</b>} onClick={() => {}} />);
    expect(container.querySelector('.uiw-trailing')?.textContent).toBe('chip');
    expect(container.querySelector('.uiw-go')).toBeNull();
    rerender(<Widget size="M" title="T" />);
    expect(container.querySelector('.uiw-go')).toBeNull();
    expect(container.querySelector('.uiw-trailing')).toBeNull();
  });

  it('passes style and className to the frame', () => {
    const { container } = render(<Widget size="S" className="x" style={{ width: 120 }} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('x');
    expect(el.style.width).toBe('120px');
  });
});

describe('Widget building blocks', () => {
  it('WidgetBar clamps the fill to 0-100% and takes height and tone', () => {
    const { container, rerender } = render(<WidgetBar value={0.4} tone="ok" height={8} />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.className).toContain('uit--ok');
    expect(bar.style.height).toBe('8px');
    expect((bar.firstChild as HTMLElement).style.width).toBe('40%');
    rerender(<WidgetBar value={3} />);
    expect(((container.firstChild as HTMLElement).firstChild as HTMLElement).style.width).toBe(
      '100%',
    );
    rerender(<WidgetBar value={-1} />);
    expect(((container.firstChild as HTMLElement).firstChild as HTMLElement).style.width).toBe(
      '0%',
    );
  });

  it('WidgetRing draws a clamped arc, sizes itself and shows its label', () => {
    const c = 2 * Math.PI * 24;
    const { container } = render(
      <WidgetRing value={0.5} size={60} tone="sleep">
        50%
      </WidgetRing>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.width).toBe('60px');
    expect(root.className).toContain('uit--sleep');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.uiw-ring-fill')?.getAttribute('stroke-dasharray')).toBe(
      `${c / 2} ${c}`,
    );
    expect(screen.getByText('50%').className).toBe('uiw-ring-label');
  });

  it('WidgetSpark renders nothing under two points, otherwise a line (and optional area)', () => {
    const { container, rerender } = render(<WidgetSpark points={[1]} />);
    expect(container.firstChild).toBeNull();
    rerender(<WidgetSpark points={[1, 3, 2]} />);
    expect(container.querySelector('.uiw-spark-line')).not.toBeNull();
    expect(container.querySelector('.uiw-spark-area')).toBeNull();
    rerender(<WidgetSpark points={[1, 3, 2]} area tone="kcal" />);
    expect(container.querySelector('.uiw-spark-area')).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('uit--kcal');
  });

  it('WidgetSpark copes with a flat series', () => {
    const { container } = render(<WidgetSpark points={[5, 5, 5]} />);
    expect(container.querySelector('.uiw-spark-line')?.getAttribute('d')).not.toContain('NaN');
  });

  it('WidgetBars highlights chosen columns and shows labels', () => {
    const { container, rerender } = render(
      <WidgetBars values={[1, 2, 4]} highlight={[2]} labels={['a', 'b', 'c']} />,
    );
    const cols = container.querySelectorAll('.uiw-bars-cols > span');
    expect(cols).toHaveLength(3);
    expect(cols[2].className).toBe('is-on');
    expect(cols[0].className).toBe('');
    expect((cols[2] as HTMLElement).style.height).toBe('100%');
    expect((cols[0] as HTMLElement).style.height).toBe('25%');
    expect(screen.getByText('b')).toBeTruthy();
    rerender(<WidgetBars values={[0, 0]} />);
    expect(container.querySelector('.uiw-bars-labels')).toBeNull();
    expect((container.querySelector('.uiw-bars-cols > span') as HTMLElement).style.height).toBe(
      '4%',
    );
  });

  it('WidgetList renders label, optional value and optional icon tile', () => {
    const { container } = render(
      <WidgetList
        rows={[{ label: 'Squat', value: '100 kg', icon: 'barbell' }, { label: 'Rest' }]}
      />,
    );
    const rows = container.querySelectorAll('.uiw-list-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.uiw-list-value')?.textContent).toBe('100 kg');
    expect(rows[1].querySelector('.uiw-list-value')).toBeNull();
    expect(rows[1].children).toHaveLength(1);
    expect(rows[0].children).toHaveLength(3);
  });

  it('WidgetStats renders label / value pairs', () => {
    render(<WidgetStats items={[{ label: 'Bedtime', value: '23:00' }]} />);
    expect(screen.getByText('Bedtime').className).toBe('uiw-stat-label');
    expect(screen.getByText('23:00').className).toBe('uiw-stat-value');
  });

  it('WidgetDelta: minus sign is bad, otherwise good; `good` overrides', () => {
    const { rerender } = render(<WidgetDelta>+1.2</WidgetDelta>);
    expect(screen.getByText('+1.2').className).toBe('uiw-delta is-good');
    rerender(<WidgetDelta>−1.2</WidgetDelta>);
    expect(screen.getByText('−1.2').className).toBe('uiw-delta is-bad');
    rerender(<WidgetDelta good>−1.2</WidgetDelta>);
    expect(screen.getByText('−1.2').className).toBe('uiw-delta is-good');
    rerender(<WidgetDelta good={false}>+1</WidgetDelta>);
    expect(screen.getByText('+1').className).toBe('uiw-delta is-bad');
  });

  it('WidgetDots marks the on days', () => {
    const { container } = render(<WidgetDots values={[true, false, true]} height={12} tone="ok" />);
    const dots = container.querySelectorAll('.uiw-dots > span');
    expect(dots).toHaveLength(3);
    expect(dots[0].className).toBe('is-on');
    expect(dots[1].className).toBe('');
    expect((dots[0] as HTMLElement).style.height).toBe('12px');
    expect((container.firstChild as HTMLElement).className).toContain('uit--ok');
  });
});

describe('WidgetEmpty', () => {
  it('S shows kicker and title but neither sub nor action', () => {
    render(
      <WidgetEmpty
        size="S"
        icon="moon"
        kicker="Sleep"
        title="No data"
        sub="hidden"
        action="Log"
        onAction={() => {}}
      />,
    );
    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getByText('No data')).toBeTruthy();
    expect(screen.queryByText('hidden')).toBeNull();
    expect(screen.queryByText('Log')).toBeNull();
  });

  it('L shows sub and a primary action that fires onAction', () => {
    const onAction = vi.fn();
    render(
      <WidgetEmpty
        size="L"
        icon="moon"
        kicker="Sleep"
        title="No data"
        sub="Add one"
        action="Log"
        onAction={onAction}
      />,
    );
    expect(screen.getByText('Add one')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('without onAction there is no action button and the card is not clickable', () => {
    const { container } = render(
      <WidgetEmpty size="L" icon="moon" kicker="Sleep" title="No data" action="Log" />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect((container.firstChild as HTMLElement).className).not.toContain('is-clickable');
  });

  it('XL adds the centred art tile', () => {
    const { container } = render(
      <WidgetEmpty size="XL" icon="moon" kicker="Sleep" title="No data" />,
    );
    expect(container.querySelector('.uiw-empty-art')).not.toBeNull();
  });

  it('M is a row with an icon-only "+" action named by the action label', () => {
    const onAction = vi.fn();
    const { container } = render(
      <WidgetEmpty
        size="M"
        icon="moon"
        kicker="k"
        title="No data"
        action="Add sleep"
        onAction={onAction}
      />,
    );
    expect(container.querySelector('.uiw--m')).not.toBeNull();
    expect(container.querySelector('.uiw-kicker')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add sleep' }));
    expect(onAction).toHaveBeenCalled();
  });
});
