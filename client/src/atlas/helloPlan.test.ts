import { describe, expect, it } from 'vitest';
import type { ChatMsg } from './chatLog';
import { HELLO_ID, helloIsIntro, helloStep, inHistory } from './helloPlan';

const hello = { text: 'Atlas. 3 workouts.', chips: ['A', 'B'] };
const said = (over: Partial<ChatMsg> = {}): ChatMsg => ({
  id: HELLO_ID,
  at: 1,
  from: 'atlas',
  hello: true,
  ...hello,
  ...over,
});

describe('helloStep (SPO-6: one hello per conversation)', () => {
  it('greets an empty conversation once', () => {
    expect(helloStep([], hello)).toEqual({ kind: 'push' });
  });
  it('waits for the text (dictionary not ready) instead of greeting with a placeholder', () => {
    expect(helloStep([], null)).toEqual({ kind: 'none' });
  });
  it('does not greet again when the chat is reopened', () => {
    expect(helloStep([said()], hello)).toEqual({ kind: 'none' });
  });
  it('never greets again once something was written', () => {
    const chat: ChatMsg[] = [said(), { id: 'me-2', at: 2, from: 'me', text: 'hi' }];
    expect(helloStep(chat, { text: 'Other voice', chips: [] })).toEqual({ kind: 'none' });
  });
  it('re-voices the hello while it is the only message (temper / language picked)', () => {
    expect(helloStep([said()], { text: 'Yo, bro!', chips: ['A', 'B'] })).toEqual({
      kind: 'update',
    });
  });
  it('a greeting never counts as history for a reply', () => {
    expect(inHistory(said())).toBe(false);
    expect(inHistory({ id: 'n', at: 1, from: 'atlas', text: 'quota', notice: true })).toBe(false);
    expect(inHistory({ id: 'a', at: 1, from: 'atlas', text: 'answer' })).toBe(true);
  });
});

describe('helloIsIntro (SPO-6: the long introduction once, then short greetings)', () => {
  it('the first conversation ever gets the introduction', () => {
    expect(helloIsIntro([], false)).toBe(true);
  });
  it('every later conversation (after Clear chat, a new day) gets a short greeting', () => {
    expect(helloIsIntro([], true)).toBe(false);
  });
  it('while the introduction is the only message it stays the introduction (temper re-voices it)', () => {
    expect(helloIsIntro([said({ intro: true })], true)).toBe(true);
  });
  it('a short greeting stays short when it is re-voiced', () => {
    expect(helloIsIntro([said()], true)).toBe(false);
  });
});
