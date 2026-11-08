// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonsPref } from '../addons/enabledSet';

const h = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
}));
vi.mock('../legal/consentApi', () => ({
  useConsentRecords: () => ({ records: [{ kind: 'atlas-history' }], confirmed: true }),
}));
vi.mock('../legal/consents', () => ({ optionalConsentOn: () => true }));
vi.mock('../legal/localOff', () => ({ localOffKinds: () => [] }));
vi.mock('./chatSyncPorts', () => ({
  firestoreHistoryPorts: () => ({}),
  firestoreRetentionPorts: () => ({}),
}));
vi.mock('./chatRetention', () => ({
  sweepWithdrawn: () => Promise.resolve(),
  withdrawHistory: () => Promise.resolve(),
}));
vi.mock('./chatSyncService', () => ({
  startAtlasHistory: () => {
    h.start();
    return { stop: h.stop, uploadLocal: () => Promise.resolve() };
  },
}));

import { AtlasHistoryHost } from './AtlasHistoryHost';

beforeEach(() => {
  h.start.mockClear();
  h.stop.mockClear();
});
afterEach(() => {
  addonsPref.reset();
  cleanup();
});

describe('Atlas chat sync needs the Atlas add-on (SPO-500 hard guard)', () => {
  it('does not run without Atlas, even with the consent on', () => {
    addonsPref.reset();
    render(<AtlasHistoryHost />);
    expect(h.start).not.toHaveBeenCalled();
  });
  it('runs with Atlas installed, and stops when it is removed', () => {
    addonsPref.set(['atlas']);
    const view = render(<AtlasHistoryHost />);
    expect(h.start).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(h.stop).toHaveBeenCalled();
  });
});
