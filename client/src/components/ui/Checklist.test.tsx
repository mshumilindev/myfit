import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Checklist } from './Checklist';

afterEach(cleanup);

describe('Checklist', () => {
  it('keeps every item and marks the finished ones, never removing any', () => {
    const items = [
      { id: 'a', label: 'Read: Terms', done: true },
      { id: 'b', label: 'Tick the agreement', done: false },
    ];
    const { container, rerender } = render(<Checklist title="Still to do" items={items} />);
    expect(screen.getByText('Still to do')).toBeTruthy();
    expect(container.querySelectorAll('.uichk-i')).toHaveLength(2);
    expect(container.querySelectorAll('.uichk-i.is-done')).toHaveLength(1);
    expect(container.querySelector('.uichk.is-all')).toBeNull();
    rerender(<Checklist title="Ready" items={items.map((i) => ({ ...i, done: true }))} />);
    expect(container.querySelectorAll('.uichk-i')).toHaveLength(2);
    expect(container.querySelectorAll('.uichk-i.is-done')).toHaveLength(2);
    expect(container.querySelector('.uichk.is-all')).toBeTruthy();
  });

  it('announces changes politely', () => {
    const { container } = render(<Checklist title="t" items={[]} />);
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
  });
});
