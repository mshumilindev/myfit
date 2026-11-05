import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_INPUT_MODE,
  loadInputMode,
  parseInputMode,
  resetInputModeForTests,
  storeInputMode,
} from './inputModeStore';
import { afterSignOut } from './accounts/deviceSession';
import { INPUT_MODE_FIELD, pushInputModeEdits, syncInputModeFromDoc } from './inputModeSync';

beforeEach(() => {
  localStorage.clear();
  resetInputModeForTests();
});

describe('inputMode store', () => {
  it('defaults to the − / + stepper', () => {
    expect(loadInputMode()).toBe(DEFAULT_INPUT_MODE);
    expect(DEFAULT_INPUT_MODE).toBe('stepper');
  });
  it('parses only known modes', () => {
    expect(parseInputMode('wheel')).toBe('wheel');
    expect(parseInputMode('stepper')).toBe('stepper');
    expect(parseInputMode('drum')).toBeNull();
    expect(parseInputMode(1)).toBeNull();
    expect(parseInputMode(undefined)).toBeNull();
  });
  it('keeps a stored choice across a cold start and ignores garbage', () => {
    storeInputMode('wheel');
    resetInputModeForTests();
    expect(loadInputMode()).toBe('wheel');
    localStorage.setItem('spotter.inputMode', 'junk');
    resetInputModeForTests();
    expect(loadInputMode()).toBe('stepper');
  });
});

describe('inputMode sign-out', () => {
  it("the next person does not inherit the previous one's in-memory choice", () => {
    storeInputMode('wheel');
    expect(loadInputMode()).toBe('wheel');
    afterSignOut(localStorage as unknown as Parameters<typeof afterSignOut>[0], null, false);
    expect(loadInputMode()).toBe('stepper');
  });
});

describe('inputMode sync', () => {
  it('adopts the account value without echoing it back', () => {
    const write = vi.fn();
    pushInputModeEdits(write);
    syncInputModeFromDoc({ [INPUT_MODE_FIELD]: 'wheel' }, write);
    expect(loadInputMode()).toBe('wheel');
    expect(write).not.toHaveBeenCalled();
  });
  it("writes the person's own pick to the account", () => {
    const write = vi.fn();
    pushInputModeEdits(write);
    storeInputMode('wheel');
    expect(write).toHaveBeenCalledWith({ inputMode: 'wheel' });
  });
  it('seeds the account once from a choice made on this device', () => {
    storeInputMode('wheel');
    const write = vi.fn();
    syncInputModeFromDoc({}, write);
    expect(write).toHaveBeenCalledWith({ inputMode: 'wheel' });
  });
  it('never pushes the default as a choice', () => {
    const write = vi.fn();
    syncInputModeFromDoc({}, write);
    expect(write).not.toHaveBeenCalled();
    expect(loadInputMode()).toBe('stepper');
  });
  it('ignores an unknown account value and keeps the local one', () => {
    storeInputMode('wheel');
    const write = vi.fn();
    syncInputModeFromDoc({ [INPUT_MODE_FIELD]: 'hologram' }, write);
    expect(loadInputMode()).toBe('wheel');
    expect(write).not.toHaveBeenCalled();
  });
  it('the account value wins over a different local one', () => {
    storeInputMode('wheel');
    syncInputModeFromDoc({ [INPUT_MODE_FIELD]: 'stepper' }, vi.fn());
    expect(loadInputMode()).toBe('stepper');
  });
});
