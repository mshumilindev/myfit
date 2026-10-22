import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FindingRow } from './FindingRow';

afterEach(cleanup);

const renderRow = (ui: React.ReactElement) => render(<ul>{ui}</ul>);

describe('FindingRow', () => {
  it('renders a list item with title and status word', () => {
    renderRow(<FindingRow icon="warning" tone="danger" title="No deload" status="To fix" />);
    const li = screen.getByRole('listitem');
    expect(li.className).toContain('uifind');
    expect(screen.getByText('No deload').tagName).toBe('B');
    expect(screen.getByText('To fix')).toBeTruthy();
  });

  it.each(['danger', 'ok', 'accent'] as const)('tone %s maps to the tone class', (tone) => {
    renderRow(<FindingRow icon="info" tone={tone} title="t" status="s" />);
    expect(screen.getByRole('listitem').className).toContain(`uit--${tone}`);
  });

  it('body and action render only when given', () => {
    const { container, rerender } = renderRow(
      <FindingRow icon="info" tone="ok" title="t" status="s" />,
    );
    expect(container.querySelector('.uifind-b')).toBeNull();
    expect(container.querySelector('.uifind-a')).toBeNull();
    rerender(
      <ul>
        <FindingRow
          icon="info"
          tone="ok"
          title="t"
          status="s"
          body="Because"
          action={<button type="button">Fix in editor</button>}
        />
      </ul>,
    );
    expect(screen.getByText('Because').className).toBe('uifind-b');
    expect(screen.getByRole('button', { name: 'Fix in editor' })).toBeTruthy();
  });

  it('merges className and hides the icon from assistive tech', () => {
    const { container } = renderRow(
      <FindingRow icon="info" tone="ok" title="t" status="s" className="extra" />,
    );
    expect(screen.getByRole('listitem').className).toContain('extra');
    expect(container.querySelector('.uifind-i')?.getAttribute('aria-hidden')).toBe('true');
  });
});
