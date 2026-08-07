import { describe, expect, it } from 'vitest';
import { pickShellHeight } from './viewportFit';

describe('pickShellHeight', () => {
  it('takes the tallest reading — a short one is what leaves the dead band', () => {
    expect(pickShellHeight({ innerHeight: 820, visualHeight: 874, clientHeight: 820 })).toBe(874);
    expect(pickShellHeight({ innerHeight: 874, visualHeight: 820, clientHeight: 820 })).toBe(874);
    expect(pickShellHeight({ innerHeight: 820, visualHeight: 820, clientHeight: 874 })).toBe(874);
  });

  it('copes with browsers that expose no visual viewport', () => {
    expect(pickShellHeight({ innerHeight: 852, visualHeight: null, clientHeight: 852 })).toBe(852);
  });

  it('rounds to whole pixels', () => {
    expect(pickShellHeight({ innerHeight: 873.6, visualHeight: null, clientHeight: 0 })).toBe(874);
  });
});
