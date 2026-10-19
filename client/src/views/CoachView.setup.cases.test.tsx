import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { __getStateForTests } from '../store';
import type { StoreState } from '../store';
import {
  emptyState,
  freezeClock,
  installIntersectionObserver,
  NOW,
  richState,
  seed,
} from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({
  push: 'off' as 'on' | 'off' | 'needs-install',
  enable: vi.fn(async (): Promise<string> => 'on'),
}));
vi.mock('../push', async (orig) => ({
  ...(await orig<typeof import('../push')>()),
  pushState: () => m.push,
  enablePush: (...a: unknown[]) => (m.enable as (...x: unknown[]) => Promise<string>)(...a),
}));

import { CoachView } from './CoachView';

const open = () => {
  const onClose = vi.fn();
  const out = render(<CoachView onClose={onClose} />);
  return { ...out, onClose };
};
const btn = (name: string) => screen.getByRole('button', { name });
const coach = () => __getStateForTests().coach;
const withBody = (body: Partial<StoreState['bodyMetrics']>, workouts = 0): StoreState => {
  const base = emptyState();
  return {
    ...base,
    workouts: richState().workouts.slice(0, workouts),
    bodyMetrics: { ...base.bodyMetrics, ...body },
  };
};
const toData = (temper: 'Bro' | 'Neutral' | 'Savage' = 'Neutral') => {
  fireEvent.click(btn(en.atlasChooseTemper));
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(temper) }));
  fireEvent.click(document.querySelector('.atl-cta') as HTMLElement);
};

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  m.push = 'off';
  m.enable.mockReset();
  m.enable.mockResolvedValue('on');
  seed(emptyState());
  installIntersectionObserver();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CoachView: setup flow', () => {
  it('opens on the intro with all three faces; Not now and Back both close', () => {
    const { onClose } = open();
    expect(screen.getByText(en.atlasMeetText)).toBeTruthy();
    expect(document.querySelectorAll('.atl-faces > *')).toHaveLength(3);
    fireEvent.click(btn(en.atlasNotNow));
    fireEvent.click(btn(en.backAction));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(coach().enabled).toBe(false);
  });

  it('temper step offers three tempers, preselects the stored one and labels the CTA with its name', () => {
    open();
    fireEvent.click(btn(en.atlasChooseTemper));
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(btn(en.atlasTrainWith('Neutral'))).toBeTruthy();
    fireEvent.click(radios[0]);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect(btn(en.atlasTrainWith('Bro'))).toBeTruthy();
    fireEvent.click(btn(en.backAction));
    expect(screen.getByText(en.atlasMeetText)).toBeTruthy();
  });

  it('Savage goes through the fine print; its switches are on by default and can be turned off', () => {
    open();
    toData('Savage');
    expect(screen.getByText(en.atlasFineTitle)).toBeTruthy();
    const mom = screen.getByRole('switch', { name: en.atlasRuleMom }) as HTMLInputElement;
    const swear = screen.getByRole('switch', { name: en.atlasRuleSwear }) as HTMLInputElement;
    expect(mom.checked).toBe(true);
    expect(swear.checked).toBe(true);
    fireEvent.click(mom);
    expect(mom.checked).toBe(false);
    fireEvent.click(btn(en.atlasSofter));
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('Back from the data step returns to the fine print for Savage and to the temper step otherwise', () => {
    open();
    toData('Savage');
    fireEvent.click(btn(en.atlasTakeIt));
    expect(screen.getByText(en.atlasKnowIntro)).toBeTruthy();
    fireEvent.click(btn(en.backAction));
    expect(screen.getByText(en.atlasFineTitle)).toBeTruthy();
    fireEvent.click(btn(en.backAction));
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(document.querySelector('.atl-cta') as HTMLElement);
    fireEvent.click(btn(en.backAction));
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });
});

describe('CoachView: data step', () => {
  it('lists what is known and marks what is missing', () => {
    seed(withBody({ sex: 'female', heightCm: 170, dob: '1990-05-05' }, 2));
    open();
    toData();
    const kv = Object.fromEntries(
      [...document.querySelectorAll('.atl-kv')].map((r) => [
        r.querySelector('span')?.textContent,
        r.querySelector('b')?.textContent,
      ]),
    );
    expect(kv[en.atlasKnowSessions]).toBe('2');
    expect(kv[en.atlasKnowWeight]).toBe(en.atlasMissing);
    expect(kv[en.atlasKnowSex]).toBe(en.atlasFemale);
    expect(kv[en.atlasKnowBirth]).toBe('1990');
    expect(kv[en.atlasKnowHeight]).toBe('170 cm');
    expect(document.querySelector('.atl-kv b.miss')?.textContent).toBe(en.atlasMissing);
    expect(screen.queryByText(en.atlasAskSex)).toBeNull();
    expect(screen.queryByText(en.atlasAskBirth)).toBeNull();
    expect(screen.queryByText(en.atlasAskHeight)).toBeNull();
  });

  it('asks sex, then birth year, then height - one at a time - and stores the answers', () => {
    open();
    toData();
    expect(screen.getByText(en.atlasAskSex)).toBeTruthy();
    fireEvent.click(btn(en.atlasMale));
    expect(__getStateForTests().bodyMetrics.sex).toBe('male');
    expect(screen.getByText(en.atlasAskBirth)).toBeTruthy();
    const thisYear = new Date().getFullYear();
    const years = () =>
      [...document.querySelectorAll('.atl-years .uichip')].map((c) => c.textContent);
    expect(years()).toContain(String(thisYear - 30));
    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(years()).toContain(String(thisYear - 35));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    // the list never offers anyone younger than 12
    expect(years().every((y) => !y || Number(y) <= thisYear - 12 || y === '')).toBe(true);
    const pickYear = years().find(Boolean) as string;
    fireEvent.click(btn(pickYear));
    expect(__getStateForTests().bodyMetrics.dob).toBe(`${pickYear}-07-01`);
    expect(screen.getByText(en.atlasAskHeight)).toBeTruthy();
    expect(document.querySelector('.atl-stepper b')?.textContent).toBe('178 cm');
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(document.querySelector('.atl-stepper b')?.textContent).toBe('179 cm');
    fireEvent.click(btn(en.atlasSave));
    expect(__getStateForTests().bodyMetrics.heightCm).toBe(179);
    expect(screen.queryByText(en.atlasAskHeight)).toBeNull();
  });

  it('Female and Skip answers move on; Skip stores nothing', () => {
    open();
    toData();
    fireEvent.click(btn(en.atlasFemale));
    expect(__getStateForTests().bodyMetrics.sex).toBe('female');
    fireEvent.click(btn(en.atlasSkip));
    expect(__getStateForTests().bodyMetrics.dob).toBeFalsy();
    expect(screen.getByText(en.atlasAskHeight)).toBeTruthy();
    fireEvent.click(btn(en.atlasSkip));
    expect(__getStateForTests().bodyMetrics.heightCm).toBeFalsy();
    expect(screen.getByText(en.atlasSkipHint)).toBeTruthy();
  });

  it('skipping sex keeps it unset', () => {
    open();
    toData();
    fireEvent.click(btn(en.atlasSkip));
    expect(__getStateForTests().bodyMetrics.sex).toBeFalsy();
    expect(screen.getByText(en.atlasAskBirth)).toBeTruthy();
  });
});

describe('CoachView: finishing', () => {
  const full = () => seed(withBody({ sex: 'male', heightCm: 180, dob: '1992-04-12' }, 1));

  it('enables the coach straight away when notifications are already on', () => {
    m.push = 'on';
    full();
    open();
    toData();
    fireEvent.click(btn(en.atlasNext));
    expect(coach().enabled).toBe(true);
    expect(coach().temper).toBe(3);
    expect(coach().role).toBe('main');
    expect(coach().yoMama).toBe(false);
    expect(coach().swearing).toBe(false);
    expect(coach().startedAt).toBe(NOW);
    expect(coach().readAt).toBe(0);
  });

  it('Savage keeps the extras it was left with; turning one off is stored', () => {
    m.push = 'on';
    full();
    open();
    toData('Savage');
    fireEvent.click(screen.getByRole('switch', { name: en.atlasRuleSwear }));
    fireEvent.click(btn(en.atlasTakeIt));
    fireEvent.click(btn(en.atlasNext));
    expect(coach().temper).toBe(5);
    expect(coach().yoMama).toBe(true);
    expect(coach().swearing).toBe(false);
  });

  it('with notifications off it offers them; Not now enables the coach without them', () => {
    full();
    open();
    toData();
    fireEvent.click(btn(en.atlasNext));
    expect(coach().enabled).toBe(false);
    expect(screen.getByText(en.atlasPushTitle)).toBeTruthy();
    expect(screen.queryByText(en.pushNeedsInstall)).toBeNull();
    fireEvent.click(btn(en.atlasNotNow));
    expect(coach().enabled).toBe(true);
  });

  it('turning notifications on enables the coach after the permission succeeds', async () => {
    full();
    open();
    toData();
    fireEvent.click(btn(en.atlasNext));
    fireEvent.click(btn(en.atlasPushOn));
    await waitFor(() => expect(coach().enabled).toBe(true));
    expect(m.enable).toHaveBeenCalledWith('en');
  });

  it('a refused permission shows the hint and keeps the user on the step', async () => {
    m.enable.mockResolvedValue('denied');
    full();
    open();
    toData();
    fireEvent.click(btn(en.atlasNext));
    fireEvent.click(btn(en.atlasPushOn));
    await screen.findByText(en.pushDenied);
    expect(coach().enabled).toBe(false);
  });

  it('on a browser that needs installing the enable button is replaced by the install hint', () => {
    m.push = 'needs-install';
    full();
    open();
    toData();
    fireEvent.click(btn(en.atlasNext));
    expect(screen.getByText(en.pushNeedsInstall)).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.atlasPushOn })).toBeNull();
    fireEvent.click(btn(en.atlasNotNow));
    expect(coach().enabled).toBe(true);
  });
});
