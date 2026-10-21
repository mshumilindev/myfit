import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToneText } from './ToneText';
import { TONES } from './tones';

afterEach(cleanup);

describe('ToneText', () => {
  it('is an inline span in the tone family base colour', () => {
    render(<ToneText tone="illness">Unwell</ToneText>);
    const el = screen.getByText('Unwell');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toBe('uit--illness');
    expect(el.style.color).toBe('var(--t-base)');
  });

  it('is not bold by default and bold 600 when strong', () => {
    const { rerender } = render(<ToneText tone="ok">x</ToneText>);
    expect(screen.getByText('x').style.fontWeight).toBe('');
    rerender(
      <ToneText tone="ok" strong>
        x
      </ToneText>,
    );
    expect(screen.getByText('x').style.fontWeight).toBe('600');
  });

  it.each(TONES)('tone %s maps to its class', (tone) => {
    render(<ToneText tone={tone}>t</ToneText>);
    expect(screen.getByText('t').className).toBe(`uit--${tone}`);
    cleanup();
  });

  it('renders nested nodes', () => {
    render(
      <ToneText tone="danger">
        a <b>b</b>
      </ToneText>,
    );
    expect(screen.getByText('b').closest('span')?.className).toBe('uit--danger');
  });
});
