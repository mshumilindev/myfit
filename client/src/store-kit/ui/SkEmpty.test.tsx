// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkEmpty } from './SkEmpty';

afterEach(cleanup);

describe('SkEmpty', () => {
  it('renders icon, title, body, children and actions in a status region', () => {
    render(
      <SkEmpty
        icon={<i data-testid="ic" />}
        title="Nothing here"
        body="Try later"
        actions={<button type="button">Browse</button>}
      >
        <span>hint</span>
      </SkEmpty>,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeTruthy();
    expect(screen.getByText('Try later')).toBeTruthy();
    expect(screen.getByText('hint')).toBeTruthy();
    expect(screen.getByTestId('ic')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy();
  });
  it('omits absent parts', () => {
    const { container } = render(<SkEmpty title="Only title" />);
    expect(container.querySelector('.sk-empty-body')).toBeNull();
    expect(container.querySelector('.sk-empty-actions')).toBeNull();
  });
});
