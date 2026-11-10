// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonsPref, enableAddons } from '../addons/enabledSet';

const sweep = vi.fn<(p: unknown) => Promise<string>>().mockResolvedValue('none');
vi.mock('./chatRetention', () => ({ sweepWithdrawn: (p: unknown) => sweep(p) }));
vi.mock('./chatSyncPorts', () => ({ firestoreRetentionPorts: () => ({ ports: true }) }));
vi.mock('./AtlasHistoryHost', () => ({ AtlasHistoryHost: () => <p>history-host</p> }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
}));
const consent = { records: [] as unknown[], confirmed: true };
vi.mock('../legal/consentApi', () => ({ useConsentRecords: () => consent }));
const on = vi.fn(() => false);
vi.mock('../legal/consents', () => ({ optionalConsentOn: () => on() }));

import { AtlasHistoryGate } from './AtlasHistoryGate';

beforeEach(() => {
  addonsPref.reset();
  sweep.mockClear();
  on.mockReturnValue(false);
});
afterEach(cleanup);

describe('AtlasHistoryGate', () => {
  it('without Atlas the history host is not loaded, but a withdrawn copy is still swept', async () => {
    render(<AtlasHistoryGate />);
    await waitFor(() => expect(sweep).toHaveBeenCalledWith({ ports: true }));
    expect(screen.queryByText('history-host')).toBeNull();
  });
  it('without Atlas and with the consent on, nothing is swept', async () => {
    on.mockReturnValue(true);
    render(<AtlasHistoryGate />);
    await new Promise((r) => setTimeout(r, 50));
    expect(sweep).not.toHaveBeenCalled();
  });
  it('with Atlas installed the history host is loaded', async () => {
    enableAddons(['atlas'], 'member');
    render(<AtlasHistoryGate />);
    expect(await screen.findByText('history-host')).toBeTruthy();
    expect(sweep).not.toHaveBeenCalled();
  });
});
