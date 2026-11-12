import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { GroupedList, ListRow } from './GroupedList';

const guide = {
  className: 'uisg-f is-hit',
  onClickCapture: () => {},
  'data-guide-hit': '' as const,
};

describe('GroupedList guide', () => {
  it('frames the whole group as one required field, not each row', () => {
    const { container } = render(
      <GroupedList guide={guide}>
        <ListRow label="A" />
        <ListRow label="B" />
      </GroupedList>,
    );
    expect(container.querySelectorAll('.uisg-f')).toHaveLength(1);
    expect(container.querySelector('.uigl-rows')?.classList.contains('uisg-f')).toBe(true);
  });
});
