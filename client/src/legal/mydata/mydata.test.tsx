import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setViewport } from '../../coach/testViewport';
import type { ConsentRecord } from '../consents';
import type { AreaInputs } from './areas';

const h = vi.hoisted(() => ({
  records: [] as ConsentRecord[],
  confirmed: true,
  loading: false,
  store: {
    workouts: [] as unknown[],
    activities: [] as unknown[],
    restPeriods: [] as unknown[],
    gyms: [] as unknown[],
    bodyMetrics: { weights: [] as unknown[] },
    sleeps: [] as unknown[],
    injuries: [] as unknown[],
    conditions: [] as unknown[],
  },
  stored: { cycle: false, nicotine: false, alcohol: false, supplements: false } as Record<
    string,
    boolean
  >,
  trainer: null as string | null,
  chat: [] as unknown[],
  clearAtlas: vi.fn(),
  deleteHealth: vi.fn(),
}));
vi.mock('../consentApi', () => ({
  useConsentRecords: () => ({
    records: h.records,
    loading: h.loading,
    confirmed: h.confirmed,
    error: null,
  }),
  grantConsent: vi.fn(),
  withdrawConsent: vi.fn(),
}));
vi.mock('../../store', async (orig) => ({
  ...(await orig<typeof import('../../store')>()),
  useStore: () => h.store,
  hasStoredHealthData: (f: string) => h.stored[f] ?? false,
  useSelfTrainerId: () => h.trainer,
}));
vi.mock('../../atlas/chatLog', () => ({ useChatLog: () => h.chat }));
vi.mock('../../atlas/clearConversation', () => ({ clearAtlasConversation: h.clearAtlas }));
vi.mock('../export/readSources', () => ({ readExportSources: vi.fn() }));
vi.mock('../healthData', () => ({
  deleteHealthData: h.deleteHealth,
  hasHealthData: vi.fn(async () => false),
}));
vi.mock('../../api', async (orig) => ({
  ...(await orig<typeof import('../../api')>()),
  signOut: vi.fn(),
}));

import { markReauthed, forgetReauth } from '../../coach/security/reauth';
import { readExportSources } from '../export/readSources';
import { PrivacyHub, useConsentsPage } from '../PrivacyHub';
import { AreaPage } from './AreaPage';
import { ConsentHistoryPage } from './ConsentHistoryPage';
import { DevicePage } from './DevicePage';
import { MyDataScreen, useMyDataPage } from './MyDataScreen';

const base: AreaInputs = {
  sessions: 12,
  sets: 87,
  activities: 3,
  restPeriods: 0,
  gyms: 2,
  weighIns: 5,
  nights: 9,
  injuries: 1,
  conditions: 0,
  stored: { cycle: false, nicotine: true, alcohol: false, supplements: false },
  chat: 4,
  atlasAllowed: true,
  geoAllowed: false,
  hasTrainer: true,
  pushOn: false,
};
const btn = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;
let n = 0;
const rec = (
  kind: ConsentRecord['kind'],
  action: ConsentRecord['action'],
  at: number,
): ConsentRecord => ({
  id: `r${++n}`,
  kind,
  action,
  version: '2026-10-21',
  at,
});

beforeEach(() => {
  setViewport(1280);
  h.records = [];
  h.confirmed = true;
  h.loading = false;
  forgetReauth();
  vi.mocked(readExportSources).mockReset();
  h.store = {
    workouts: [],
    activities: [],
    restPeriods: [],
    gyms: [],
    bodyMetrics: { weights: [] },
    sleeps: [],
    injuries: [],
    conditions: [],
  };
  h.stored = { cycle: false, nicotine: false, alcohol: false, supplements: false };
  h.trainer = null;
  h.chat = [];
  h.clearAtlas.mockReset();
  h.deleteHealth.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
});
afterEach(cleanup);

describe('overview', () => {
  it('lists the eleven areas, shows export as coming soon and opens a page per area', () => {
    render(<MyDataScreen onBack={vi.fn()} />);
    for (const t of [
      'Account and sign-in',
      'Training',
      'Body, sleep and nutrition',
      'Health',
      'Atlas chat',
      'Gyms and location',
      'Sharing with your trainer',
      'Messages with your trainer',
      'Stored on this device',
      'Notifications and reminders',
      'Consent history',
    ])
      expect(screen.getByText(t)).toBeTruthy();
    // the data copy (N6) is a live row
    expect(screen.getByText('Download a copy of everything').closest('button')).not.toBeNull();
    expect(screen.queryByText('Coming soon')).toBeNull();
    fireEvent.click(screen.getByText('Training'));
    expect(screen.getByText('What is stored')).toBeTruthy();
    fireEvent.click(btn('Back'));
    expect(screen.getByText('Your data')).toBeTruthy();
  });

  it('Delete account opens the existing three-step flow and deletes nothing by itself', () => {
    render(<MyDataScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Delete account'));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
  });
});

describe('data pages read real data', () => {
  it('Training shows the counts of the loaded store, and no number for what cannot be read', () => {
    h.store.workouts = [
      { exercises: [{ sets: [1, 2] }, { sets: [1] }] },
      { exercises: [{ sets: [1] }] },
    ];
    h.store.activities = [{}];
    render(<MyDataScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Training'));
    const row = (label: string) => screen.getByText(label).closest('.uirow') as HTMLElement;
    expect(within(row('Sessions')).getByText('2')).toBeTruthy();
    expect(within(row('Sets')).getByText('4')).toBeTruthy();
    expect(within(row('Cardio and recovery')).getByText('1')).toBeTruthy();
    expect(within(row('Rest periods')).getByText('0')).toBeTruthy();
    expect(row('Programs and notes').textContent).not.toMatch(/\d/);
  });

  it('page content is the inputs: other numbers give other pages', () => {
    const { rerender } = render(
      <AreaPage area="training" inputs={base} onBack={vi.fn()} onDeleteAccount={vi.fn()} />,
    );
    expect(screen.getByText('87')).toBeTruthy();
    rerender(
      <AreaPage
        area="training"
        inputs={{ ...base, sets: 5 }}
        onBack={vi.fn()}
        onDeleteAccount={vi.fn()}
      />,
    );
    expect(screen.queryByText('87')).toBeNull();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('the messages page counts nothing: they are sealed', () => {
    render(<AreaPage area="chat" inputs={base} onBack={vi.fn()} onDeleteAccount={vi.fn()} />);
    const row = screen.getByText('Messages').closest('.uirow') as HTMLElement;
    expect(row.textContent).not.toMatch(/\d/);
    expect(
      screen.getByText('The messages are sealed, so this page cannot count them.'),
    ).toBeTruthy();
  });

  it('Sharing links to Privacy and sharing', () => {
    const open = vi.fn();
    render(
      <AreaPage
        area="sharing"
        inputs={base}
        onBack={vi.fn()}
        onOpenSharing={open}
        onDeleteAccount={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Privacy and sharing'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('a page with no existing action says so instead of faking one', () => {
    render(<AreaPage area="gyms" inputs={base} onBack={vi.fn()} onDeleteAccount={vi.fn()} />);
    expect(screen.queryByText('Your options')).toBeNull();
    expect(screen.getByText(/delete the items where you made them/)).toBeTruthy();
  });
});

describe('health: delete through the existing two-step prompt', () => {
  it('offers only the features that have data, and deletes only after both steps', async () => {
    render(<AreaPage area="health" inputs={base} onBack={vi.fn()} onDeleteAccount={vi.fn()} />);
    expect(screen.getByText('Delete Injuries data')).toBeTruthy();
    expect(screen.getByText('Delete Nicotine data')).toBeTruthy();
    expect(screen.queryByText('Delete Alcohol data')).toBeNull();
    fireEvent.click(screen.getByText('Delete Nicotine data'));
    expect(screen.getByText('Delete your Nicotine data?')).toBeTruthy();
    fireEvent.click(btn('Continue'));
    expect(h.deleteHealth).not.toHaveBeenCalled();
    fireEvent.click(btn('Delete'));
    await waitFor(() => expect(h.deleteHealth).toHaveBeenCalledWith('nicotine'));
  });

  it('Keep my data deletes nothing', () => {
    render(<AreaPage area="health" inputs={base} onBack={vi.fn()} onDeleteAccount={vi.fn()} />);
    fireEvent.click(screen.getByText('Delete Injuries data'));
    fireEvent.click(btn('Keep my data'));
    expect(h.deleteHealth).not.toHaveBeenCalled();
  });
});

describe('Atlas chat', () => {
  it('clears the conversation only after the confirm', () => {
    render(<AreaPage area="atlas" inputs={base} onBack={vi.fn()} onDeleteAccount={vi.fn()} />);
    fireEvent.click(screen.getByText('Clear chat history'));
    expect(h.clearAtlas).not.toHaveBeenCalled();
    fireEvent.click(btn('Cancel'));
    expect(h.clearAtlas).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Clear chat history'));
    fireEvent.click(btn('Clear'));
    expect(h.clearAtlas).toHaveBeenCalledTimes(1);
  });

  it('has no clear action when there is no chat', () => {
    render(
      <AreaPage
        area="atlas"
        inputs={{ ...base, chat: 0 }}
        onBack={vi.fn()}
        onDeleteAccount={vi.fn()}
      />,
    );
    expect(screen.queryByText('Clear chat history')).toBeNull();
  });
});

describe('consent history', () => {
  it('lists the records newest first with kind, given or withdrawn, version and date', () => {
    const recs = [
      rec('health:nicotine', 'grant', 1_700_000_000_000),
      rec('terms', 'grant', 1_699_000_000_000),
      rec('health:alcohol', 'withdraw', 1_701_000_000_000),
    ];
    const r = render(<ConsentHistoryPage records={recs} onBack={vi.fn()} />);
    const { container } = r;
    const items = [...container.querySelectorAll('.uirow')].map((li) => li.textContent ?? '');
    expect(items[0]).toMatch(/Alcohol · withdrawn/);
    expect(items[1]).toMatch(/Nicotine · given/);
    expect(items[2]).toMatch(/Terms of Use · given/);
    expect(items[0]).toMatch(/Version 2026-10-21 · /);
    expect(items).toHaveLength(3);
  });

  it('says plainly when there is nothing', () => {
    render(<ConsentHistoryPage records={[]} onBack={vi.fn()} />);
    expect(screen.getByText('No consents recorded yet.')).toBeTruthy();
  });

  it('opens from the overview with the real records', () => {
    h.records = [rec('atlas-ai', 'grant', 1_700_000_000_000)];
    render(<MyDataScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Consent history'));
    expect(screen.getByText(/Atlas AI chat · given/)).toBeTruthy();
  });
});

describe('Stored on this device', () => {
  const env = (seed: Record<string, string>) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    return {
      storage: localStorage,
      idb: {
        databases: async () => [{ name: 'spotter.vault' }, { name: 'firestore/[DEFAULT]/p/main' }],
      },
      cacheKeys: async () => ['workbox-precache'],
      estimate: async () => ({ usage: 2048 }),
    };
  };

  it('lists what is found in this browser and nothing it did not find', async () => {
    const e = env({
      'spotter.atlasChat': '[{"id":"1"}]',
      'spotter.cache.roster': 'x',
      'spotter.activeAccount': 'a',
      'gym.locale': 'en',
    });
    render(<DevicePage onBack={vi.fn()} chat={1} env={e} clear={vi.fn()} />);
    await screen.findByText('Sign-in and account list');
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Read cache')).toBeTruthy();
    expect(screen.getByText('Encryption key')).toBeTruthy();
    expect(screen.getByText('Offline database')).toBeTruthy();
    expect(screen.getByText('App files and pictures')).toBeTruthy();
    expect(screen.getByText(/1 message/)).toBeTruthy();
    expect(screen.getByText(/about 2 KB in total|about 2 KB used in total/)).toBeTruthy();
    // not found, so not listed
    expect(screen.queryByText('Offline copy of your data')).toBeNull();
    expect(screen.queryByText('Consent queue')).toBeNull();
    expect(screen.queryByText('Gym search results')).toBeNull();
    expect(screen.queryByText('Profile photos')).toBeNull();
    expect(screen.getByText(/This is not about cookies/)).toBeTruthy();
  });

  it('asks first and calls the clear helper only after the confirm', async () => {
    const clear = vi.fn().mockResolvedValue(undefined);
    render(<DevicePage onBack={vi.fn()} chat={0} env={env({})} clear={clear} />);
    await screen.findByText('Looking at this device…').then(
      () => undefined,
      () => undefined,
    );
    fireEvent.click(screen.getByText('Clear this device and sign out'));
    expect(screen.getByText('Clear this device?')).toBeTruthy();
    expect(clear).not.toHaveBeenCalled();
    fireEvent.click(btn('Cancel'));
    expect(clear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Clear this device and sign out'));
    fireEvent.click(btn('Clear and sign out'));
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
  });

  it('says so when clearing fails', async () => {
    const clear = vi.fn().mockRejectedValue(new Error('x'));
    render(<DevicePage onBack={vi.fn()} chat={0} env={env({})} clear={clear} />);
    fireEvent.click(screen.getByText('Clear this device and sign out'));
    fireEvent.click(btn('Clear and sign out'));
    await screen.findByText('Could not clear this device. Try again.');
  });
});

describe('Your privacy hub', () => {
  it('has a row that opens the page', () => {
    const open = vi.fn();
    render(<PrivacyHub onOpenConsents={vi.fn()} onOpenMyData={open} />);
    fireEvent.click(screen.getByText('What Spotter knows about you'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('shows no such row when the host does not offer the page', () => {
    render(<PrivacyHub onOpenConsents={vi.fn()} />);
    expect(screen.queryByText('What Spotter knows about you')).toBeNull();
  });

  it('the host swaps in the page and back', () => {
    function Host() {
      const c = useConsentsPage();
      const d = useMyDataPage();
      if (d.page) return d.page;
      return <PrivacyHub onOpenConsents={c.open} onOpenMyData={d.open} />;
    }
    render(<Host />);
    fireEvent.click(screen.getByText('What Spotter knows about you'));
    expect(screen.getByText('Everything stored for your account, in plain words')).toBeTruthy();
    fireEvent.click(btn('Back'));
    expect(screen.getByText('Your privacy')).toBeTruthy();
  });
});

describe('the data copy entries', () => {
  it('the overview row opens "Download a copy" and Back returns to the overview', () => {
    render(<MyDataScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Download a copy of everything'));
    expect(screen.getByText('What to include')).toBeTruthy();
    fireEvent.click(btn('Back'));
    expect(screen.getByText('Your data')).toBeTruthy();
  });

  it('"Download a copy first" in the deletion flow opens the copy and closes the flow', () => {
    render(<MyDataScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Delete account'));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    fireEvent.click(btn('Download a copy first'));
    expect(screen.queryByText('Delete your account?')).toBeNull();
    expect(screen.getByText('What to include')).toBeTruthy();
  });

  it('the privacy hub passes the same choice to its host', () => {
    const open = vi.fn();
    render(<PrivacyHub onOpenConsents={vi.fn()} onOpenExport={open} />);
    fireEvent.click(screen.getByText('Delete account'));
    fireEvent.click(btn('Download a copy first'));
    expect(open).toHaveBeenCalledWith(true);
    expect(screen.queryByText('Delete your account?')).toBeNull();
  });

  it('a host that cannot show the copy does not offer it', () => {
    render(<PrivacyHub onOpenConsents={vi.fn()} />);
    fireEvent.click(screen.getByText('Delete account'));
    expect(screen.queryByRole('button', { name: 'Download a copy first' })).toBeNull();
  });

  it('opened as the copy-first step, the host page can go on to the deletion', () => {
    function Host() {
      const d = useMyDataPage();
      return d.page ?? <button data-testid="go" onClick={() => d.openExport(true)} />;
    }
    render(<Host />);
    fireEvent.click(screen.getByTestId('go'));
    expect(screen.getByText('What to include')).toBeTruthy();
  });
});

describe('the data copy gets the consent history only when the server confirmed it', () => {
  async function prepare() {
    markReauthed();
    render(<MyDataScreen onBack={() => undefined} startAt="export" />);
    fireEvent.click(screen.getByText('Prepare my copy'));
    await waitFor(() => expect(readExportSources).toHaveBeenCalledTimes(1));
    return vi.mocked(readExportSources).mock.calls[0][0];
  }

  it.each([
    ['loading', { confirmed: false, loading: true }],
    ['cache only (offline, unconfirmed)', { confirmed: false, loading: false }],
  ])(
    '%s: null, so the manifest says "not loaded" instead of an empty consents.json',
    async (_n, st) => {
      h.records = [rec('terms', 'grant', 1)];
      Object.assign(h, st);
      expect((await prepare()).consents).toBeNull();
    },
  );

  it('confirmed: the real records', async () => {
    h.records = [rec('terms', 'grant', 1)];
    expect((await prepare()).consents).toEqual(h.records);
  });
});
