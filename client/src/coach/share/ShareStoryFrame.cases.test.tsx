import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { shareEn as sh } from '../../i18n/coachShare.en';
import { setViewport } from '../testViewport';
import { configureThreadExtras, getThreadExtrasOpts } from '../threadExtras';
import { lowerConsent, ShareStoryFrame } from './ShareStoryFrame';
import { createFixturesShareSource } from './__fixtures__/fixtures';

beforeEach(() => setViewport(1440));
afterEach(() => {
  cleanup();
  configureThreadExtras(null);
});

describe('lowerConsent', () => {
  it('switches off only the listed categories of Oleh and leaves every other client and category as it was', () => {
    const src = createFixturesShareSource({ warm: true }).peek('c1')!;
    const lowered = lowerConsent('sets', 'body')(src);
    expect(lowered.clients.c1.consent.sets).toBe('off');
    expect(lowered.clients.c1.consent.body).toBe('off');
    for (const k of Object.keys(
      src.clients.c1.consent,
    ) as (keyof typeof src.clients.c1.consent)[]) {
      if (k !== 'sets' && k !== 'body')
        expect(lowered.clients.c1.consent[k]).toBe(src.clients.c1.consent[k]);
    }
    expect(src.clients.c1.consent.sets).not.toBe('off'); // the input is not mutated
    expect(lowered.clients.c2).toBe(src.clients.c2);
  });
});

describe('ShareStoryFrame', () => {
  it('opens the Oleh thread with the Share button, the Notes button and the shared card the story sent', async () => {
    render(
      <ShareStoryFrame
        sent={[{ share: { kind: 'gym', id: 'iron-yard' }, text: 'Try this one' }]}
      />,
    );
    expect(await screen.findByRole('button', { name: sh.pickAria })).toBeTruthy();
    expect(await screen.findByText('Try this one')).toBeTruthy();
    expect(await screen.findByText(/Iron Yard/)).toBeTruthy();
  });

  it('configures the thread extras with the initial state, once per prop change', () => {
    const initial = { noteMode: true };
    render(<ShareStoryFrame initial={initial} notesEmpty />);
    expect(getThreadExtrasOpts().initial).toBe(initial);
    expect(getThreadExtrasOpts().sharePort).toBeTruthy();
    expect(getThreadExtrasOpts().notesPort).toBeTruthy();
  });

  it('open picker mode shows the picker at mount', async () => {
    render(<ShareStoryFrame initial={{ picker: { q: 'iron' } }} />);
    expect(await screen.findByRole('combobox', { name: sh.pickSearchAria })).toBeTruthy();
  });

  it('off lowers the consent of the share source; slow makes it not answer; a hash picks the thread', async () => {
    render(<ShareStoryFrame off={['sets']} hash="#/c/chat?with=c1" />);
    const port = getThreadExtrasOpts().sharePort!;
    const src = await port.load('c1', { signal: new AbortController().signal });
    expect(src.clients.c1.consent.sets).toBe('off');
    cleanup();
    render(<ShareStoryFrame slow notesEmpty />);
    expect(getThreadExtrasOpts().sharePort!.peek('c1')).toBeNull();
    expect(await screen.findByRole('button', { name: sh.pickAria })).toBeTruthy();
  });
});
