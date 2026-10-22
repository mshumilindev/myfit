import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SeverityDot } from './SeverityDot';

afterEach(cleanup);

describe('SeverityDot', () => {
  it('defaults to the neutral tone with a decorative dot and the word', () => {
    const { container } = render(<SeverityDot>Watch</SeverityDot>);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('uisevdot');
    expect(root.className).toContain('uit--neutral');
    expect(container.querySelector('.uisevdot-d')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Watch').className).toBe('uisevdot-t');
  });

  it.each(['danger', 'ok', 'illness'] as const)('maps tone %s to its family class', (tone) => {
    const { container } = render(<SeverityDot tone={tone}>x</SeverityDot>);
    expect((container.firstChild as HTMLElement).className).toContain(`uit--${tone}`);
  });

  it('dot={false} hides the dot but keeps the word', () => {
    const { container } = render(<SeverityDot dot={false}>All clear</SeverityDot>);
    expect(container.querySelector('.uisevdot-d')).toBeNull();
    expect(screen.getByText('All clear')).toBeTruthy();
  });

  it('merges className and passes attributes through', () => {
    render(
      <SeverityDot className="extra" data-testid="d" title="t">
        Urgent
      </SeverityDot>,
    );
    const el = screen.getByTestId('d');
    expect(el.className).toContain('extra');
    expect(el.getAttribute('title')).toBe('t');
  });
});
