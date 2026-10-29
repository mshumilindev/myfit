import { describe, expect, it } from 'vitest';
import { SNOW_STEP, SnowSim, snowLayout } from './christmasSnow.sim';

const phone = () => new SnowSim(390, 844, { ...snowLayout(390, 844) });

describe('snowstorm simulation (SPO-393)', () => {
  it('is reproducible: the same seed gives the same flakes', () => {
    const a = phone();
    const b = phone();
    a.run(1.5);
    b.run(1.5);
    expect(a.project()).toEqual(b.project());
  });

  it('builds up to a dense storm and keeps spawning until the exit', () => {
    const s = phone();
    s.run(0.3);
    const early = s.flakeCount;
    s.run(3);
    expect(s.flakeCount).toBeGreaterThan(early);
    expect(s.flakeCount).toBeGreaterThan(3000);
    const held = s.flakeCount;
    s.run(8);
    // it settles at a steady density and holds it while the next app loads
    expect(s.flakeCount).toBeGreaterThan(held * 0.6);
    expect(s.flakeCount).toBeLessThan(held * 1.1);
    expect(s.exiting).toBe(false);
  });

  it('never grows a flake and fades a new one in', () => {
    const s = phone();
    s.run(3);
    const fl = s.project();
    expect(Math.max(...fl.map((f) => f.r))).toBeLessThan(14);
    expect(fl.every((f) => f.a >= 0 && f.a <= 1)).toBe(true);
    expect(fl.some((f) => f.a < 1)).toBe(true);
  });

  it('on exit it stops spawning and every flake leaves the screen', () => {
    const s = phone();
    s.run(3);
    s.exit();
    s.exit();
    expect(s.exiting).toBe(true);
    s.run(s.time + 12);
    expect(s.flakeCount).toBe(0);
    expect(s.done).toBe(true);
    expect(s.exitTime).toBeGreaterThan(0);
  });

  it('the storm keeps blowing across the screen on exit: flakes move sideways, not only down', () => {
    const s = phone();
    s.run(3);
    const before = new Map(s.project().map((f, i) => [i, f.x]));
    s.exit();
    s.run(s.time + 0.5);
    const after = s.project();
    let right = 0;
    after.forEach((f, i) => {
      if (before.has(i) && f.x > before.get(i)!) right++;
    });
    expect(right).toBeGreaterThan(after.length / 2);
  });

  it('a fixed step is 1/60 s and run() lands on it', () => {
    const s = phone();
    s.step();
    expect(s.time).toBeCloseTo(SNOW_STEP, 9);
    s.run(0.5);
    expect(s.time).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(s.time).toBeGreaterThan(0.49);
  });

  it('a lower count thins the storm', () => {
    const full = phone();
    const lite = new SnowSim(390, 844, { ...snowLayout(390, 844), count: 0.4 });
    full.run(3);
    lite.run(3);
    expect(lite.flakeCount).toBeLessThan(full.flakeCount * 0.6);
  });
});

describe('snow layout', () => {
  it('keeps a phone at the approved density and size', () => {
    const l = snowLayout(390, 844);
    expect(l.size).toBe(1);
    expect(l.count).toBeGreaterThan(0.9);
    expect(l.count).toBeLessThanOrEqual(1.3);
  });
  it('caps the count on a wide screen and enlarges the flakes a little instead', () => {
    const l = snowLayout(1440, 900);
    expect(l.count).toBe(1.3);
    expect(l.size).toBeGreaterThan(1);
    expect(l.size).toBeLessThanOrEqual(1.6);
  });
});
