// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkHighlight } from './SkHighlight';

afterEach(cleanup);

describe('SkHighlight', () => {
  it('marks only the matched parts and keeps the full text', () => {
    const { container } = render(
      <p>
        <SkHighlight
          parts={[
            { text: 'Sle', hit: true },
            { text: 'ep', hit: false },
          ]}
        />
      </p>,
    );
    expect(container.textContent).toBe('Sleep');
    const marks = container.querySelectorAll('mark.sk-hl');
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe('Sle');
  });
  it('renders plain text when nothing matched', () => {
    const { container } = render(<SkHighlight parts={[{ text: 'abc', hit: false }]} />);
    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe('abc');
  });
});
