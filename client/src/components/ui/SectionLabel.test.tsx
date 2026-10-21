import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SectionLabel } from './SectionLabel';

afterEach(cleanup);

describe('SectionLabel', () => {
  it('renders the label with no tone classes and no action by default', () => {
    const { container } = render(<SectionLabel>Recent</SectionLabel>);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toBe('uisec');
    expect(screen.getByText('Recent').className).toBe('uisec-l');
    expect(container.querySelector('.uisec-a')).toBeNull();
  });

  it('maps tone to the family class plus the toned modifier', () => {
    const { container } = render(<SectionLabel tone="sleep">Sleep</SectionLabel>);
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain('uit--sleep');
    expect(cls).toContain('uisec--toned');
  });

  it('renders the action on the right', () => {
    const onClick = vi.fn();
    render(
      <SectionLabel action={<button onClick={onClick}>See all</button>}>Programs</SectionLabel>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'See all' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button').parentElement?.className).toBe('uisec-a');
  });

  it('merges className and passes attributes through', () => {
    render(
      <SectionLabel className="extra" data-testid="s" id="lbl">
        x
      </SectionLabel>,
    );
    const el = screen.getByTestId('s');
    expect(el.className).toContain('extra');
    expect(el.id).toBe('lbl');
  });
});
