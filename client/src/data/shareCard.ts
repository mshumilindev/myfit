/**
 * Share-card renderer (Live-session power features, AC-3).
 *
 * A purpose-built "premium graphite receipt" drawn on a canvas — rendered
 * entirely from local workout data (offline-capable, AC-3.10) and separate
 * from the live UI (AC-3.8). Dark graphite ground, brass accents, emerald
 * reserved for real records. No marketing copy, no "AI"/"smart" labels.
 */

export type ShareFormat = 'story' | 'square';

export interface ShareStat {
  label: string;
  value: string;
}

export interface ShareModel {
  brand: string;
  tagline: string;
  title: string;
  date: string;
  gym?: string | null;
  heroValue: string;
  heroLabel: string;
  stats: ShareStat[];
  record?: { name: string; detail: string } | null;
  top: Array<{ name: string; detail: string }>;
  topLabel: string;
  muscles: Array<{ name: string; count: number }>;
  autoFinished: boolean;
  autoLabel: string;
}

export const SHARE_DIMS: Record<ShareFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

const C = {
  bgTop: '#191B1F',
  bgBottom: '#0D0E10',
  panel: 'rgba(255,255,255,0.045)',
  panelLine: 'rgba(255,255,255,0.09)',
  text: '#F3F0EA',
  muted: '#93908A',
  faint: '#5F5D58',
  brass: '#C8A86A',
  brassSoft: 'rgba(200,168,106,0.16)',
  emerald: '#54D488',
  emeraldSoft: 'rgba(84,212,136,0.14)',
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

const FONT = "'Inter','Helvetica Neue',Arial,sans-serif";

/** Draw the share card onto a canvas at the format's native resolution. */
export function drawShareCard(canvas: HTMLCanvasElement, m: ShareModel, format: ShareFormat): void {
  const { w, h } = SHARE_DIMS[format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const story = format === 'story';
  const padX = 96;
  const innerW = w - padX * 2;
  // Nothing may be drawn below this line — keeps every card inside its frame.
  const bottomLimit = h - (story ? 150 : 92);

  // Ground
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.bgTop);
  g.addColorStop(1, C.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Subtle brass hairline frame
  ctx.strokeStyle = C.panelLine;
  ctx.lineWidth = 2;
  roundRect(ctx, 40, 40, w - 80, h - 80, 40);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Top brass accent only — the wordmark lives at the foot (no top brand text).
  let y = story ? 158 : 120;
  ctx.fillStyle = C.brass;
  roundRect(ctx, padX, y - 8, 54, 8, 4);
  ctx.fill();

  // Title
  y += story ? 96 : 80;
  ctx.fillStyle = C.text;
  ctx.font = `800 ${story ? 82 : 64}px ${FONT}`;
  ctx.fillText(ellipsize(ctx, m.title, innerW), padX, y);
  // Date · gym
  y += story ? 50 : 42;
  ctx.fillStyle = C.muted;
  ctx.font = `400 30px ${FONT}`;
  const sub = m.gym ? `${m.date}  ·  ${m.gym}` : m.date;
  ctx.fillText(ellipsize(ctx, sub, innerW), padX, y);
  if (m.autoFinished) {
    y += 40;
    ctx.fillStyle = C.faint;
    ctx.font = `500 22px ${FONT}`;
    ctx.fillText(m.autoLabel, padX, y);
  }

  // Hero metric
  y += story ? 150 : 100;
  ctx.fillStyle = C.brass;
  ctx.font = `500 26px ${FONT}`;
  ctx.save();
  ctx.letterSpacing = '3px';
  ctx.fillText(m.heroLabel.toUpperCase(), padX, y);
  ctx.restore();
  y += story ? 130 : 100;
  ctx.fillStyle = C.text;
  ctx.font = `800 ${story ? 176 : 128}px ${FONT}`;
  ctx.fillText(m.heroValue, padX, y);

  // Stats row (panel)
  y += story ? 70 : 52;
  const statH = story ? 168 : 132;
  roundRect(ctx, padX, y, innerW, statH, 28);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = C.panelLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const cells = m.stats.slice(0, 3);
  const cw = innerW / cells.length;
  cells.forEach((c, i) => {
    const cx = padX + cw * i + cw / 2;
    if (i > 0) {
      ctx.strokeStyle = C.panelLine;
      ctx.beginPath();
      ctx.moveTo(padX + cw * i, y + 32);
      ctx.lineTo(padX + cw * i, y + statH - 32);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = C.text;
    ctx.font = `700 ${story ? 62 : 54}px ${FONT}`;
    ctx.fillText(c.value, cx, y + statH / 2 + 8);
    ctx.fillStyle = C.muted;
    ctx.font = `500 24px ${FONT}`;
    ctx.save();
    ctx.letterSpacing = '2px';
    ctx.fillText(c.label.toUpperCase(), cx, y + statH - 34);
    ctx.restore();
  });
  ctx.textAlign = 'left';
  y += statH;

  // Record (emerald) — only when real
  if (m.record) {
    y += story ? 56 : 34;
    const rh = story ? 132 : 122;
    roundRect(ctx, padX, y, innerW, rh, 24);
    ctx.fillStyle = C.emeraldSoft;
    ctx.fill();
    ctx.strokeStyle = 'rgba(84,212,136,0.34)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = C.emerald;
    ctx.font = `700 24px ${FONT}`;
    ctx.save();
    ctx.letterSpacing = '2px';
    ctx.fillText('★ ' + m.record.name.toUpperCase(), padX + 34, y + (story ? 50 : 46));
    ctx.restore();
    ctx.fillStyle = C.text;
    ctx.font = `700 ${story ? 44 : 36}px ${FONT}`;
    ctx.fillText(
      ellipsize(ctx, m.record.detail, innerW - 68),
      padX + 34,
      y + rh - (story ? 34 : 32),
    );
    y += rh;
  }

  // Top exercises (skip if there is no vertical room, e.g. a busy square card)
  const rowH = story ? 62 : 54;
  if (m.top.length > 0 && y + (story ? 60 : 40) + rowH < bottomLimit) {
    y += story ? 60 : 40;
    ctx.fillStyle = C.brass;
    ctx.font = `500 24px ${FONT}`;
    ctx.save();
    ctx.letterSpacing = '3px';
    ctx.fillText(m.topLabel.toUpperCase(), padX, y);
    ctx.restore();
    y += story ? 20 : 16;
    for (const ex of m.top.slice(0, story ? 3 : 2)) {
      if (y + rowH > bottomLimit) break;
      y += rowH;
      ctx.fillStyle = C.text;
      ctx.font = `600 ${story ? 34 : 30}px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(ellipsize(ctx, ex.name, innerW * 0.62), padX, y);
      ctx.fillStyle = C.muted;
      ctx.font = `500 ${story ? 32 : 28}px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(ex.detail, padX + innerW, y);
      ctx.textAlign = 'left';
      ctx.strokeStyle = C.panelLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, y + (story ? 22 : 18));
      ctx.lineTo(padX + innerW, y + (story ? 22 : 18));
      ctx.stroke();
    }
  }

  // Muscles strip (skip if it would fall below the frame)
  if (m.muscles.length > 0 && y + (story ? 78 : 50) < bottomLimit) {
    y += story ? 78 : 50;
    let cx = padX;
    ctx.font = `600 26px ${FONT}`;
    const chipH = 56;
    for (const mu of m.muscles.slice(0, 6)) {
      const label = mu.count > 0 ? `${mu.name} · ${mu.count}` : mu.name;
      const tw = ctx.measureText(label).width;
      const chipW = tw + 44;
      if (cx + chipW > padX + innerW) break;
      roundRect(ctx, cx, y - chipH + 14, chipW, chipH, chipH / 2);
      ctx.fillStyle = C.brassSoft;
      ctx.fill();
      ctx.fillStyle = C.brass;
      ctx.fillText(label, cx + 22, y);
      cx += chipW + 16;
    }
  }

  // Footer brand mark
  ctx.fillStyle = C.faint;
  ctx.font = `600 24px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.letterSpacing = '4px';
  ctx.fillText(m.brand.toUpperCase(), w / 2, h - (story ? 96 : 52));
  ctx.restore();
  ctx.textAlign = 'left';
}

/** Canvas → PNG Blob (offline; no network). */
export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
