import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Tag } from './Tag';

afterEach(cleanup);

describe('Tag', () => {
  it('is a span with the accent tone by default', () => {
    render(<Tag>PR</Tag>);
    const el = screen.getByText('PR');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('uitag');
    expect(el.className).toContain('uit--accent');
    expect(el.className).not.toContain('uitag--solid');
  });

  it.each(['ok', 'danger', 'rest', 'neutral'] as const)('tone %s maps to its class', (tone) => {
    render(<Tag tone={tone}>t</Tag>);
    expect(screen.getByText('t').className).toContain(`uit--${tone}`);
  });

  it('solid adds the solid modifier', () => {
    render(<Tag solid>PR</Tag>);
    expect(screen.getByText('PR').className).toContain('uitag--solid');
  });

  it('renders the icon in its own slot, and no slot without one', () => {
    const { container, rerender } = render(<Tag icon={<b data-testid="i" />}>x</Tag>);
    expect(screen.getByTestId('i').parentElement?.className).toBe('uitag-i');
    rerender(<Tag>x</Tag>);
    expect(container.querySelector('.uitag-i')).toBeNull();
  });

  it('keeps an icon of 0 and passes className and attributes through', () => {
    const { container } = render(
      <Tag icon={0} className="extra" data-testid="tag" title="hint">
        n
      </Tag>,
    );
    expect(container.querySelector('.uitag-i')?.textContent).toBe('0');
    const el = screen.getByTestId('tag');
    expect(el.className).toContain('extra');
    expect(el.getAttribute('title')).toBe('hint');
  });
});
