/**
 * The program editor page is ONE layout: the Coach host and the athlete host render the same DOM skeleton for every
 * common part (back pill, title block, action cluster, info band, toolbar, training days, day card, inspector). Only the
 * content of the functional slots differs, and those are pruned below ON PURPOSE (each with the reason).
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewport } from '../../../coach/testViewport';
import { setLocale } from '../../../i18n';
import { firstToken, skeleton } from './domSkeleton';
import { HostPair, type PairHostKind, type PairState } from '../stories/HostPair';

const STATES: PairState[] = [
  'empty',
  'selected',
  'activity',
  'warmup',
  'findings',
  'readonly',
  'muscles',
];

function render1(host: PairHostKind, state: PairState): Element {
  cleanup();
  const { container } = render(<HostPair host={host} state={state} />);
  return container.querySelector('.pe-page')!;
}

beforeEach(() => {
  setLocale('en');
  setViewport(1440);
});
afterEach(cleanup);

describe('program editor page: one DOM skeleton for both hosts', () => {
  it.each(STATES)('%s: the same landmarks, roles and class structure', (state) => {
    const coach = skeleton(render1('coach', state)).join('\n');
    const athlete = skeleton(render1('athlete', state)).join('\n');
    expect(athlete).toBe(coach);
  });

  it.each(STATES)('%s: the chrome slots sit in the same order', (state) => {
    for (const host of ['coach', 'athlete'] as const) {
      const page = render1(host, state);
      const top = [...page.children].map((c) => firstToken(c)!);
      expect(top.slice(0, 2), host).toEqual(['pe-page-back', 'pe-page-head']);
      expect(top[top.length - 1], host).toBe('pe-root');
      const head = page.querySelector('.pe-page-head')!;
      expect([...head.children].map((c) => firstToken(c)!)).toEqual([
        'pe-page-title',
        'pe-page-cluster',
      ]);
      expect(head.querySelectorAll('h1').length).toBe(1);
      expect(page.querySelectorAll('h1').length).toBe(1);
      // the toolbar comes before the training days, the days before the day card
      const order = ['.pe-toolbar', '.pe-days-sec', '.pe-dc']
        .map((s) => page.querySelector(s))
        .filter(Boolean) as Element[];
      for (let i = 1; i < order.length; i++)
        expect(
          order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    }
  });

  it('the main action is the last button of the cluster, in both hosts', () => {
    for (const host of ['coach', 'athlete'] as const) {
      const page = render1(host, 'selected');
      const buttons = [...page.querySelectorAll('.pe-page-cluster > .uibtn')];
      expect(buttons.length, host).toBeGreaterThan(1);
      expect(buttons[buttons.length - 1].className, host).toContain('uibtn--primary');
      expect(new Set(buttons.map((b) => b.className.match(/uibtn--(sm|md|lg)/)![1])), host).toEqual(
        new Set(['sm']),
      );
    }
  });

  it('a phone gets the same buttons in the sticky bar, in both hosts', () => {
    setViewport(390);
    for (const host of ['coach', 'athlete'] as const) {
      const page = render1(host, 'selected');
      expect(page.querySelectorAll('.pe-page-cluster > .uibtn').length, host).toBe(0);
      expect(page.querySelectorAll('.pe-page-bar .uibtn').length, host).toBeGreaterThan(1);
    }
  });
});
