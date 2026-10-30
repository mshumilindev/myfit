import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentRecord } from './consents';
import { LEGAL_VERSIONS, currentVersion } from './consents';

const h = vi.hoisted(() => ({
  state: {
    records: [] as ConsentRecord[],
    loading: false,
    confirmed: true,
    error: null as Error | null,
  },
  grant: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock('./consentApi', () => ({
  useConsentRecords: () => h.state,
  grantConsent: h.grant,
  withdrawConsent: h.withdraw,
}));

vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
}));

import { resetAiOverride } from '../atlas/aiConsent';
import { isGeoPromptOpen, resetGeoGateForTests } from '../data/geoSearchGate';
import { healthPromptFeature } from '../data/healthConsentGate';
import { ConsentsPage } from './ConsentsPage';
import { PrivacyHub, useConsentsPage } from './PrivacyHub';
import { ConsentsScreen } from './ConsentsScreen';
import { countOn, requiredModel, rowModel } from './consentsModel';

const V = LEGAL_VERSIONS.terms;
let n = 0;
const rec = (
  kind: ConsentRecord['kind'],
  action: ConsentRecord['action'] = 'grant',
  version = currentVersion(kind),
): ConsentRecord => ({
  id: `r${++n}`,
  kind,
  action,
  version,
  at: 1_700_000_000_000 + n,
});
const required = () => [rec('terms'), rec('policy-ack'), rec('age-18')];
const sw = (name: string) => screen.getByRole('switch', { name }) as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
  resetGeoGateForTests();
  resetAiOverride();
  h.state = { records: [], loading: false, confirmed: true, error: null };
  h.grant.mockReset().mockResolvedValue({ id: 'x', at: 1 });
  h.withdraw.mockReset().mockResolvedValue({ id: 'y', at: 2 });
});
afterEach(cleanup);

describe('consents model', () => {
  it('counts only current optional grants', () => {
    const recs = [
      ...required(),
      rec('health:nicotine'),
      rec('atlas-ai'),
      rec('geo-search', 'withdraw'),
      rec('health:cycle', 'grant', '2020-01-01'),
    ];
    expect(countOn(recs)).toEqual({ on: 2, total: 10 });
  });
  it('states: loading, none, given, older', () => {
    expect(rowModel([], 'atlas-ai', true).status.state).toBe('loading');
    expect(rowModel([], 'atlas-ai', false).status.state).toBe('none');
    expect(rowModel([rec('atlas-ai')], 'atlas-ai', false)).toMatchObject({
      on: true,
      status: { state: 'given' },
    });
    expect(
      rowModel([rec('health:cycle', 'grant', '2020-01-01')], 'health:cycle', false),
    ).toMatchObject({ on: false, status: { state: 'older' } });
    expect(requiredModel(required().slice(0, 2), false).on).toBe(false);
  });
});

describe('ConsentsPage', () => {
  it('shows given and not given rows with the version', () => {
    h.state.records = [...required(), rec('health:nicotine')];
    render(<ConsentsPage />);
    expect(sw('Nicotine').checked).toBe(true);
    expect(sw('Alcohol').checked).toBe(false);
    expect(screen.getAllByText(new RegExp(`Given · v${V}`)).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Not given').length).toBe(10);
    expect(screen.getAllByRole('switch').length).toBe(12);
  });

  it('does not flash "Not given" while loading', () => {
    h.state = { records: [], loading: true, confirmed: false, error: null };
    render(<ConsentsPage />);
    expect(screen.queryByText('Not given')).toBeNull();
    expect(screen.getAllByText('Loading…').length).toBe(12);
    expect(sw('Nicotine').disabled).toBe(true);
  });

  // Gym search is a disclosure consent: the switch opens its own prompt (GeoConsentHost records the grant once accepted).
  it('turning gym search on opens its disclosure prompt and records nothing here', () => {
    h.state.records = required();
    render(<ConsentsPage />);
    expect(isGeoPromptOpen()).toBe(false);
    fireEvent.click(sw('Gym search and maps'));
    expect(isGeoPromptOpen()).toBe(true);
    expect(h.grant).not.toHaveBeenCalled();
  });

  it('turning gym search off withdraws it through the persisted queue and keeps it off locally', async () => {
    h.state.records = [...required(), rec('geo-search')];
    render(<ConsentsPage />);
    fireEvent.click(sw('Gym search and maps'));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw consent' }));
    await waitFor(() =>
      expect(h.withdraw).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'geo-search', engines: expect.any(Array) }),
      ),
    );
  });

  // SPO-290: a health row no longer grants directly; it opens that feature's own consent prompt (shown by the host).
  it('turning a health feature on opens its own prompt and grants nothing here', () => {
    h.state.records = required();
    render(<ConsentsPage />);
    fireEvent.click(sw('Alcohol'));
    expect(healthPromptFeature()).toBe('alcohol');
    expect(h.grant).not.toHaveBeenCalled();
  });

  it('turning one off asks first, then withdraws the right kind', async () => {
    h.state.records = [...required(), rec('health:nicotine')];
    render(<ConsentsPage />);
    fireEvent.click(sw('Nicotine'));
    expect(h.withdraw).not.toHaveBeenCalled();
    expect(screen.getByText('Turn off nicotine tracking?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw consent' }));
    await waitFor(() =>
      expect(h.withdraw).toHaveBeenCalledWith(expect.objectContaining({ kind: 'health:nicotine' })),
    );
  });

  it('keeping it on withdraws nothing', () => {
    h.state.records = [...required(), rec('atlas-ai')];
    render(<ConsentsPage />);
    fireEvent.click(sw('Atlas AI chat'));
    fireEvent.click(screen.getByRole('button', { name: 'Keep on' }));
    expect(h.withdraw).not.toHaveBeenCalled();
    expect(screen.queryByText('Turn off Atlas AI chat?')).toBeNull();
  });

  it('shows an error when the write fails', async () => {
    h.state.records = [...required(), rec('geo-search')];
    h.withdraw.mockRejectedValue(new Error('offline'));
    render(<ConsentsPage />);
    fireEvent.click(sw('Gym search and maps'));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw consent' }));
    expect(await screen.findByText('Could not save. Try again.')).toBeTruthy();
  });

  it('required withdrawal: explains deletion, delete disabled without a real flow, never withdraws', () => {
    h.state.records = required();
    render(<ConsentsPage />);
    fireEvent.click(sw('Terms of Use and Privacy Policy'));
    expect(screen.getByText(/we delete your account and all your data/)).toBeTruthy();
    expect(screen.getByText(/not available here yet/)).toBeTruthy();
    const del = screen.getByRole('button', { name: 'Delete account' }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    fireEvent.click(del);
    expect(h.withdraw).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep account' }));
    expect(screen.queryByText('Withdraw and delete your account?')).toBeNull();
  });

  it('required withdrawal leads into the real delete flow when there is one', () => {
    h.state.records = required();
    const onDelete = vi.fn();
    render(<ConsentsPage onDeleteAccount={onDelete} />);
    fireEvent.click(sw('Terms of Use and Privacy Policy'));
    fireEvent.click(screen.getByLabelText('Download a copy of my data first'));
    const del = screen.getByRole('button', { name: 'Delete account' }) as HTMLButtonElement;
    expect(del.disabled).toBe(false);
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith(true);
    expect(h.withdraw).not.toHaveBeenCalled();
  });
});

describe('ConsentsScreen', () => {
  it('is its own page with a back button and the backup-service row', async () => {
    h.state.records = [...required(), rec('atlas-ai'), rec('atlas-puter')];
    const back = vi.fn();
    render(<ConsentsScreen onBack={back} />);
    expect(sw('Atlas AI chat (backup service)').checked).toBe(true);
    fireEvent.click(sw('Atlas AI chat (backup service)'));
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    await waitFor(() =>
      expect(h.withdraw).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'atlas-puter', engines: ['puter'] }),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(back).toHaveBeenCalled();
  });
});

describe('PrivacyHub', () => {
  it('shows the count, the two documents with their versions, and opens the page', () => {
    h.state.records = [...required(), rec('health:nicotine'), rec('atlas-ai')];
    const openConsents = vi.fn();
    render(<PrivacyHub onOpenConsents={openConsents} />);
    expect(screen.getByText('2 of 10 on')).toBeTruthy();
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    expect(screen.getByText('Terms of Use')).toBeTruthy();
    // the two documents are versioned apart (the policy moved on 2026-10-30), each shows its own
    expect(screen.getByText(`Version ${LEGAL_VERSIONS.terms}`)).toBeTruthy();
    expect(screen.getByText(`Version ${LEGAL_VERSIONS.policy}`)).toBeTruthy();
    fireEvent.click(screen.getByText('Consents'));
    expect(openConsents).toHaveBeenCalledTimes(1);
  });

  it('opens the public pages and hides the count while loading', () => {
    h.state = { records: [], loading: true, confirmed: false, error: null };
    const open = vi.spyOn(window, 'open').mockReturnValue({ opener: {} } as unknown as Window);
    render(<PrivacyHub onOpenConsents={vi.fn()} />);
    expect(screen.queryByText(/of 10 on/)).toBeNull();
    fireEvent.click(screen.getByText('Terms of Use'));
    expect(open.mock.calls[0][0]).toMatch(/#\/terms$/);
    open.mockRestore();
  });
});

describe('account deletion entry points (SPO-285)', () => {
  it('Your privacy has a Delete account row that opens the first prompt, never deleting by itself', () => {
    render(<PrivacyHub onOpenConsents={() => undefined} />);
    fireEvent.click(screen.getByText('Delete account'));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my account' }));
    expect(screen.queryByText('Delete your account?')).toBeNull();
  });

  it('withdrawing a required consent leads into the same three-step flow', () => {
    h.state.records = required();
    function Host() {
      const c = useConsentsPage();
      return c.page ?? <button data-testid="open-consents" onClick={c.open} />;
    }
    render(<Host />);
    fireEvent.click(screen.getByTestId('open-consents'));
    fireEvent.click(sw('Terms of Use and Privacy Policy'));
    expect(screen.getByText(/we delete your account and all your data/)).toBeTruthy();
    const del = screen.getByRole('button', { name: 'Delete account' }) as HTMLButtonElement;
    expect(del.disabled).toBe(false);
    fireEvent.click(del);
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    expect(h.withdraw).not.toHaveBeenCalled();
  });

  it('"Download a copy of my data first" opens the copy instead of the deletion flow', () => {
    h.state.records = required();
    const exportFirst = vi.fn();
    function Host() {
      const c = useConsentsPage(exportFirst);
      return c.page ?? <button data-testid="open-consents" onClick={c.open} />;
    }
    render(<Host />);
    fireEvent.click(screen.getByTestId('open-consents'));
    fireEvent.click(sw('Terms of Use and Privacy Policy'));
    fireEvent.click(screen.getByLabelText('Download a copy of my data first'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    expect(exportFirst).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Delete your account?')).toBeNull();
    expect(h.withdraw).not.toHaveBeenCalled();
  });

  it('without the box ticked the deletion flow opens, with the copy offered inside it', () => {
    h.state.records = required();
    const exportFirst = vi.fn();
    function Host() {
      const c = useConsentsPage(exportFirst);
      return c.page ?? <button data-testid="open-consents" onClick={c.open} />;
    }
    render(<Host />);
    fireEvent.click(screen.getByTestId('open-consents'));
    fireEvent.click(sw('Terms of Use and Privacy Policy'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    expect(exportFirst).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Download a copy first' }));
    expect(exportFirst).toHaveBeenCalledTimes(1);
  });
});
