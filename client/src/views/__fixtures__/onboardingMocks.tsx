import { vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { resetGeoGateForTests, setGeoSearchState } from '../../data/geoSearchGate';
import { en } from '../../i18n/en';
import { DAY, NOW } from './viewKit';
import { OnboardingView } from '../OnboardingView';
import { Button } from '../../components/ui/Button';

/** Boundary mocks + spies for the OnboardingView tests. Import this BEFORE the view so the mocks are registered. */
const hoisted = vi.hoisted(() => ({
  inviteResult: null as unknown,
  callFn: vi.fn(),
  signIn: vi.fn(),
  uid: null as string | null,
  addWeight: vi.fn(),
  startWorkout: vi.fn(),
  updateBody: vi.fn(),
  upsertGym: vi.fn(),
  pos: vi.fn(),
  searchGyms: vi.fn(),
  nearby: vi.fn(),
  cacheAddress: vi.fn(),
}));
export const m = hoisted;
vi.mock('../../api', async (orig) => ({
  ...(await orig<typeof import('../../api')>()),
  callFn: (...a: unknown[]) => hoisted.callFn(...a),
  signInWithPayload: (...a: unknown[]) => hoisted.signIn(...a),
  currentUid: () => hoisted.uid,
}));
vi.mock('../../store', async (orig) => ({
  ...(await orig<typeof import('../../store')>()),
  addWeight: (...a: unknown[]) => hoisted.addWeight(...a),
  startWorkout: (...a: unknown[]) => hoisted.startWorkout(...a),
  updateBodyMetrics: (...a: unknown[]) => hoisted.updateBody(...a),
  upsertGym: (...a: unknown[]) => hoisted.upsertGym(...a),
  getCurrentPositionOnce: (...a: unknown[]) => hoisted.pos(...a),
}));
vi.mock('../../data/gymProviders', async (orig) => ({
  ...(await orig<typeof import('../../data/gymProviders')>()),
  searchGyms: (...a: unknown[]) => hoisted.searchGyms(...a),
  searchNearbyGyms: (...a: unknown[]) => hoisted.nearby(...a),
  cacheAddress: (...a: unknown[]) => hoisted.cacheAddress(...a),
}));
vi.mock('../../components/AvatarUploader', () => ({
  AvatarUploader: (p: { onUploaded: () => void; idleFooter: React.ReactNode }) => (
    <div data-testid="uploader">
      <Button onClick={p.onUploaded}>stub-upload</Button>
      {p.idleFooter}
    </div>
  ),
}));
vi.mock('../../components/GymThumb', () => ({
  GymThumb: (p: { name: string }) => <i data-testid="thumb">{p.name}</i>,
}));
vi.mock('../health/Conditions', () => ({
  ConditionPage: (p: { onBack: () => void; onPickKey: (k: string) => void; condKey?: string }) => (
    <div data-testid="cond-page">
      <span>key:{p.condKey ?? 'none'}</span>
      <Button onClick={() => p.onPickKey('back_lumbar_disc')}>pick-cond</Button>
      <Button onClick={p.onBack}>cond-back</Button>
    </div>
  ),
  ConditionsOnboardingRow: (p: { onOpen: () => void }) => (
    <Button onClick={p.onOpen}>row-cond</Button>
  ),
}));
vi.mock('../health/nicotine/NicotineSection', () => ({
  NicotineOnboardingRow: (p: { onOpen: () => void }) => <Button onClick={p.onOpen}>row-nic</Button>,
}));
vi.mock('../health/nicotine/NicotineProductsView', () => ({
  NicotineProductsView: (p: { onBack: () => void }) => <Button onClick={p.onBack}>nic-back</Button>,
}));
vi.mock('../health/alcohol/AlcoholSection', () => ({
  AlcoholOnboardingRow: (p: { onOpen: () => void }) => <Button onClick={p.onOpen}>row-alc</Button>,
}));
vi.mock('../health/alcohol/AlcoholProductsView', () => ({
  AlcoholProductsView: (p: { onBack: () => void }) => <Button onClick={p.onBack}>alc-back</Button>,
}));
vi.mock('../health/supplements/SupplementSection', () => ({
  SupplementOnboardingRow: (p: { onOpen: () => void }) => (
    <Button onClick={p.onOpen}>row-sup</Button>
  ),
}));
vi.mock('../health/supplements/SupplementProductsView', () => ({
  SupplementProductsView: (p: { onBack: () => void }) => (
    <Button onClick={p.onBack}>sup-back</Button>
  ),
}));
vi.mock('../health/supplements/SupplementQuickStartSheet', () => ({
  SupplementQuickStartSheet: (p: { onClose: () => void; onMore: () => void }) => (
    <div data-testid="sup-quick">
      <Button onClick={p.onClose}>quick-close</Button>
      <Button onClick={p.onMore}>quick-more</Button>
    </div>
  ),
}));

export const TOKEN = 'tok-1';
export const invite = (over: Record<string, unknown> = {}) => ({
  state: 'valid',
  kind: 'invite',
  inviter: 'Coach Kim',
  inviterId: 'c1',
  inviterAvatar: false,
  inviterAvatarUrl: null,
  username: null,
  name: null,
  firstName: null,
  lastName: null,
  expiresAt: NOW + 3 * DAY,
  claimedAt: null,
  revokedAt: null,
  ...over,
});
export const place = (over = {}) => ({
  key: 'p1',
  name: 'Iron Works',
  lat: 54.7,
  lng: 25.3,
  address: 'Gedimino 1',
  ...over,
});

export const open = async (token = TOKEN) => {
  const onDone = vi.fn();
  const out = render(<OnboardingView token={token} onDone={onDone} />);
  await act(async () => {});
  return { ...out, onDone };
};
export const typeInto = (ph: string, v: string) =>
  fireEvent.change(screen.getByPlaceholderText(ph), { target: { value: v } });
/** Step 1 asks for the documents to be opened and both switches ticked before Continue unlocks; safe to call twice. */
export const agreeToTerms = () => {
  if (!vi.isMockFunction(window.open)) {
    vi.spyOn(window, 'open').mockImplementation(() => ({ opener: {} }) as unknown as Window);
  }
  fireEvent.click(screen.getByText('Terms of Use'));
  fireEvent.click(screen.getByText('Privacy Policy'));
  for (const sw of screen.getAllByRole('switch')) {
    if (sw.getAttribute('aria-checked') !== 'true' && !(sw as HTMLInputElement).checked) {
      fireEvent.click(sw);
    }
  }
};
export const goto = async (step: 1 | 2 | 3 | 4 | 5 | 6) => {
  const out = await open();
  fireEvent.click(screen.getByText(en.onbStart));
  if (step === 1) return out;
  typeInto(en.firstName, 'Ana');
  typeInto(en.username, 'ana');
  typeInto(en.passwordMin, 'secret1');
  agreeToTerms();
  m.callFn.mockImplementation(async (name: string) =>
    name === 'claim' ? { token: 'jwt' } : m.inviteResult,
  );
  await act(async () => {
    fireEvent.click(screen.getByText(en.onbContinue));
  });
  if (step === 2) return out;
  fireEvent.click(screen.getByText(en.onbSkipInitials));
  if (step === 3) return out;
  fireEvent.click(screen.getByText(en.onbSkipGym));
  if (step === 4) return out;
  const ins = screen.getAllByPlaceholderText('—');
  fireEvent.change(ins[0], { target: { value: '180' } });
  fireEvent.change(ins[1], { target: { value: '80,5' } });
  fireEvent.click(screen.getByText(en.onbContinue));
  if (step === 5) return out; // the look step (SPO-355)
  fireEvent.click(screen.getByText(en.onbContinue));
  return out;
};

export function resetOnboardingMocks(): void {
  localStorage.clear();
  // Nearby gyms and search are gated on the geo-search consent (SPO-293): these cases run with it granted.
  resetGeoGateForTests();
  setGeoSearchState({ on: true, ready: true, answered: true });
  Object.values(m).forEach(
    (f) => typeof f === 'function' && 'mockReset' in f && (f as { mockReset(): void }).mockReset(),
  );
  m.uid = null;
  m.inviteResult = invite();
  m.callFn.mockImplementation(async () => m.inviteResult);
  m.pos.mockRejectedValue(new Error('denied'));
  m.searchGyms.mockResolvedValue(undefined);
  m.nearby.mockResolvedValue([]);
  m.upsertGym.mockImplementation((g: { name: string; lat: number; lng: number }) => ({
    id: 'g-1',
    ...g,
  }));
  m.startWorkout.mockReturnValue({ id: 'w-1' });
}
