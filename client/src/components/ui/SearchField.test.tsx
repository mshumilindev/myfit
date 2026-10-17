import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SearchField } from './SearchField';

afterEach(cleanup);

const base = { placeholder: 'Search', clearLabel: 'Clear' };

describe('SearchField', () => {
  it('is a search input labelled by its placeholder by default', () => {
    render(<SearchField {...base} value="" onChange={() => undefined} />);
    const input = screen.getByRole('searchbox', { name: 'Search' }) as HTMLInputElement;
    expect(input.placeholder).toBe('Search');
    expect(input.getAttribute('enterkeyhint')).toBe('search');
  });

  it('an explicit aria-label wins', () => {
    render(<SearchField {...base} value="" onChange={() => undefined} aria-label="Find" />);
    expect(screen.getByRole('searchbox', { name: 'Find' })).toBeTruthy();
  });

  it('typing reports the new string', () => {
    const onChange = vi.fn();
    render(<SearchField {...base} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'squat' } });
    expect(onChange).toHaveBeenCalledWith('squat');
  });

  it('shows the hint only while empty and no clear button', () => {
    const { rerender } = render(
      <SearchField {...base} value="" onChange={() => undefined} hint="All · 24" />,
    );
    expect(screen.getByText('All · 24').className).toContain('uisearch-hint');
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    rerender(<SearchField {...base} value="a" onChange={() => undefined} hint="All · 24" />);
    expect(screen.queryByText('All · 24')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
  });

  it('clear empties the value and refocuses the input', () => {
    const onChange = vi.fn();
    const ref = createRef<HTMLInputElement>();
    render(<SearchField {...base} ref={ref} value="abc" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(document.activeElement).toBe(ref.current);
  });

  it('maps size and className; default size is md', () => {
    const a = render(<SearchField {...base} value="" onChange={() => undefined} className="x" />);
    const root = a.container.firstChild as HTMLElement;
    expect(root.className).toContain('uisearch--md');
    expect(root.className).toContain('x');
    a.unmount();
    const b = render(<SearchField {...base} value="" onChange={() => undefined} size="lg" />);
    expect((b.container.firstChild as HTMLElement).className).toContain('uisearch--lg');
  });
});
