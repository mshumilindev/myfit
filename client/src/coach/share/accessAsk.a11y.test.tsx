/** axe (WCAG 2 A/AA) on the SPO-99 surfaces: the trainer's sheet, the chat card on both sides, the client's one-time form. */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetHealthGateForTests } from '../../data/healthConsentGate';
import { setViewport } from '../testViewport';
import { createFixturesClientPort } from '../client/data/__fixtures__/fixtures';
import { AccessAskForm } from '../client/screens/AccessAskForm';
import { AccessAskCard } from './AccessAskCard';
import { RequestAccessSheet } from './RequestAccessSheet';
import type { AccessAsk, AskStatus } from './accessAsk';

/** axe in jsdom: contrast needs real layout, so it is off here (the story audit and CI layout shards cover it). */
async function violations(el: HTMLElement) {
  const r = await axe.run(el, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

const ask = (cats: AccessAsk['cats']): AccessAsk => ({ reqId: 'access-ask:1', cats });
const noop = () => undefined;
const STATUSES: AskStatus[] = ['waiting', 'allowed', 'partial', 'declined', 'expired'];

beforeEach(() => {
  setViewport(390);
  resetHealthGateForTests(true);
});
afterEach(cleanup);

describe('access ask: accessibility (SPO-99, SPO-411)', () => {
  it('the trainer sheet: normal, no app, paused', async () => {
    const { baseElement, rerender } = render(
      <RequestAccessSheet first="Oleh" shared={{ totals: 'full' }} onSend={noop} onClose={noop} />,
    );
    expect(await violations(baseElement)).toEqual([]);
    rerender(<RequestAccessSheet first="Oleh" shared={{}} noApp onSend={noop} onClose={noop} />);
    expect(await violations(baseElement)).toEqual([]);
    rerender(
      <RequestAccessSheet
        first="Oleh"
        shared={{}}
        pause={{ blocked: true, until: Date.UTC(2026, 9, 31, 10), reason: 'declined' }}
        onSend={noop}
        onClose={noop}
      />,
    );
    expect(await violations(baseElement)).toEqual([]);
  });

  it.each(['trainer', 'client'] as const)(
    'the chat card on the %s side, every status',
    async (side) => {
      const { container } = render(
        <div>
          {STATUSES.map((s) => (
            <AccessAskCard
              key={s}
              ask={ask(['sleep', 'nutrition', 'conditions'])}
              status={s}
              side={side}
              mine={side === 'trainer'}
              first="Oleh"
              onReview={noop}
            />
          ))}
        </div>,
      );
      expect(await violations(container)).toEqual([]);
    },
  );

  it("the client's form", async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const { baseElement } = render(
      <AccessAskForm
        first="Anna"
        ask={ask(['nutrition', 'conditions', 'alcohol'])}
        port={port}
        onDone={noop}
        onClose={noop}
      />,
    );
    await waitFor(() => expect(screen.getAllByRole('group').length).toBeGreaterThan(0));
    expect(await violations(baseElement)).toEqual([]);
  });
});
