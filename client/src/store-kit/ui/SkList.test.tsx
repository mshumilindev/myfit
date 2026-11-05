// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkList } from './SkList';
import { SkRow } from './SkRow';

afterEach(cleanup);

describe('SkList', () => {
  it('is a card with list styling wrapping its rows', () => {
    const { container } = render(
      <SkList className="x">
        <SkRow name="a" />
        <SkRow name="b" />
      </SkList>,
    );
    const l = container.firstElementChild as HTMLElement;
    expect(l.className).toBe('sk-card sk-list x');
    expect(l.querySelectorAll('.sk-row')).toHaveLength(2);
  });
});
