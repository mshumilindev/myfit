import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { IconTile } from './IconTile';
import { OptionCard } from './OptionCard';

afterEach(cleanup);

describe('OptionCard', () => {
  it('without an icon keeps the stacked layout and the corner check', () => {
    const { container } = render(
      <OptionCard title="Together" sub="One strip" selected onSelect={() => undefined} />,
    );
    const card = container.querySelector('.uiopt')!;
    expect(card.classList.contains('uiopt--row')).toBe(false);
    expect(card.querySelector('.uiopt-tx')).toBeNull();
    expect(card.querySelector('.uiopt-check')).toBeTruthy();
  });

  it('with an icon is a row: icon, title + description column, then the check', () => {
    const { container } = render(
      <OptionCard
        icon={<IconTile tone="accent" size={30} icon="eye" />}
        title="Full"
        sub="Products and your usual amounts."
        selected
        onSelect={() => undefined}
      />,
    );
    const card = container.querySelector('.uiopt')!;
    expect(card.classList.contains('uiopt--row')).toBe(true);
    const kids = [...card.children].map((c) => c.className);
    expect(kids).toEqual(['uiopt-ic', 'uiopt-tx', 'uiopt-check']);
    const tx = card.querySelector('.uiopt-tx')!;
    expect(tx.querySelector('.uiopt-t')?.textContent).toBe('Full');
    expect(tx.querySelector('.uiopt-s')?.textContent).toBe('Products and your usual amounts.');
  });
});
