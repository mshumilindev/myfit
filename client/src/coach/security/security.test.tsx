import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeEn as sf } from '../../i18n/coachSafe.en';
import { securityCode } from '../../coachCrypto/securityCode';
import { setViewport } from '../testViewport';
import { KeyChangeBanner } from './KeyChangeBanner';
import { SecurityCodeDialog } from './SecurityCodeDialog';
import { createFixturesTrustPort } from './__fixtures__/trustPort';
import {
  acknowledge,
  createMemoryTrustStore,
  isVerified,
  observe,
  unverify,
  verify,
} from './trustStore';
import { useSecurity } from './useSecurity';

beforeEach(() => setViewport(1440));
afterEach(cleanup);

describe('trust record (pure)', () => {
  it('the first code is remembered silently; a different one raises pending', () => {
    const a = observe(null, '1111 1111 1111 1111 1111 1111');
    expect(a).toMatchObject({ changed: false, rec: { pending: false, verified: null } });
    expect(observe(a.rec, a.rec.seen).changed).toBe(false);
    const b = observe(a.rec, '2222 2222 2222 2222 2222 2222');
    expect(b.changed).toBe(true);
    expect(b.rec.pending).toBe(true);
    expect(acknowledge(b.rec).pending).toBe(false);
  });
  it('verified means THIS code: a new key invalidates an earlier verification', () => {
    const v = verify(observe(null, 'A').rec);
    expect(isVerified(v)).toBe(true);
    const changed = observe(v, 'B').rec;
    expect(isVerified(changed)).toBe(false);
    expect(changed.verified).toBe('A'); // kept for the record, never shown as verified
    expect(isVerified(unverify(v))).toBe(false);
  });
});

describe('useSecurity over the fixtures port', () => {
  it('derives a stable 24-digit code in six groups and remembers verification', async () => {
    const port = createFixturesTrustPort();
    const store = createMemoryTrustStore();
    const { result } = renderHook(() => useSecurity('t1', 'cid1', { port, store }));
    await waitFor(() => expect(result.current.code).toMatch(/^(\d{4} ){5}\d{4}$/));
    expect(result.current.verified).toBe(false);
    act(() => result.current.verify());
    await waitFor(() => expect(result.current.verified).toBe(true));
    expect((await store.load('cid1'))?.verified).toBe(result.current.code);
  });

  it('a key change shows pending, fires onChange once, and invalidates the verification', async () => {
    const port = createFixturesTrustPort();
    const store = createMemoryTrustStore();
    const onChange = vi.fn();
    const { result } = renderHook(() => useSecurity('t1', 'cid1', { port, store, onChange }));
    await waitFor(() => expect(result.current.code).not.toBeNull());
    act(() => result.current.verify());
    await waitFor(() => expect(result.current.verified).toBe(true));
    const before = result.current.code;
    await act(async () => port.rotate('t1'));
    await waitFor(() => expect(result.current.changed).toBe(true));
    expect(result.current.code).not.toBe(before);
    expect(result.current.verified).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => result.current.acknowledge());
    await waitFor(() => expect(result.current.changed).toBe(false));
  });

  it('a change that happened while the app was closed is noticed on return', async () => {
    const port = createFixturesTrustPort();
    const store = createMemoryTrustStore();
    await store.save('cid1', {
      seen: '0000 0000 0000 0000 0000 0000',
      verified: null,
      pending: false,
    });
    const onChange = vi.fn();
    const { result } = renderHook(() => useSecurity('t1', 'cid1', { port, store, onChange }));
    await waitFor(() => expect(result.current.changed).toBe(true));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a trainer', () => {
    const { result } = renderHook(() =>
      useSecurity(null, null, { port: createFixturesTrustPort() }),
    );
    expect(result.current.code).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});

describe('the dialog and the banner', () => {
  const state = (over = {}) => ({
    code: '0412 9981 3307 5528 1046 7790',
    verified: false,
    changed: false,
    loading: false,
    verify: vi.fn(),
    unverify: vi.fn(),
    ...over,
  });
  it('trainer wording, six groups, I-verified calls back', () => {
    const s = state();
    render(
      <SecurityCodeDialog security={s} side="trainer" name="Maria" onClose={() => undefined} />,
    );
    expect(screen.getByRole('alertdialog').textContent).toContain(sf.scIntroTrainer('Maria'));
    expect(screen.getByRole('list', { name: /Security code/ }).querySelectorAll('li')).toHaveLength(
      6,
    );
    fireEvent.click(screen.getByRole('button', { name: sf.scVerify }));
    expect(s.verify).toHaveBeenCalled();
  });
  it('client wording; no code says so instead of faking one', () => {
    render(
      <SecurityCodeDialog
        security={state({ code: null })}
        side="client"
        name="Iryna"
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('alertdialog').textContent).toContain(sf.scIntroClient('Iryna'));
    expect(screen.getByText(sf.scNoKey)).toBeTruthy();
    expect(screen.queryByRole('button', { name: sf.scVerify })).toBeNull();
  });
  it('banner names the trainer and offers Review', () => {
    const onReview = vi.fn();
    render(<KeyChangeBanner name="Iryna" onReview={onReview} />);
    expect(screen.getByTestId('key-change-banner').textContent).toContain(
      sf.scChangedTitle('Iryna'),
    );
    fireEvent.click(screen.getByRole('button', { name: sf.scChangedReview }));
    expect(onReview).toHaveBeenCalled();
  });
  it('the fixtures code equals securityCode of the fixture key', async () => {
    const p = createFixturesTrustPort();
    const got = await new Promise<string | null>((res, rej) =>
      p.subscribe('t9', (k) => res(k.code), rej),
    );
    expect(got).toBe(
      await securityCode((await import('./__fixtures__/trustPort')).fixtureJwk('t9#0')),
    );
  });
});
