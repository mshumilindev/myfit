/**
 * Christmas app switch (SPO-393): the snowstorm simulation. Pure maths, no DOM, so it is testable and the canvas view
 * only draws what it returns. Real-scale physics (metres, seconds) seen through a fixed pinhole camera: flakes settle at
 * ~0.75–1.3 m/s, follow the air with a response time of ~0.1 s, flutter at ~2.3 Hz, ride turbulence of 0.2–0.35 m/s and a
 * mean wind of 1.6 m/s with gusts. Flake size never grows; the screen turns white only from the density of the flakes.
 * Phase `out` builds the storm; it holds at full strength until `exit()` is called (the next app is ready); then the wind
 * picks up and every flake carries on through the screen on its own path (it keeps blowing, it does not just fall).
 * Stepped at a fixed 1/60 s (the drag response time of 0.1 s is still well resolved) from a seeded random generator, so a run is reproducible.
 */
export interface SnowFlake {
  /** Fade-in, 0..1. */
  a: number;
  x: number;
  y: number;
  /** Radius in CSS px. */
  r: number;
  ang: number;
  seed: number;
}

export interface SnowOptions {
  seed?: number;
  /** Multiplier of the number of flakes (1 = the approved density). */
  count?: number;
  /** Multiplier of the flake size. */
  size?: number;
  /** Focal length in px; defaults to 1.15 x the width. */
  focal?: number;
}

interface Band {
  d0: number;
  d1: number;
  n: number;
  R0: number;
  R1: number;
}
interface Flake {
  age: number;
  X: number;
  Y: number;
  d: number;
  R: number;
  vx: number;
  vy: number;
  vt: number;
  tau: number;
  fl: number;
  fa: number;
  ph: number;
  ang: number;
  spin: number;
  seed: number;
  dly: number;
}

/** Three depth bands: n = flakes in the band at full strength; R = flake radius in metres. */
const BANDS: readonly Band[] = [
  { d0: 0.55, d1: 0.95, n: 10500, R0: 0.008, R1: 0.015 },
  { d0: 0.95, d1: 2.2, n: 13500, R0: 0.007, R1: 0.012 },
  { d0: 2.2, d1: 6.0, n: 5200, R0: 0.006, R1: 0.01 },
];
export const SNOW_STEP = 1 / 60;

const ease = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

export class SnowSim {
  private flakes: Flake[] = [];
  private t = 0;
  private exitAt: number | null = null;
  private acc = [0, 0, 0];
  private rs: number;
  private readonly f: number;
  private readonly cx: number;
  private readonly cy: number;
  /** Multiplier of the spawn rate; the view lowers it when frames run long. */
  count: number;
  private readonly size: number;

  constructor(
    private readonly W: number,
    private readonly H: number,
    opts: SnowOptions = {},
  ) {
    this.rs = opts.seed ?? 20261028;
    this.count = opts.count ?? 1;
    this.size = opts.size ?? 1;
    this.f = opts.focal ?? W * 1.15;
    this.cx = W / 2;
    this.cy = H / 2;
  }

  /** mulberry32 */
  private rnd(): number {
    this.rs = (this.rs + 0x6d2b79f5) | 0;
    let x = Math.imul(this.rs ^ (this.rs >>> 15), 1 | this.rs);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  get time() {
    return this.t;
  }
  get flakeCount() {
    return this.flakes.length;
  }
  get exiting() {
    return this.exitAt !== null;
  }
  /** Seconds since the exit began (0 before it). */
  get exitTime() {
    return this.exitAt === null ? 0 : this.t - this.exitAt;
  }
  /** True once the storm is leaving and nothing is left on screen. */
  get done() {
    return this.exitAt !== null && this.flakes.length === 0;
  }

  /** The next app is ready: stop spawning, the wind rises and the flakes carry on out of the screen. */
  exit() {
    if (this.exitAt === null) this.exitAt = this.t;
  }

  private ramp(): number {
    return this.exitAt === null ? ease(0.05, 1.7, this.t) : 1;
  }
  private windMean(): number {
    if (this.exitAt === null) return 1.6 * ease(0.2, 2.0, this.t);
    return 1.6 * (1 + 0.5 * ease(this.exitAt, this.exitAt + 1.0, this.t));
  }
  private life(b: Band) {
    // seconds to fall one screen height at 1 m/s
    return (((b.d0 + b.d1) / 2) * (this.H / this.f)) / 1.0;
  }

  private spawn(bi: number, sideEdge: boolean) {
    const b = BANDS[bi]!;
    const d = b.d0 + Math.pow(this.rnd(), 1.1) * (b.d1 - b.d0);
    const halfW = (this.cx / this.f) * d;
    const halfH = (this.cy / this.f) * d;
    let X: number;
    let Y: number;
    if (sideEdge) {
      X = -halfW * (1.02 + this.rnd() * 0.15);
      Y = -halfH + this.rnd() * halfH * 1.5;
    } else {
      X = (this.rnd() * 2.25 - 1.25) * halfW;
      Y =
        this.rnd() < 0.85 * ease(0.5, 1.5, this.t)
          ? (this.rnd() * 2.1 - 1.05) * halfH
          : -halfH * (1.02 + this.rnd() * 0.12);
    }
    const R = (b.R0 + this.rnd() * (b.R1 - b.R0)) * this.size;
    this.flakes.push({
      age: 0,
      X,
      Y,
      d,
      R,
      vx: 0,
      vy: 0.7 + this.rnd() * 0.5,
      vt: 0.75 + this.rnd() * 0.55,
      tau: 0.09 + this.rnd() * 0.05,
      fl: 2.0 + this.rnd() * 0.8,
      fa: 0.25 + this.rnd() * 0.35,
      ph: this.rnd() * 6.283,
      ang: this.rnd() * 6.283,
      spin: (this.rnd() - 0.5) * 3,
      seed: this.rnd(),
      dly: this.rnd() * 0.5,
    });
  }

  /** One fixed step of `SNOW_STEP` seconds. */
  step(dt = SNOW_STEP) {
    this.t += dt;
    const exiting = this.exitAt !== null;
    if (!exiting) {
      for (let i = 0; i < BANDS.length; i++) {
        this.acc[i]! += (BANDS[i]!.n / this.life(BANDS[i]!)) * this.ramp() * this.count * dt;
        while (this.acc[i]! >= 1) {
          this.acc[i]! -= 1;
          this.spawn(i, this.rnd() < 0.2);
        }
      }
    }
    const t = this.t;
    const wm = this.windMean();
    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const q = this.flakes[i]!;
      // fluid velocity at the flake: mean wind + gusts + smooth turbulence
      const gust = 0.7 * Math.sin(t * 1.3 + q.d) + 0.4 * Math.sin(t * 3.7 + q.Y * 2);
      const turb = 0.35 * Math.sin(q.Y * 2.1 + t * 2.3 + q.d * 3) * Math.cos(q.X * 1.7 - t * 1.6);
      const turbY = 0.25 * Math.cos(q.X * 2.3 + t * 2.0 + q.d) * Math.sin(q.Y * 1.5 - t * 1.2);
      const ux = wm * (0.8 + 0.4 * q.seed) + gust * (wm / 1.6) + turb;
      const flutter = q.fa * Math.sin(q.ph + t * q.fl * 6.283) * 0.12; // ~2.3 Hz meander, horizontal
      const flutterY = q.fa * Math.sin(2 * (q.ph + t * q.fl * 6.283)) * 0.1;
      let vtY = q.vt + flutterY;
      if (this.exitAt !== null) {
        const k = Math.max(0, t - this.exitAt - q.dly);
        vtY = q.vt * (1 + (0.8 + 1.4 * q.seed) * ease(0, 1.2, k));
      }
      // drag relaxation (response time tau): the flake follows the fluid and its own settling speed
      q.vx += ((ux + flutter - q.vx) / q.tau) * dt;
      q.vy += ((turbY + vtY - q.vy) / q.tau) * dt;
      q.age += dt;
      q.X += q.vx * dt;
      q.Y += q.vy * dt;
      q.ang += q.spin * dt;
      const sy = this.cy + (this.f * q.Y) / q.d;
      const sx = this.cx + (this.f * q.X) / q.d;
      const r = (this.f * q.R) / q.d;
      if (sy - r > this.H + 10 || sx - r > this.W + 10 || (sx + r < -40 && q.vx < 0)) {
        this.flakes.splice(i, 1);
      }
    }
  }

  /** Advance to time `to` (seconds) in fixed steps. */
  run(to: number) {
    while (this.t + SNOW_STEP <= to + 1e-9) this.step(SNOW_STEP);
  }

  /** Calls `fn` for every flake that is on screen (screen px), without allocating: this runs once per frame. */
  forEachVisible(
    fn: (x: number, y: number, r: number, a: number, ang: number, seed: number) => void,
  ) {
    const { f, cx, cy, W, H } = this;
    for (const q of this.flakes) {
      const x = cx + (f * q.X) / q.d;
      const y = cy + (f * q.Y) / q.d;
      const r = (f * q.R) / q.d;
      if (x + r < -10 || x - r > W + 10 || y + r < -10 || y - r > H + 10) continue;
      fn(x, y, r, q.age < 0.35 ? q.age / 0.35 : 1, q.ang, q.seed);
    }
  }

  /** Visible flakes in screen px (for tests and tools; the view uses `forEachVisible`). */
  project(): SnowFlake[] {
    const out: SnowFlake[] = [];
    this.forEachVisible((x, y, r, a, ang, seed) => out.push({ a, x, y, r, ang, seed }));
    return out;
  }
}

/** Layout-dependent settings: the flake size follows the width up to a phone-sized stage, the count follows the area. */
export function snowLayout(W: number, H: number) {
  const fs = Math.min(420, Math.max(260, W));
  const raw = (W * H) / (fs * fs * (540 / 260));
  const count = Math.min(raw, 1.3);
  const size = raw > 1.3 ? Math.min(1.6, Math.sqrt(raw / 1.3)) : 1;
  return { focal: fs * 1.15, count, size };
}
