// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkSectionHeader, SkSectionLink } from './SkSectionHeader';

afterEach(cleanup);

describe('SkSectionHeader', () => {
  it('renders an h2 title by default and h3 on request', () => {
    const { rerender } = render(<SkSectionHeader title="Apps" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Apps' })).toBeTruthy();
    rerender(<SkSectionHeader title="Apps" as="h3" />);
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
  });
  it('renders the aside only when given, and the link fires', () => {
    const on = vi.fn();
    const { container, rerender } = render(<SkSectionHeader title="A" />);
    expect(container.querySelector('.sk-sec-aside')).toBeNull();
    rerender(
      <SkSectionHeader title="A" aside={<SkSectionLink onClick={on}>See all</SkSectionLink>} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'See all' }));
    expect(on).toHaveBeenCalledTimes(1);
  });
});
