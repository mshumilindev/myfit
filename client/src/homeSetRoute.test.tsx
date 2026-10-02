/** Home set routes: #/home[/moves], /set|add|move/{id|new}; Back climbs one step. */
import { describe, expect, it } from 'vitest';
import { fromHash, overlayBack, toHash, type Overlay } from './App';

const hash = (o: Overlay) =>
  toHash('today', o, 'mine' as never, false, 'progress', 'total' as never, 'volume' as never);

describe('#/home routes', () => {
  it('parse and format every page', () => {
    const cases: Array<[string, Overlay]> = [
      ['#/home', { screen: 'home-set' }],
      ['#/home/moves', { screen: 'home-set', tab: 'moves' }],
      ['#/home/set/new', { screen: 'home-set', page: 'set' }],
      ['#/home/set/abc', { screen: 'home-set', page: 'set', id: 'abc' }],
      ['#/home/add/new', { screen: 'home-set', page: 'add' }],
      ['#/home/add/abc', { screen: 'home-set', page: 'add', id: 'abc' }],
      ['#/home/move/new', { screen: 'home-set', page: 'move' }],
      ['#/home/move/Pullups', { screen: 'home-set', page: 'move', id: 'Pullups' }],
    ];
    for (const [h, o] of cases) {
      expect(fromHash(h).overlay).toEqual(o);
      expect(hash(o)).toBe(h);
    }
  });

  it('Back goes to the remembered parent, else up to the home page, else out', () => {
    const set: Overlay = { screen: 'home-set', page: 'set', id: 'a' };
    const add: Overlay = { screen: 'home-set', page: 'add', id: 'a' };
    const home: Overlay = { screen: 'home-set' };
    expect(overlayBack({ cur: add, stack: [home, set] })).toEqual({ cur: set, stack: [home] });
    expect(overlayBack({ cur: set, stack: [] })).toEqual({ cur: home, stack: [] });
    expect(overlayBack({ cur: home, stack: [] })).toEqual({ cur: null, stack: [] });
  });
});
