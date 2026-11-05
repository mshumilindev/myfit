// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkBento } from './SkBento';

afterEach(cleanup);

describe('SkBento', () => {
  it('defaults to two columns', () => {
    const { container } = render(<SkBento>x</SkBento>);
    expect(container.firstElementChild?.className).toContain('sk-bgrid-c2');
  });
  it('maps cols and className', () => {
    const { container } = render(
      <SkBento cols={4} className="extra">
        x
      </SkBento>,
    );
    expect(container.firstElementChild?.className).toMatch(/sk-bgrid-c4.*extra/);
  });
});
