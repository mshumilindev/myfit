import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHARE_DIMS, cardBlob, drawShareCard, type ShareModel } from './shareCard';

// A recording 2D context: text decisions (what, where, in which font/alignment) are asserted,
// never pixels. Text width is a deterministic function of the font size.
interface Op {
  op: string;
  text?: string;
  x?: number;
  y?: number;
  font?: string;
  align?: string;
  fill?: string;
  args?: number[];
}
function fakeCtx() {
  const ops: Op[] = [];
  const st = {
    font: '10px x',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    letterSpacing: '0px',
  };
  const stack: (typeof st)[] = [];
  const size = (f: string) => Number(/(\d+)px/.exec(f)?.[1] ?? 10);
  const ctx = {
    get font() {
      return st.font;
    },
    set font(v: string) {
      st.font = v;
    },
    get textAlign() {
      return st.textAlign;
    },
    set textAlign(v: string) {
      st.textAlign = v;
    },
    get textBaseline() {
      return st.textBaseline;
    },
    set textBaseline(v: string) {
      st.textBaseline = v;
    },
    get fillStyle() {
      return st.fillStyle;
    },
    set fillStyle(v: string) {
      st.fillStyle = v;
    },
    set strokeStyle(v: string) {
      st.strokeStyle = v;
    },
    set lineWidth(v: number) {
      st.lineWidth = v;
    },
    set letterSpacing(v: string) {
      st.letterSpacing = v;
    },
    measureText: (t: string) => ({ width: t.length * size(st.font) * 0.55 }),
    fillText: (text: string, x: number, y: number) =>
      ops.push({
        op: 'fillText',
        text,
        x,
        y,
        font: st.font,
        align: st.textAlign,
        fill: st.fillStyle,
      }),
    drawImage: (_i: unknown, x: number, y: number, w: number, h: number) =>
      ops.push({ op: 'drawImage', args: [x, y, w, h] }),
    moveTo: (x: number, y: number) => ops.push({ op: 'moveTo', x, y }),
    lineTo: (x: number, y: number) => ops.push({ op: 'lineTo', x, y }),
    arcTo: (...a: number[]) => ops.push({ op: 'arcTo', args: a }),
    bezierCurveTo: () => {},
    beginPath: () => {},
    closePath: () => {},
    save: () => stack.push({ ...st }),
    restore: () => Object.assign(st, stack.pop()),
    stroke: () => {},
    fill: () => ops.push({ op: 'fill', fill: st.fillStyle }),
    fillRect: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
  return { ctx, ops, size };
}

function canvasOf(ctx: unknown) {
  const c = document.createElement('canvas');
  c.getContext = (() => ctx) as never;
  return c;
}

const texts = (ops: Op[]) => ops.filter((o) => o.op === 'fillText');
const textOf = (ops: Op[], t: string | RegExp) =>
  texts(ops).filter((o) => (typeof t === 'string' ? o.text === t : t.test(o.text!)));

beforeEach(() => {
  vi.stubGlobal(
    'Image',
    class {
      width = 200;
      height = 400;
      onload: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      set src(v: string) {
        queueMicrotask(() =>
          v.includes('BROKEN') ? this.onerror?.(new Error('bad')) : this.onload?.(),
        );
      }
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (document as unknown as { fonts?: unknown }).fonts;
});

const model = (over: Partial<ShareModel> = {}): ShareModel => ({
  brand: 'Spotter',
  tagline: 'tag',
  title: 'Push day',
  date: 'Mon 4 May',
  gym: 'Iron House',
  heroValue: '12,400',
  heroLabel: 'Total volume',
  stats: [
    { label: 'Time', value: '58m' },
    { label: 'Sets', value: '21' },
    { label: 'Reps', value: '180' },
  ],
  record: null,
  top: [
    { name: 'Bench Press', detail: '100 kg × 5' },
    { name: 'Overhead Press', detail: '60 kg × 8' },
    { name: 'Dips', detail: '+20 kg × 10' },
    { name: 'Fly', detail: '15 kg × 12' },
  ],
  topLabel: 'Top lifts',
  muscles: [
    { name: 'Chest', count: 9 },
    { name: 'Triceps', count: 6 },
    { name: 'Shoulders', count: 0 },
  ],
  autoFinished: false,
  autoLabel: 'Auto-finished',
  ...over,
});

describe('drawShareCard', () => {
  it('sizes the canvas to the format and draws nothing without a 2D context', () => {
    for (const f of ['story', 'square'] as const) {
      const c = document.createElement('canvas');
      c.getContext = (() => null) as never;
      expect(() => drawShareCard(c, model(), f)).not.toThrow();
      expect([c.width, c.height]).toEqual([SHARE_DIMS[f].w, SHARE_DIMS[f].h]);
    }
    expect(SHARE_DIMS).toEqual({ story: { w: 1080, h: 1920 }, square: { w: 1080, h: 1080 } });
  });
  it('lays out the story card top to bottom: title, date · gym, hero, stats, brand', () => {
    const { ctx, ops } = fakeCtx();
    drawShareCard(canvasOf(ctx), model(), 'story');
    const t = (s: string) => textOf(ops, s)[0];
    expect(t('Push day')).toMatchObject({
      x: 96,
      y: 254,
      font: expect.stringContaining('800 82px'),
    });
    expect(t('Mon 4 May  ·  Iron House')).toMatchObject({ x: 96, y: 304 });
    expect(t('TOTAL VOLUME')).toMatchObject({ x: 96, y: 454 });
    expect(t('12,400')).toMatchObject({ x: 96, y: 622, font: expect.stringContaining('176px') });
    expect(t('58m')).toMatchObject({ align: 'center' });
    expect(t('TIME')).toBeDefined();
    expect(t('SPOTTER')).toMatchObject({ x: 540, y: 1824, align: 'center' });
    // the brand is the foot line and the last thing drawn
    expect(texts(ops).at(-1)!.text).toBe('SPOTTER');
  });
  it('uses the compact square metrics', () => {
    const { ctx, ops } = fakeCtx();
    drawShareCard(canvasOf(ctx), model(), 'square');
    expect(textOf(ops, 'Push day')[0]).toMatchObject({
      y: 200,
      font: expect.stringContaining('64px'),
    });
    expect(textOf(ops, 'SPOTTER')[0]).toMatchObject({ y: 1028 });
  });
  it('omits the gym separator without a gym', () => {
    const { ctx, ops } = fakeCtx();
    drawShareCard(canvasOf(ctx), model({ gym: null }), 'story');
    expect(textOf(ops, 'Mon 4 May')).toHaveLength(1);
    expect(textOf(ops, /·\s+Iron/)).toHaveLength(0);
  });
  it('says "auto-finished" only when it was, and pushes the rest down', () => {
    const a = fakeCtx();
    drawShareCard(canvasOf(a.ctx), model({ autoFinished: true }), 'story');
    const b = fakeCtx();
    drawShareCard(canvasOf(b.ctx), model(), 'story');
    expect(textOf(a.ops, 'Auto-finished')).toHaveLength(1);
    expect(textOf(a.ops, 'Auto-finished')[0]).toMatchObject({ x: 96, y: 344, fill: '#5F5D58' });
    expect(textOf(b.ops, 'Auto-finished')).toHaveLength(0);
    expect(textOf(a.ops, 'TOTAL VOLUME')[0].y! - textOf(b.ops, 'TOTAL VOLUME')[0].y!).toBe(40);
  });
  it('ellipsises a title that would run past the card, and only that', () => {
    const { ctx, ops, size } = fakeCtx();
    const long = 'An extraordinarily long workout name that cannot fit';
    drawShareCard(canvasOf(ctx), model({ title: long }), 'story');
    const drawn = texts(ops).find((o) => o.font!.includes('800 82px'))!.text!;
    expect(drawn.endsWith('…')).toBe(true);
    expect(long.startsWith(drawn.slice(0, -1))).toBe(true);
    expect(drawn.length * size('82px') * 0.55).toBeLessThanOrEqual(888);
    // one more character would not have fit
    expect((drawn.length + 1) * 82 * 0.55).toBeGreaterThan(888);
  });
  it('draws up to three stats with dividers between them, none for a single stat', () => {
    const three = fakeCtx();
    drawShareCard(
      canvasOf(three.ctx),
      model({ stats: [...model().stats, { label: 'X', value: '9' }] }),
      'story',
    );
    expect(textOf(three.ops, 'X')).toHaveLength(0);
    const xs = three.ops.filter(
      (o) =>
        o.op === 'moveTo' &&
        o.x! > 96 &&
        o.x! < 984 &&
        o.y === three.ops.find((p) => p.op === 'moveTo' && p.x === 96 + 296)!.y,
    );
    expect(xs.map((o) => o.x)).toEqual([96 + 296, 96 + 592]);
    const one = fakeCtx();
    drawShareCard(canvasOf(one.ctx), model({ stats: [{ label: 'Time', value: '58m' }] }), 'story');
    expect(textOf(one.ops, '58m')[0].x).toBe(96 + 444);
  });
  it('shows a record only when there is one, with its star and upper-cased name', () => {
    const none = fakeCtx();
    drawShareCard(canvasOf(none.ctx), model(), 'story');
    expect(textOf(none.ops, /★/)).toHaveLength(0);
    const rec = fakeCtx();
    drawShareCard(
      canvasOf(rec.ctx),
      model({ record: { name: 'Bench PR', detail: '100 kg' } }),
      'story',
    );
    expect(textOf(rec.ops, '★ BENCH PR')).toHaveLength(1);
    expect(textOf(rec.ops, '100 kg')).toHaveLength(1);
  });
  it('lists three top lifts on story, two on square; detail right-aligned at the edge', () => {
    const s = fakeCtx();
    drawShareCard(canvasOf(s.ctx), model(), 'story');
    expect(
      ['Bench Press', 'Overhead Press', 'Dips', 'Fly'].map((n) => textOf(s.ops, n).length),
    ).toEqual([1, 1, 1, 0]);
    expect(textOf(s.ops, '100 kg × 5')[0]).toMatchObject({ x: 984, align: 'right' });
    expect(textOf(s.ops, 'TOP LIFTS')).toHaveLength(1);
    const q = fakeCtx();
    drawShareCard(canvasOf(q.ctx), model(), 'square');
    expect(['Bench Press', 'Overhead Press', 'Dips'].map((n) => textOf(q.ops, n).length)).toEqual([
      1, 1, 0,
    ]);
  });
  it('caps a long lift name so it never runs under its result', () => {
    const { ctx, ops } = fakeCtx();
    drawShareCard(
      canvasOf(ctx),
      model({
        top: [{ name: 'Single Arm Cable Crossover Variation Deluxe', detail: '100 kg × 5' }],
      }),
      'story',
    );
    const name = texts(ops).find((o) => o.font!.includes('600 34px'))!.text!;
    const detailW = '100 kg × 5'.length * 32 * 0.55;
    expect(name.endsWith('…')).toBe(true);
    expect(name.length * 34 * 0.55).toBeLessThanOrEqual(888 - detailW - 24);
  });
  it('without top lifts skips the section header', () => {
    const { ctx, ops } = fakeCtx();
    drawShareCard(canvasOf(ctx), model({ top: [] }), 'story');
    expect(textOf(ops, 'TOP LIFTS')).toHaveLength(0);
  });
  it('draws muscle chips with counts (no count when 0), at most 6, stopping at the card edge', () => {
    const a = fakeCtx();
    drawShareCard(canvasOf(a.ctx), model(), 'story');
    expect(textOf(a.ops, 'Chest · 9')).toHaveLength(1);
    expect(textOf(a.ops, 'Shoulders')).toHaveLength(1);
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `M${i}`, count: 1 }));
    const b = fakeCtx();
    drawShareCard(canvasOf(b.ctx), model({ muscles: many }), 'story');
    expect(textOf(b.ops, /^M\d · 1$/)).toHaveLength(6);
    const wide = Array.from({ length: 6 }, (_, i) => ({
      name: `Muscle group number ${i}`,
      count: 12,
    }));
    const c = fakeCtx();
    drawShareCard(canvasOf(c.ctx), model({ muscles: wide }), 'story');
    const n = textOf(c.ops, /^Muscle group/).length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(6);
  });
  it('the square card drops the muscle strip when the lifts leave no room', () => {
    const { ctx, ops } = fakeCtx();
    drawShareCard(
      canvasOf(ctx),
      model({ record: { name: 'PR', detail: '1' }, autoFinished: true }),
      'square',
    );
    expect(textOf(ops, /Chest/)).toHaveLength(0);
    const roomy = fakeCtx();
    drawShareCard(canvasOf(roomy.ctx), model({ top: [] }), 'square');
    expect(textOf(roomy.ops, /Chest/)).toHaveLength(1);
  });
  it('never draws anything but the brand below the frame limit, whatever the content', () => {
    for (const format of ['story', 'square'] as const) {
      const limit = SHARE_DIMS[format].h - (format === 'story' ? 150 : 92);
      for (const record of [null, { name: 'PR', detail: '1 kg' }])
        for (const autoFinished of [false, true])
          for (const top of [[], model().top])
            for (const muscles of [[], model().muscles]) {
              const { ctx, ops } = fakeCtx();
              drawShareCard(canvasOf(ctx), model({ record, autoFinished, top, muscles }), format);
              const body = texts(ops).filter((o) => o.text !== 'SPOTTER');
              expect(Math.max(...body.map((o) => o.y!))).toBeLessThanOrEqual(limit);
            }
    }
  });
});

describe('cardBlob', () => {
  it('resolves with the PNG blob, or null when the canvas cannot encode', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const c = document.createElement('canvas');
    const toBlob = vi.fn((cb: (b: Blob | null) => void, type?: string) =>
      cb(type === 'image/png' ? blob : null),
    );
    c.toBlob = toBlob as never;
    expect(await cardBlob(c)).toBe(blob);
    c.toBlob = ((cb: (b: Blob | null) => void) => cb(null)) as never;
    expect(await cardBlob(c)).toBeNull();
  });
});
