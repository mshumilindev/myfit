import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RECAP_DIMS,
  STAT_DIMS,
  drawRecapCard,
  drawStatCard,
  type RecapShareModel,
  type StatShareModel,
} from './shareCard';

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
        const broken = decodeURIComponent(v).includes('BROKEN');
        queueMicrotask(() => (broken ? this.onerror?.(new Error('bad')) : this.onload?.()));
      }
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (document as unknown as { fonts?: unknown }).fonts;
});

const recap = (over: Partial<RecapShareModel> = {}): RecapShareModel => ({
  brand: 'Spotter',
  kicker: 'Wrapped',
  period: 'April 2026',
  headline: 'You trained twelve times and moved a lot of iron',
  stats: [
    { label: 'Sessions', value: '12' },
    { label: 'Volume', value: '84 t' },
    { label: 'Time', value: '9h' },
  ],
  record: { name: 'Bench press', detail: '105 kg' },
  kcal: '5,400 kcal',
  muscles: [
    { name: 'Chest', pct: 40 },
    { name: 'Back', pct: 120 },
    { name: 'Legs', pct: 2 },
    { name: 'Arms', pct: 1 },
  ],
  bodyFrontSvg: '<svg>front</svg>',
  bodyBackSvg: '<svg>back</svg>',
  handle: '@oleh',
  ...over,
});

describe('drawRecapCard', () => {
  it('sizes the canvas and stops without a context', async () => {
    for (const f of ['story', 'square'] as const) {
      const c = document.createElement('canvas');
      c.getContext = (() => null) as never;
      await drawRecapCard(c, recap(), f);
      expect([c.width, c.height]).toEqual([RECAP_DIMS[f].w, RECAP_DIMS[f].h]);
    }
  });
  it('defaults to the story format', async () => {
    const { ctx } = fakeCtx();
    const c = canvasOf(ctx);
    await drawRecapCard(c, recap());
    expect([c.width, c.height]).toEqual([1080, 1920]);
  });
  it('draws the wordmark (script font), kicker, period, headline, stats and handle', async () => {
    const { ctx, ops } = fakeCtx();
    await drawRecapCard(canvasOf(ctx), recap(), 'story');
    const t = (s: string) => textOf(ops, s)[0];
    expect(t('Spotter')).toMatchObject({
      x: 96,
      y: 172,
      font: expect.stringContaining("'Kaushan Script'"),
    });
    expect(t('WRAPPED')).toMatchObject({ x: 984, y: 158, align: 'right' });
    expect(t('April 2026')).toMatchObject({ x: 96, y: 264 });
    expect(t('SESSIONS')).toBeDefined();
    expect(t('84 t')).toMatchObject({ align: 'center' });
    expect(t('@OLEH')).toMatchObject({ x: 540, y: 1824, align: 'center' });
  });
  it('waits for the script font, and tolerates it being missing or failing to load', async () => {
    const load = vi.fn().mockResolvedValue([]);
    (document as unknown as { fonts: unknown }).fonts = { load };
    await drawRecapCard(canvasOf(fakeCtx().ctx), recap(), 'story');
    expect(load).toHaveBeenCalledWith("400 100px 'Kaushan Script'");
    (document as unknown as { fonts: unknown }).fonts = {
      load: vi.fn().mockRejectedValue(new Error('no font')),
    };
    await expect(drawRecapCard(canvasOf(fakeCtx().ctx), recap(), 'story')).resolves.toBeUndefined();
  });
  it('wraps the headline to at most two lines inside the card, breaking between words', async () => {
    const { ctx, ops } = fakeCtx();
    const words = Array.from({ length: 60 }, (_, i) => `w${i}`);
    await drawRecapCard(canvasOf(ctx), recap({ headline: words.join(' ') }), 'story');
    const lines = texts(ops).filter((o) => o.font!.includes('400 34px'));
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l.text!.length * 34 * 0.55).toBeLessThanOrEqual(888);
    expect(words.join(' ').startsWith(`${lines[0].text} ${lines[1].text}`)).toBe(true);
    expect(lines[1].y! - lines[0].y!).toBe(46);
  });
  it('a short headline stays on one line, whole', async () => {
    const { ctx, ops } = fakeCtx();
    await drawRecapCard(canvasOf(ctx), recap({ headline: 'Good month' }), 'square');
    const lines = texts(ops).filter((o) => o.font!.includes('400 30px'));
    expect(lines.map((l) => l.text)).toEqual(['Good month']);
  });
  it('shows at most three stats and three muscle bars with their percentages as given', async () => {
    const { ctx, ops } = fakeCtx();
    await drawRecapCard(
      canvasOf(ctx),
      recap({ stats: [...recap().stats, { label: 'Extra', value: '1' }] }),
      'story',
    );
    expect(textOf(ops, 'EXTRA')).toHaveLength(0);
    expect(textOf(ops, /^\d+%$/).map((o) => o.text)).toEqual(['40%', '120%', '2%']);
    expect(textOf(ops, 'Arms')).toHaveLength(0);
  });
  it('bar fills are proportional, capped at the track at 100%, and never thinner than the track height', async () => {
    const { ctx, ops } = fakeCtx();
    await drawRecapCard(canvasOf(ctx), recap({ record: null, kcal: null }), 'square');
    // every rounded rect starts with an arcTo to its right edge; frame, stats panel, then track+fill per bar
    const rights = ops
      .filter((o) => o.op === 'arcTo')
      .map((o) => o.args![0])
      .filter((_, i) => i % 4 === 0);
    const bars = rights.slice(2);
    const trackRight = 96 + 210 + 20 + 548;
    expect(bars[0]).toBe(trackRight);
    expect(bars[1]).toBeCloseTo(96 + 210 + 20 + 0.4 * 548, 6);
    expect(bars[2]).toBe(trackRight);
    expect(bars[3]).toBe(trackRight); // 120% is capped at the full track
    expect(bars[4]).toBe(trackRight);
    expect(bars[5]).toBe(96 + 210 + 20 + 14); // 2% would be 11px: never thinner than the track
  });
  it('story with both maps draws two images scaled to one height, centred; square draws none', async () => {
    const s = fakeCtx();
    await drawRecapCard(canvasOf(s.ctx), recap(), 'story');
    const imgs = s.ops.filter((o) => o.op === 'drawImage').map((o) => o.args!);
    expect(imgs).toHaveLength(2);
    expect(imgs[0][3]).toBe(imgs[1][3]);
    expect(imgs[0][2] / imgs[0][3]).toBeCloseTo(0.5, 6);
    const total = imgs[1][0] + imgs[1][2] - imgs[0][0];
    expect(imgs[0][0] + total / 2).toBeCloseTo(540, 6);
    expect(total).toBeLessThanOrEqual(888 + 1e-6);
    const q = fakeCtx();
    await drawRecapCard(canvasOf(q.ctx), recap(), 'square');
    expect(q.ops.filter((o) => o.op === 'drawImage')).toHaveLength(0);
  });
  it('a map that fails to rasterise is skipped; both failing means no map and no crash', async () => {
    const one = fakeCtx();
    await drawRecapCard(canvasOf(one.ctx), recap({ bodyBackSvg: 'BROKEN' }), 'story');
    expect(one.ops.filter((o) => o.op === 'drawImage')).toHaveLength(1);
    const none = fakeCtx();
    await drawRecapCard(
      canvasOf(none.ctx),
      recap({ bodyFrontSvg: 'BROKEN', bodyBackSvg: 'BROKEN' }),
      'story',
    );
    expect(none.ops.filter((o) => o.op === 'drawImage')).toHaveLength(0);
  });
  it('a tall map is limited by the card width, not by the free height', async () => {
    vi.stubGlobal(
      'Image',
      class {
        width = 400;
        height = 100;
        onload: (() => void) | null = null;
        set src(_v: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    const { ctx, ops } = fakeCtx();
    await drawRecapCard(canvasOf(ctx), recap({ muscles: [], record: null, kcal: null }), 'story');
    const imgs = ops.filter((o) => o.op === 'drawImage').map((o) => o.args!);
    const total = imgs[1][0] + imgs[1][2] - imgs[0][0];
    expect(total).toBeCloseTo(888, 6);
  });
  it('record and calorie blocks appear only when given; the star leads the record name', async () => {
    const a = fakeCtx();
    await drawRecapCard(canvasOf(a.ctx), recap(), 'story');
    expect(textOf(a.ops, '★ BENCH PRESS')).toHaveLength(1);
    expect(textOf(a.ops, '105 kg')[0]).toMatchObject({ align: 'right', x: 984 - 34 });
    expect(textOf(a.ops, '5,400 kcal')).toHaveLength(1);
    const b = fakeCtx();
    await drawRecapCard(canvasOf(b.ctx), recap({ record: null, kcal: null }), 'story');
    expect(textOf(b.ops, /★/)).toHaveLength(0);
    expect(textOf(b.ops, /kcal/)).toHaveLength(0);
  });
  it('story anchors the lower blocks to the foot: calories lowest, then record, then bars', async () => {
    const { ctx, ops } = fakeCtx();
    await drawRecapCard(canvasOf(ctx), recap(), 'story');
    const yOf = (s: string | RegExp) => textOf(ops, s)[0].y!;
    expect(yOf('Chest')).toBeLessThan(yOf(/★/));
    expect(yOf(/★/)).toBeLessThan(yOf('5,400 kcal'));
    expect(yOf('5,400 kcal')).toBeLessThan(yOf('@OLEH'));
  });
  it('square flows the blocks down from the stats in the same order', async () => {
    const { ctx, ops } = fakeCtx();
    await drawRecapCard(canvasOf(ctx), recap(), 'square');
    const yOf = (s: string | RegExp) => textOf(ops, s)[0].y!;
    expect(yOf('Chest')).toBeLessThan(yOf(/★/));
    expect(yOf(/★/)).toBeLessThan(yOf('5,400 kcal'));
    expect(yOf('5,400 kcal')).toBeLessThan(yOf('@OLEH'));
  });
  it('ellipsises long stat values, record names and calories', async () => {
    const { ctx, ops } = fakeCtx();
    await drawRecapCard(
      canvasOf(ctx),
      recap({
        stats: [
          { label: 'Sessions', value: '1234567890123456789' },
          { label: 'Volume', value: '84 t' },
          { label: 'Time', value: '9h' },
        ],
        record: {
          name: 'An unreasonably long personal record name here that keeps going and going well past the edge',
          detail: '1',
        },
        kcal: 'x'.repeat(80),
      }),
      'story',
    );
    const val = texts(ops).find((o) => /^1234.*…$/.test(o.text!))!;
    expect(val.text!.length * 66 * 0.55).toBeLessThanOrEqual(888 / 3 - 20);
    expect(textOf(ops, '84 t')).toHaveLength(1);
    expect(textOf(ops, /^★ AN UNREASONABLY.*…$/)).toHaveLength(1);
    expect(textOf(ops, /^x+…$/)).toHaveLength(1);
  });
});

const stat = (over: Partial<StatShareModel> = {}): StatShareModel => ({
  brand: 'Spotter',
  kicker: 'Standards',
  headline: 'Your strength levels',
  hero: { value: '80.0 kg × 7', label: 'Bench estimate' },
  rows: Array.from({ length: 14 }, (_, i) => ({
    lead: `${i + 1}`,
    name: `Lift ${i + 1}`,
    detail: `${100 + i} kg`,
    accent: i === 0,
  })),
  handle: '@oleh',
  ...over,
});

describe('drawStatCard', () => {
  it('sizes the canvas and stops without a context', async () => {
    for (const f of ['story', 'square'] as const) {
      const c = document.createElement('canvas');
      c.getContext = (() => null) as never;
      await drawStatCard(c, stat(), f);
      expect([c.width, c.height]).toEqual([STAT_DIMS[f].w, STAT_DIMS[f].h]);
    }
  });
  it('defaults to story and tolerates a font that fails to load', async () => {
    (document as unknown as { fonts: unknown }).fonts = {
      load: vi.fn().mockRejectedValue(new Error('x')),
    };
    const { ctx } = fakeCtx();
    const c = canvasOf(ctx);
    await drawStatCard(c, stat());
    expect(c.height).toBe(1920);
  });
  it('draws brand, upper-cased kicker (right), hero, label, headline and handle', async () => {
    const { ctx, ops } = fakeCtx();
    await drawStatCard(canvasOf(ctx), stat(), 'square');
    const t = (s: string) => textOf(ops, s)[0];
    expect(t('Spotter')).toMatchObject({ x: 96, y: 132 });
    expect(t('STANDARDS')).toMatchObject({ align: 'right', x: 984 });
    expect(t('80.0 kg × 7').fill).toBe('#C8A86A');
    expect(t('BENCH ESTIMATE')).toBeDefined();
    expect(t('Your strength levels')).toBeDefined();
    expect(t('@OLEH')).toMatchObject({ y: 1020, align: 'center' });
  });
  it('shrinks a long hero value in steps of 6 until it fits, and stops at the floor', async () => {
    const fit = fakeCtx();
    await drawStatCard(
      canvasOf(fit.ctx),
      stat({ hero: { value: '80.0 kg × 7 reps', label: 'x' } }),
      'story',
    );
    const hero = textOf(fit.ops, '80.0 kg × 7 reps')[0];
    const size = Number(/(\d+)px/.exec(hero.font!)![1]);
    expect(size).toBeLessThan(180);
    expect((180 - size) % 6).toBe(0);
    expect('80.0 kg × 7 reps'.length * size * 0.55).toBeLessThanOrEqual(888);
    expect('80.0 kg × 7 reps'.length * (size + 6) * 0.55).toBeGreaterThan(888);
    const huge = fakeCtx();
    const v = 'X'.repeat(80);
    await drawStatCard(canvasOf(huge.ctx), stat({ hero: { value: v, label: 'x' } }), 'story');
    // The shrink loop stops at the first step at or under 64 (66 -> 60), so the floor is 60.
    expect(Number(/(\d+)px/.exec(textOf(huge.ops, v)[0].font!)![1])).toBe(60);
  });
  it('keeps a short hero at its full size (180 story / 132 square)', async () => {
    const s = fakeCtx();
    await drawStatCard(canvasOf(s.ctx), stat({ hero: { value: '1', label: 'x' } }), 'story');
    expect(textOf(s.ops, '1').find((o) => o.font!.includes('800'))!.font).toContain('180px');
    const q = fakeCtx();
    await drawStatCard(canvasOf(q.ctx), stat({ hero: { value: '1', label: 'x' } }), 'square');
    expect(textOf(q.ops, '1').find((o) => o.font!.includes('800'))!.font).toContain('132px');
  });
  it('lists as many rows as fit above the foot — fewer on square than story — each with lead, name and right-aligned detail', async () => {
    const s = fakeCtx();
    await drawStatCard(canvasOf(s.ctx), stat(), 'story');
    const q = fakeCtx();
    await drawStatCard(canvasOf(q.ctx), stat(), 'square');
    const count = (o: Op[]) => textOf(o, /^Lift \d+$/).length;
    expect(count(s.ops)).toBeGreaterThan(count(q.ops));
    expect(count(q.ops)).toBeGreaterThan(0);
    expect(count(s.ops)).toBeLessThan(14);
    expect(textOf(s.ops, '100 kg')[0]).toMatchObject({
      align: 'right',
      x: 984 - 28,
      fill: '#C8A86A',
    });
    expect(textOf(s.ops, '101 kg')[0].fill).toBe('#93908A');
    expect(textOf(s.ops, 'Lift 1')[0].x).toBe(196);
    expect(textOf(s.ops, '1').some((o) => o.x === 124)).toBe(true);
  });
  it('rows never reach the footer line', async () => {
    for (const format of ['story', 'square'] as const) {
      const { ctx, ops } = fakeCtx();
      await drawStatCard(canvasOf(ctx), stat(), format);
      const foot = textOf(ops, '@OLEH')[0].y!;
      const rowsY = textOf(ops, /^Lift \d+$/).map((o) => o.y!);
      expect(Math.max(...rowsY)).toBeLessThan(foot - 40);
    }
  });
  it('no rows: draws no row text', async () => {
    const { ctx, ops } = fakeCtx();
    await drawStatCard(canvasOf(ctx), stat({ rows: [] }), 'story');
    expect(textOf(ops, /Lift/)).toHaveLength(0);
  });
  it('a long row name is cut so it cannot run under its detail', async () => {
    const { ctx, ops } = fakeCtx();
    await drawStatCard(
      canvasOf(ctx),
      stat({ rows: [{ lead: '🏆', name: 'N'.repeat(70), detail: '100 kg', accent: false }] }),
      'story',
    );
    const name = texts(ops).find((o) => o.font!.includes('600 34px') && o.text!.startsWith('N'))!;
    expect(name.text!.endsWith('…')).toBe(true);
    const detailW = '100 kg'.length * 32 * 0.55;
    expect(name.text!.length * 34 * 0.55).toBeLessThanOrEqual(888 - 110 - detailW - 60);
    expect(textOf(ops, '🏆')).toHaveLength(1);
  });
  it('a kicker too long for the space beside the wordmark is ellipsised', async () => {
    const { ctx, ops } = fakeCtx();
    await drawStatCard(canvasOf(ctx), stat({ kicker: 'K'.repeat(60) }), 'story');
    const k = textOf(ops, /^K+…$/)[0];
    expect(k).toBeDefined();
    const brandW = 'Spotter'.length * 60 * 0.55;
    expect(k.text!.length * 24 * 0.55).toBeLessThanOrEqual(888 - brandW - 48);
  });
  it('long hero label and headline are ellipsised to the inner width', async () => {
    const { ctx, ops } = fakeCtx();
    await drawStatCard(
      canvasOf(ctx),
      stat({ headline: 'H'.repeat(80), hero: { value: '1', label: 'l'.repeat(80) } }),
      'square',
    );
    expect(textOf(ops, /^H+…$/)).toHaveLength(1);
    expect(textOf(ops, /^L+…$/)).toHaveLength(1);
  });
});
