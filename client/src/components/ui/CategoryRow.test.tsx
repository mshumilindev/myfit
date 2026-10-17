import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CategoryRow, type CategoryRowProps } from './CategoryRow';

afterEach(cleanup);

const base: CategoryRowProps = {
  tone: 'sport',
  icon: 'barbell',
  title: 'Sports',
  onClick: vi.fn(),
};

describe('CategoryRow', () => {
  it('is a button in the stack layout with the family tone and a chevron', () => {
    const { container } = render(<CategoryRow {...base} />);
    const b = screen.getByRole('button');
    expect(b.getAttribute('type')).toBe('button');
    expect(b.className).toContain('uicat--stack');
    expect(b.className).toContain('uit--sport');
    expect(b.className).not.toContain('is-selected');
    expect(b.className).not.toContain('is-muted');
    expect(container.querySelector('.uicat-chev')).toBeTruthy();
    expect(container.querySelector('.uicat-n')).toBeNull();
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    render(<CategoryRow {...base} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows the count after the title, including 0', () => {
    const { container, rerender } = render(<CategoryRow {...base} count={13} />);
    expect(container.querySelector('.uicat-n')?.textContent).toBe(' · 13');
    rerender(<CategoryRow {...base} count={0} />);
    expect(container.querySelector('.uicat-n')?.textContent).toBe(' · 0');
  });

  it('stack layout puts at most three minis left of the meta line', () => {
    const { container } = render(
      <CategoryRow {...base} meta="last: Dance" minis={['barbell', 'heart', 'bell', 'user']} />,
    );
    const meta = container.querySelector('.uicat-meta') as HTMLElement;
    expect(meta.querySelectorAll('.uicat-minis > *')).toHaveLength(3);
    expect(meta.querySelector('.uicat-m')?.textContent).toBe('last: Dance');
  });

  it('inline layout puts at most four minis on the right, outside the text body', () => {
    const { container } = render(
      <CategoryRow
        {...base}
        layout="inline"
        meta="m"
        minis={['barbell', 'heart', 'bell', 'user', 'clock']}
      />,
    );
    expect(screen.getByRole('button').className).toContain('uicat--inline');
    expect(container.querySelector('.uicat-meta')).toBeNull();
    expect(container.querySelector('.uicat-body .uicat-m')?.textContent).toBe('m');
    const minis = container.querySelector('.uicat-minis') as HTMLElement;
    expect(minis.parentElement).toBe(screen.getByRole('button'));
    expect(minis.children).toHaveLength(4);
  });

  it('selected, muted and className add modifiers; chevron can be hidden', () => {
    const { container } = render(
      <CategoryRow {...base} selected muted chevron={false} className="mine" />,
    );
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('is-selected');
    expect(cls).toContain('is-muted');
    expect(cls).toContain('mine');
    expect(container.querySelector('.uicat-chev')).toBeNull();
  });

  it('ariaLabel names the button', () => {
    render(<CategoryRow {...base} ariaLabel="Open sports" />);
    expect(screen.getByRole('button', { name: 'Open sports' })).toBeTruthy();
  });
});
