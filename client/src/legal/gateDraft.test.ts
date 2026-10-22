import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGateDraft, loadGateDraft, saveGateDraft } from './gateDraft';

beforeEach(() => localStorage.clear());
const d = { opened: ['terms', 'privacy'], age: true, agree: false };

describe('gateDraft', () => {
  it('round-trips the progress for the same account and document versions', () => {
    saveGateDraft('u1', 's1', d);
    expect(loadGateDraft('u1', 's1')).toEqual(d);
  });

  it('is per account and per signature: another account or a new version gets nothing', () => {
    saveGateDraft('u1', 's1', d);
    expect(loadGateDraft('u2', 's1')).toBeNull();
    expect(loadGateDraft('u1', 's2')).toBeNull();
  });

  it('stores only booleans and document ids (no personal data)', () => {
    saveGateDraft('u1', 's1', d);
    const raw = JSON.parse(localStorage.getItem('spotter.gateDraft.u1') ?? '{}');
    expect(Object.keys(raw).sort()).toEqual(['age', 'agree', 'opened', 'sig']);
  });

  it('clear removes it', () => {
    saveGateDraft('u1', 's1', d);
    clearGateDraft('u1');
    expect(loadGateDraft('u1', 's1')).toBeNull();
  });

  it.each(['not json', '"x"', '{"sig":"s1","opened":"no"}', 'null'])(
    'ignores a damaged value %s',
    (v) => {
      localStorage.setItem('spotter.gateDraft.u1', v);
      expect(loadGateDraft('u1', 's1')).toBeNull();
    },
  );

  it('drops non-string ids and non-true flags', () => {
    localStorage.setItem(
      'spotter.gateDraft.u1',
      JSON.stringify({ sig: 's1', opened: ['terms', 5, null], age: 'yes', agree: true }),
    );
    expect(loadGateDraft('u1', 's1')).toEqual({ opened: ['terms'], age: false, agree: true });
  });

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveGateDraft('u1', 's1', d)).not.toThrow();
    expect(loadGateDraft('u1', 's1')).toBeNull();
    vi.restoreAllMocks();
  });
});
