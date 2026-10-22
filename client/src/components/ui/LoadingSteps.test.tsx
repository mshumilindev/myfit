import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LoadingSteps } from './LoadingSteps';

afterEach(cleanup);

describe('LoadingSteps', () => {
  it('marks finished steps done, the current one active and the rest todo', () => {
    const { container } = render(
      <LoadingSteps
        brand={<b>brand</b>}
        hint="a hint"
        steps={[
          { id: 'a', label: 'Signed in', state: 'done' },
          { id: 'b', label: 'Checking', state: 'active' },
          { id: 'c', label: 'Opening', state: 'todo' },
        ]}
      />,
    );
    const items = container.querySelectorAll('.uils-i');
    expect([...items].map((i) => i.className.match(/is-(\w+)/)?.[1])).toEqual([
      'done',
      'active',
      'todo',
    ]);
    expect(container.querySelector('.uils-spin')).toBeTruthy();
    expect(screen.getByText('a hint')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
