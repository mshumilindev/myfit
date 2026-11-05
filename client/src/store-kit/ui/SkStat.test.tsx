// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkStat } from './SkStat';

afterEach(cleanup);

describe('SkStat', () => {
  it('renders value and caption', () => {
    render(<SkStat value="12" caption="Installed" />);
    expect(screen.getByText('12').className).toBe('sk-stat-v');
    expect(screen.getByText('Installed').className).toBe('sk-stat-c');
  });
  it('maps tone to a class', () => {
    const { container } = render(<SkStat value="3" caption="c" tone="acc" />);
    expect(container.firstElementChild?.className).toContain('sk-stat-acc');
  });
});
