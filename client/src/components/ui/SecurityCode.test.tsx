import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecurityCode, type SecurityCodeLabels } from './SecurityCode';

const labels: SecurityCodeLabels = {
  groupsAria: (c) => `Security code: ${c}`,
  copy: 'Copy code',
  copied: 'Copied',
  verified: 'Verified',
  notVerified: 'Not verified yet',
  verify: 'I verified this code',
  unverify: 'Mark as not verified',
};
const CODE = '0412 9981 3307 5528 1046 7790';
afterEach(cleanup);

describe('SecurityCode', () => {
  it('shows six groups of four digits under one spoken name', () => {
    render(<SecurityCode code={CODE} verified={false} labels={labels} />);
    const list = screen.getByRole('list', { name: /Security code: 0412, 9981/ });
    expect(list.querySelectorAll('li')).toHaveLength(6);
    expect(list.textContent).toBe('041299813307552810467790');
  });
  it('copies the whole code with its spaces', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(<SecurityCode code={CODE} verified={false} labels={labels} writeText={writeText} />);
    fireEvent.click(screen.getByRole('button', { name: labels.copy }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(CODE));
    expect(await screen.findByRole('button', { name: labels.copied })).toBeTruthy();
  });
  it('verify and unverify are offered only when the caller can handle them', () => {
    const onVerify = vi.fn();
    const { rerender } = render(<SecurityCode code={CODE} verified={false} labels={labels} />);
    expect(screen.queryByRole('button', { name: labels.verify })).toBeNull();
    rerender(<SecurityCode code={CODE} verified={false} labels={labels} onVerify={onVerify} />);
    fireEvent.click(screen.getByRole('button', { name: labels.verify }));
    expect(onVerify).toHaveBeenCalledTimes(1);
    const onUnverify = vi.fn();
    rerender(<SecurityCode code={CODE} verified labels={labels} onUnverify={onUnverify} />);
    expect(screen.getByText(labels.verified)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: labels.unverify }));
    expect(onUnverify).toHaveBeenCalledTimes(1);
  });
});
