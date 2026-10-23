import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { DAY, emptyState, freezeClock, NOW, seed, setDesktop } from './__fixtures__/viewKit';
import {
  agreeToTerms,
  goto,
  invite,
  m,
  open,
  place,
  resetOnboardingMocks,
  TOKEN,
  typeInto,
} from './__fixtures__/onboardingMocks';
import { OnboardingView } from './OnboardingView';

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  setDesktop(false);
  resetOnboardingMocks();
  seed(emptyState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('OnboardingView: the invite gate', () => {
  it('shows a skeleton while the invite is being checked, then the landing', async () => {
    let res!: (v: unknown) => void;
    m.callFn.mockImplementation(() => new Promise((r) => (res = r)));
    const onDone = vi.fn();
    render(<OnboardingView token={TOKEN} onDone={onDone} />);
    expect(document.querySelector('.onb-skel')).toBeTruthy();
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    expect(m.callFn).toHaveBeenCalledWith('invitePreview', { token: TOKEN });
    await act(async () => res(invite()));
    expect(document.querySelector('.onb-skel')).toBeNull();
    expect(screen.getByText(en.onbTitle)).toBeTruthy();
  });

  it('the landing shows the expiry, the inviter and an Install shortcut', async () => {
    await open();
    expect(screen.getByText(en.onbBody)).toBeTruthy();
    expect(document.querySelector('.footnote')?.textContent).toContain(
      en.onbLinkValid(
        new Date(NOW + 3 * DAY).toLocaleDateString('en', { day: 'numeric', month: 'short' }),
      ),
    );
    expect(screen.getByText(en.onbInvited('Coach Kim'))).toBeTruthy();
    expect(document.querySelectorAll('.onb-rail .bar.on')).toHaveLength(1);
    expect(document.querySelector('.onb-top button')).toBeTruthy();
  });

  it('uses the inviter photo when the invite carries one, and none without an inviter', async () => {
    m.inviteResult = invite({ inviterAvatarUrl: 'https://img.test/c.jpg' });
    const { unmount } = await open();
    expect(document.querySelector('.onb-inviter img')?.getAttribute('src')).toBe(
      'https://img.test/c.jpg',
    );
    unmount();
    m.inviteResult = invite({ inviter: null });
    await open();
    expect(document.querySelector('.onb-inviter')).toBeNull();
  });

  it.each(['expired', 'claimed', 'revoked'] as const)(
    'a %s invite shows the dead page and can ask for a new one',
    async (state) => {
      m.inviteResult = invite({
        state,
        claimedAt: state === 'claimed' ? NOW - DAY : null,
        revokedAt: state === 'revoked' ? NOW - DAY : null,
      });
      const { onDone } = await open();
      expect(screen.getByText(en.onbDead)).toBeTruthy();
      const when = new Date(state === 'expired' ? NOW + 3 * DAY : NOW - DAY).toLocaleDateString(
        'en',
        { day: 'numeric', month: 'short' },
      );
      expect(screen.getByText(en.onbDeadBody(when))).toBeTruthy();
      fireEvent.click(screen.getByText(en.onbRequestNew));
      expect(m.callFn).toHaveBeenCalledWith('requestNewInvite', { token: TOKEN });
      const done = screen.getByText(en.onbRequested).closest('button') as HTMLButtonElement;
      expect(done.disabled).toBe(true);
      fireEvent.click(screen.getByText(en.onbHaveAccount));
      expect(onDone).toHaveBeenCalledWith();
    },
  );

  it('a failed preview shows the dead page without a date', async () => {
    m.callFn.mockRejectedValue(new Error('net'));
    await open();
    expect(screen.getByText(en.onbDead)).toBeTruthy();
    expect(screen.getByText(en.onbDeadBody(''))).toBeTruthy();
  });

  it('a failed "request new" call is swallowed and still reads as requested', async () => {
    m.inviteResult = invite({ state: 'expired' });
    await open();
    m.callFn.mockRejectedValue(new Error('net'));
    await act(async () => {
      fireEvent.click(screen.getByText(en.onbRequestNew));
    });
    expect(screen.getByText(en.onbRequested)).toBeTruthy();
  });

  it('an already-claimed invite resumes when this device has progress and is signed in', async () => {
    m.inviteResult = invite({ state: 'claimed', claimedAt: NOW - DAY });
    m.uid = 'u1';
    localStorage.setItem(
      `onb.${TOKEN}`,
      JSON.stringify({ step: 3, name: 'Ana Kay', username: 'ana' }),
    );
    await open();
    expect(screen.getByText(en.onbTitle)).toBeTruthy();
    expect(screen.queryByText(en.onbDead)).toBeNull();
  });

  it('a corrupt resume record is ignored', async () => {
    localStorage.setItem(`onb.${TOKEN}`, '{not json');
    await open();
    expect(screen.getByText(en.onbTitle)).toBeTruthy();
  });
});

describe('OnboardingView: reset link', () => {
  beforeEach(() => {
    m.inviteResult = invite({ kind: 'reset', username: 'ana', name: 'Ana Kay' });
  });

  it('asks only for a new password, enabled from six characters', async () => {
    await open();
    const save = screen.getByText(en.save).closest('button') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    typeInto(en.passwordMin, '12345');
    expect(save.disabled).toBe(true);
    typeInto(en.passwordMin, '123456');
    expect(save.disabled).toBe(false);
  });

  it('claims with the reset password, signs in and finishes', async () => {
    m.callFn.mockImplementation(async (name: string) =>
      name === 'claim' ? { token: 'jwt' } : m.inviteResult,
    );
    const { onDone } = await open();
    typeInto(en.passwordMin, 'newpass1');
    await act(async () => {
      fireEvent.click(screen.getByText(en.save));
    });
    expect(m.callFn).toHaveBeenCalledWith('claim', {
      token: TOKEN,
      password: 'newpass1',
      username: 'ana',
      firstName: 'Ana',
      lastName: 'Kay',
    });
    expect(m.signIn).toHaveBeenCalledWith({ token: 'jwt' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows the server error and stays', async () => {
    m.callFn.mockImplementation(async (name: string) => {
      if (name === 'claim') throw new Error('Link used');
      return m.inviteResult;
    });
    const { onDone } = await open();
    typeInto(en.passwordMin, 'newpass1');
    await act(async () => {
      fireEvent.click(screen.getByText(en.save));
    });
    expect(document.querySelector('.field-error')?.textContent).toContain('Link used');
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('OnboardingView: step 1, who are you', () => {
  it('prefills the names and username from the invite and says so', async () => {
    m.inviteResult = invite({ name: 'Ana Kay Smith', username: 'anak' });
    await open();
    fireEvent.click(screen.getByText(en.onbStart));
    expect((screen.getByPlaceholderText(en.firstName) as HTMLInputElement).value).toBe('Ana');
    expect((screen.getByPlaceholderText(en.lastName) as HTMLInputElement).value).toBe('Kay Smith');
    expect((screen.getByPlaceholderText(en.username) as HTMLInputElement).value).toBe('anak');
    expect(screen.getByText(en.onbPrefilled)).toBeTruthy();
    expect(screen.getByText(en.onbStepOf(1))).toBeTruthy();
    expect(document.querySelectorAll('.onb-steptop .bar.on')).toHaveLength(1);
  });

  it('prefers explicit first/last name fields and falls back to the invited name as username', async () => {
    m.inviteResult = invite({ name: 'Zed', firstName: 'Ann', lastName: 'Lee' });
    await open();
    fireEvent.click(screen.getByText(en.onbStart));
    expect((screen.getByPlaceholderText(en.firstName) as HTMLInputElement).value).toBe('Ann');
    expect((screen.getByPlaceholderText(en.lastName) as HTMLInputElement).value).toBe('Lee');
    expect((screen.getByPlaceholderText(en.username) as HTMLInputElement).value).toBe('Zed');
  });

  it('Continue needs a 2+ letter name and username and a 6+ character password', async () => {
    await open();
    fireEvent.click(screen.getByText(en.onbStart));
    const cont = () => screen.getByText(en.onbContinue).closest('button') as HTMLButtonElement;
    expect(cont().disabled).toBe(true);
    typeInto(en.firstName, 'A');
    typeInto(en.username, 'an');
    typeInto(en.passwordMin, 'secret1');
    agreeToTerms();
    expect(cont().disabled).toBe(true);
    typeInto(en.firstName, 'An');
    expect(cont().disabled).toBe(false);
    typeInto(en.passwordMin, '12345');
    expect(cont().disabled).toBe(true);
    typeInto(en.passwordMin, '123456');
    typeInto(en.username, ' a ');
    expect(cont().disabled).toBe(true);
  });

  it('claims the invite with trimmed username, advances and stores progress', async () => {
    await open();
    fireEvent.click(screen.getByText(en.onbStart));
    typeInto(en.firstName, 'Ana');
    typeInto(en.lastName, 'Kay');
    typeInto(en.username, '  ana  ');
    typeInto(en.passwordMin, 'secret1');
    agreeToTerms();
    fireEvent.blur(screen.getByPlaceholderText(en.username));
    expect(JSON.parse(localStorage.getItem(`onb.${TOKEN}`)!)).toMatchObject({
      step: 1,
      username: '  ana  ',
      firstName: 'Ana',
    });
    m.callFn.mockImplementation(async (n: string) =>
      n === 'claim' ? { token: 'jwt' } : m.inviteResult,
    );
    await act(async () => {
      fireEvent.click(screen.getByText(en.onbContinue));
    });
    expect(m.callFn).toHaveBeenCalledWith('claim', {
      token: TOKEN,
      password: 'secret1',
      username: 'ana',
      firstName: 'Ana',
      lastName: 'Kay',
    });
    expect(m.signIn).toHaveBeenCalledWith({ token: 'jwt' });
    expect(screen.getByText(en.onbFaceLead)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(`onb.${TOKEN}`)!).step).toBe(2);
  });

  it('a failed claim shows its message on the password field and stays on step 1', async () => {
    await open();
    fireEvent.click(screen.getByText(en.onbStart));
    typeInto(en.firstName, 'Ana');
    typeInto(en.username, 'ana');
    typeInto(en.passwordMin, 'secret1');
    agreeToTerms();
    m.callFn.mockImplementation(async (n: string) => {
      if (n === 'claim') throw new Error('Username taken');
      return m.inviteResult;
    });
    await act(async () => {
      fireEvent.click(screen.getByText(en.onbContinue));
    });
    expect(screen.getByText('Username taken')).toBeTruthy();
    expect(screen.getByText(en.onbWhoLead)).toBeTruthy();
    expect((screen.getByText(en.onbContinue).closest('button') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('a non-Error failure falls back to the generic message', async () => {
    await open();
    fireEvent.click(screen.getByText(en.onbStart));
    typeInto(en.firstName, 'Ana');
    typeInto(en.username, 'ana');
    typeInto(en.passwordMin, 'secret1');
    agreeToTerms();
    m.callFn.mockImplementation(async (n: string) => {
      if (n === 'claim') throw 'boom';
      return m.inviteResult;
    });
    await act(async () => {
      fireEvent.click(screen.getByText(en.onbContinue));
    });
    expect(screen.getByText(en.error)).toBeTruthy();
  });

  it('when the account already exists from an earlier run, it skips the claim and just advances', async () => {
    m.uid = 'u1';
    localStorage.setItem(
      `onb.${TOKEN}`,
      JSON.stringify({ step: 2, name: 'Ana Kay', username: 'ana' }),
    );
    await open();
    fireEvent.click(screen.getByText(en.onbStart));
    expect((screen.getByPlaceholderText(en.firstName) as HTMLInputElement).value).toBe('Ana');
    typeInto(en.passwordMin, 'secret1'); // an existing account has already agreed: no agreement block
    await act(async () => {
      fireEvent.click(screen.getByText(en.onbContinue));
    });
    expect(m.callFn).not.toHaveBeenCalledWith('claim', expect.anything());
    expect(screen.getByText(en.onbFaceLead)).toBeTruthy();
  });

  it('Back walks one step back, saving where the user is', async () => {
    await open();
    fireEvent.click(screen.getByText(en.onbStart));
    fireEvent.click(screen.getByRole('button', { name: en.onbBack }));
    expect(screen.getByText(en.onbTitle)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(`onb.${TOKEN}`)!).step).toBe(0);
  });
});

describe('OnboardingView: step 2 photo', () => {
  it('skipping or continuing without a photo moves on and records that', async () => {
    await goto(2);
    expect(screen.getByText(en.onbStepOf(2))).toBeTruthy();
    expect(screen.getByText(en.onbFaceNote)).toBeTruthy();
    fireEvent.click(screen.getByText(en.onbContinue));
    expect(screen.getByText(en.onbGymLead)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(`onb.${TOKEN}`)!)).toMatchObject({
      step: 3,
      avatarDone: false,
    });
  });

  it('an uploaded photo moves on and records it', async () => {
    await goto(2);
    fireEvent.click(screen.getByText('stub-upload'));
    expect(JSON.parse(localStorage.getItem(`onb.${TOKEN}`)!)).toMatchObject({
      step: 3,
      avatarDone: true,
    });
  });
});

describe('OnboardingView: step 3 gym', () => {
  const pending = async () => {
    await goto(3);
    return screen;
  };

  it('with location denied shows the banner and no nearby list; skipping goes on without a gym', async () => {
    await pending();
    await act(async () => {});
    expect(screen.getByText(en.locationBlockedBody)).toBeTruthy();
    expect(document.querySelector('.onb-near')).toBeNull();
    fireEvent.click(screen.getByText(en.onbSkipGym));
    expect(m.upsertGym).not.toHaveBeenCalled();
    expect(screen.getByText(en.onbBodyLead)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(`onb.${TOKEN}`)!).step).toBe(4);
  });

  it('shows skeleton cards while the nearby list loads, then the closest gyms first', async () => {
    m.pos.mockResolvedValue({ lat: 54.7, lng: 25.3, accuracy: 10 });
    let res!: (v: unknown) => void;
    m.nearby.mockImplementation(() => new Promise((r) => (res = r)));
    await goto(3);
    await act(async () => {});
    expect(document.querySelectorAll('.onb-gym-card.skeleton')).toHaveLength(3);
    expect(document.querySelector('.onb-near')).toBeTruthy();
    await act(async () =>
      res([
        place({ key: 'far', name: 'Far Gym', lat: 54.75, lng: 25.3 }),
        place({ key: 'near', name: 'Near Gym', lat: 54.7005 }),
      ]),
    );
    const names = [...document.querySelectorAll('.onb-gym-card .n')].map((x) => x.textContent);
    expect(names).toEqual(['Near Gym', 'Far Gym']);
    expect(document.querySelector('.onb-near')?.textContent).toContain('2.0 km');
    expect(document.querySelectorAll('.onb-gym-card.skeleton')).toHaveLength(0);
    const sub = document.querySelector('.onb-gym-card .s')?.textContent;
    expect(sub).toMatch(/Gedimino 1 · \d+ m/);
  });

  it('shows at most four nearby gyms', async () => {
    m.pos.mockResolvedValue({ lat: 54.7, lng: 25.3, accuracy: 10 });
    m.nearby.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) =>
        place({ key: `k${i}`, name: `G${i}`, lat: 54.7 + i / 1000 }),
      ),
    );
    await goto(3);
    await act(async () => {});
    expect(document.querySelectorAll('.onb-gym-card')).toHaveLength(4);
  });

  it('picking a gym saves it, caches its address and carries its name to the final screen', async () => {
    m.pos.mockResolvedValue({ lat: 54.7, lng: 25.3, accuracy: 10 });
    m.nearby.mockResolvedValue([place()]);
    await goto(3);
    await act(async () => {});
    fireEvent.click(document.querySelector('.onb-gym-card') as HTMLElement);
    expect(m.upsertGym).toHaveBeenCalledWith({
      name: 'Iron Works',
      lat: 54.7,
      lng: 25.3,
      radiusM: expect.any(Number),
    });
    expect(m.cacheAddress).toHaveBeenCalledWith(54.7, 25.3, 'Gedimino 1');
    expect(JSON.parse(localStorage.getItem(`onb.${TOKEN}`)!)).toMatchObject({
      step: 4,
      gymId: 'g-1',
      gymName: 'Iron Works',
    });
    expect(screen.getByText(en.onbBodyLead)).toBeTruthy();
  });

  it('a gym without an address is not cached', async () => {
    m.pos.mockResolvedValue({ lat: 54.7, lng: 25.3, accuracy: 10 });
    m.nearby.mockResolvedValue([place({ address: undefined })]);
    await goto(3);
    await act(async () => {});
    fireEvent.click(document.querySelector('.onb-gym-card') as HTMLElement);
    expect(m.cacheAddress).not.toHaveBeenCalled();
  });

  it('typing a search debounces, shows skeletons, then lists results (distance-sorted when located)', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    m.pos.mockResolvedValue({ lat: 54.7, lng: 25.3, accuracy: 10 });
    await goto(3);
    await act(async () => {});
    m.searchGyms.mockImplementation(
      async (
        _q: string,
        _c: unknown,
        _s: unknown,
        _sig: unknown,
        h: { onResults: (r: unknown[]) => void },
      ) => {
        h.onResults([
          place({ key: 'b', name: 'B Gym', lat: 54.9 }),
          place({ key: 'a', name: 'A Gym', lat: 54.701 }),
        ]);
      },
    );
    fireEvent.change(
      screen.getByRole('searchbox') ?? screen.getByPlaceholderText(en.searchGymPlaceholder),
      { target: { value: 'iron' } },
    );
    expect(document.querySelectorAll('.onb-gym-card.skeleton')).toHaveLength(3);
    expect(m.searchGyms).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(m.searchGyms.mock.calls[0][0]).toBe('iron');
    expect([...document.querySelectorAll('.onb-gym-card .n')].map((x) => x.textContent)).toEqual([
      'A Gym',
      'B Gym',
    ]);
    expect(document.querySelector('.onb-near')).toBeNull();
  });

  it('a one-letter query is ignored and the nearby list stays', async () => {
    m.pos.mockResolvedValue({ lat: 54.7, lng: 25.3, accuracy: 10 });
    m.nearby.mockResolvedValue([place()]);
    await goto(3);
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText(en.searchGymPlaceholder), {
      target: { value: 'i' },
    });
    expect(m.searchGyms).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.onb-gym-card')).toHaveLength(1);
  });

  it('a search that finishes with nothing leaves the list empty rather than loading forever', async () => {
    await goto(3);
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    fireEvent.change(screen.getByPlaceholderText(en.searchGymPlaceholder), {
      target: { value: 'zzz' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(document.querySelectorAll('.onb-gym-card')).toHaveLength(0);
    expect(document.querySelectorAll('.onb-gym-card.skeleton')).toHaveLength(0);
  });
});
