import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SECTION_LAYOUTS, WidgetGrid, WidgetSection } from './WidgetGrid';

afterEach(cleanup);

describe('SECTION_LAYOUTS', () => {
  it('lists every layout once with at least one slot', () => {
    const ids = SECTION_LAYOUTS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['shortcuts', 'pair', 'quad', 'rows', 'wide', 'wide-pair', 'big']);
    for (const l of SECTION_LAYOUTS) expect(l.slots.length).toBeGreaterThan(0);
  });
});

describe('WidgetGrid', () => {
  it('has no layout modifier by default', () => {
    const { container } = render(<WidgetGrid>x</WidgetGrid>);
    expect((container.firstChild as HTMLElement).className).toBe('uiwgrid');
  });

  it.each(SECTION_LAYOUTS.map((l) => l.id))('layout %s maps to its modifier', (layout) => {
    const { container } = render(<WidgetGrid layout={layout} />);
    expect((container.firstChild as HTMLElement).className).toBe(`uiwgrid uiwgrid--${layout}`);
    cleanup();
  });

  it('renders children and appends className', () => {
    const { container } = render(
      <WidgetGrid layout="pair" className="extra">
        <i data-testid="c" />
      </WidgetGrid>,
    );
    expect((container.firstChild as HTMLElement).className).toBe('uiwgrid uiwgrid--pair extra');
    expect(screen.getByTestId('c').parentElement).toBe(container.firstChild);
  });
});

describe('WidgetSection', () => {
  it('renders no head without title and aside', () => {
    const { container } = render(
      <WidgetSection layout="wide">
        <i />
      </WidgetSection>,
    );
    expect(container.querySelector('.uiwsec-head')).toBeNull();
    expect(container.querySelector('.uiwgrid--wide')).not.toBeNull();
  });

  it('renders the title and the aside', () => {
    const { container } = render(<WidgetSection title="Today" aside="See all" />);
    expect(screen.getByText('Today').className).toBe('uiwsec-title');
    expect(screen.getByText('See all').className).toBe('uiwsec-aside');
    expect(container.querySelector('section')).not.toBeNull();
  });

  it('an aside alone still shows the head, without a title span', () => {
    const { container } = render(<WidgetSection aside="More" />);
    expect(container.querySelector('.uiwsec-head')).not.toBeNull();
    expect(container.querySelector('.uiwsec-title')).toBeNull();
  });
});
