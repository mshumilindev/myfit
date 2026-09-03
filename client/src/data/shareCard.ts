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
  // Clear the hero value's full cap height below the label so the big tonnage
  // never rides up into the "TOTAL VOLUME" line.
  y += story ? 168 : 130;
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
    ctx.fillText(
      ellipsize(ctx, '★ ' + m.record.name.toUpperCase(), innerW - 68),
      padX + 34,
      y + (story ? 50 : 46),
    );
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
      // Measure the weight first, then cap the name to whatever space is left —
      // a long lift name can never run under the result and hide it.
      ctx.font = `500 ${story ? 32 : 28}px ${FONT}`;
      const detailW = ctx.measureText(ex.detail).width;
      ctx.fillStyle = C.text;
      ctx.font = `600 ${story ? 34 : 30}px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(ellipsize(ctx, ex.name, innerW - detailW - 24), padX, y);
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

  // Muscles strip (skip if it would fall below the frame). The chips are drawn
  // from y − chipH + 14 upward, so the gap must clear the previous row's
  // baseline + underline (≈18px) plus the 42px chip rise — otherwise the chips
  // ride up onto the last top-lift row (was overlapping on square).
  if (m.muscles.length > 0 && y + (story ? 78 : 72) < bottomLimit) {
    y += story ? 78 : 72;
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

// ═══ RECAP SHARE CARD ════════════════════════════════════════════════════════
// A period-recap card (Spotter Wrapped) rendered offline on a canvas, offered
// in the same two formats as the workout card (portrait story · square). The
// front+back muscle map is supplied as self-contained SVG strings and
// rasterised here, so the whole card is drawn from local data with no network.

export type RecapShareFormat = 'story' | 'square';

export const RECAP_DIMS: Record<RecapShareFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

export interface RecapShareModel {
  brand: string;
  kicker: string;
  period: string;
  headline: string;
  stats: ShareStat[];
  record?: { name: string; detail: string } | null;
  kcal?: string | null;
  muscles: Array<{ name: string; pct: number }>;
  /** Self-contained front/back body-map SVG (from focusBodyMapSvg). */
  bodyFrontSvg: string;
  bodyBackSvg: string;
  handle: string;
}

/** Rasterise a self-contained SVG string into an <img> (no network, no taint). */
function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** Wrap `text` to at most `maxLines`, ellipsising the last line if it overflows. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = word;
      if (lines.length === maxLines) break;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) lines[maxLines - 1] = ellipsize(ctx, lines[maxLines - 1], maxW);
  return lines;
}

/**
 * Draw the recap share card. Async because it rasterises the muscle-map SVGs
 * and awaits the wordmark font so the card is pixel-identical everywhere.
 */
export async function drawRecapCard(
  canvas: HTMLCanvasElement,
  m: RecapShareModel,
  format: RecapShareFormat = 'story',
): Promise<void> {
  const { w, h } = RECAP_DIMS[format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const story = format === 'story';
  const padX = 96;
  const innerW = w - padX * 2;

  // Rasterise the body maps up front (parallel), and make sure the script
  // wordmark font is ready so it renders as the header font, not a fallback.
  const [front, back] = await Promise.all([
    svgToImage(m.bodyFrontSvg).catch(() => null),
    svgToImage(m.bodyBackSvg).catch(() => null),
  ]);
  try {
    await (document as Document).fonts?.load("400 100px 'Kaushan Script'");
  } catch {
    /* font optional */
  }

  // Ground — a warm graphite wash (matches the app's recap "replay" feel).
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, '#221d15');
  g.addColorStop(0.5, C.bgTop);
  g.addColorStop(1, C.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Hairline frame
  ctx.strokeStyle = C.panelLine;
  ctx.lineWidth = 2;
  roundRect(ctx, 40, 40, w - 80, h - 80, 40);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // ── Header: wordmark (script) left · kicker right ──────────────────────────
  let y = story ? 172 : 132;
  ctx.fillStyle = C.text;
  ctx.font = `400 ${story ? 60 : 52}px 'Kaushan Script', cursive`;
  ctx.fillText(m.brand, padX, y);
  ctx.fillStyle = C.brass;
  ctx.font = `600 24px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.save();
  ctx.letterSpacing = '3px';
  ctx.fillText(m.kicker.toUpperCase(), padX + innerW, y - (story ? 14 : 12));
  ctx.restore();
  ctx.textAlign = 'left';

  // ── Period + headline ──────────────────────────────────────────────────────
  y += story ? 92 : 78;
  ctx.fillStyle = C.text;
  ctx.font = `800 ${story ? 84 : 66}px ${FONT}`;
  ctx.fillText(ellipsize(ctx, m.period, innerW), padX, y);
  y += story ? 20 : 16;
  ctx.fillStyle = C.brass;
  ctx.font = `400 ${story ? 34 : 30}px ${FONT}`;
  const hlLines = wrapLines(ctx, m.headline, innerW, 2);
  const hlLead = story ? 46 : 40;
  for (const line of hlLines) {
    y += hlLead;
    ctx.fillText(line, padX, y);
  }

  // ── Stats row (no dividers) ────────────────────────────────────────────────
  y += story ? 58 : 42;
  const statH = story ? 178 : 140;
  roundRect(ctx, padX, y, innerW, statH, 30);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = C.panelLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const cells = m.stats.slice(0, 3);
  const cw = innerW / cells.length;
  cells.forEach((c, i) => {
    const cx = padX + cw * i + cw / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = C.brass;
    ctx.font = `800 ${story ? 66 : 56}px ${FONT}`;
    ctx.fillText(ellipsize(ctx, c.value, cw - 20), cx, y + statH / 2 + 6);
    ctx.fillStyle = C.muted;
    ctx.font = `500 24px ${FONT}`;
    ctx.save();
    ctx.letterSpacing = '2px';
    ctx.fillText(ellipsize(ctx, c.label.toUpperCase(), cw - 16), cx, y + statH - 36);
    ctx.restore();
  });
  ctx.textAlign = 'left';
  y += statH;

  // ── Layout of the lower blocks (bars · record · kcal · footer) ─────────────
  // Story is portrait, so it can show the anatomical map: the bottom cluster is
  // anchored to the foot and the map fills the gap between stats and it. Square
  // has no room for a legible map (the user chose portrait for that), so it just
  // flows the blocks straight down from the stats — compact, no shrunken map.
  const footerBaseline = h - (story ? 96 : 60);
  const kcalH = story ? 96 : 84;
  const recH = story ? 128 : 116;
  const barRowH = story ? 40 : 36;
  const barGap = story ? 24 : 18;
  const nBars = Math.min(3, m.muscles.length);
  const barsH = nBars > 0 ? nBars * barRowH + (nBars - 1) * barGap : 0;

  let barsTop = 0;
  let recTop = 0;
  let kcalTop = 0;
  let drawMap = false;
  let mapTop = 0;
  let mapMaxH = 0;

  if (story) {
    let bottom = footerBaseline - 54;
    if (m.kcal) {
      bottom -= kcalH;
      kcalTop = bottom;
      bottom -= 28;
    }
    if (m.record) {
      bottom -= recH;
      recTop = bottom;
      bottom -= 28;
    }
    if (nBars > 0) {
      bottom -= barsH;
      barsTop = bottom;
      bottom -= 34;
    }
    mapTop = y + 34;
    mapMaxH = Math.max(0, bottom - mapTop);
    drawMap = (!!front || !!back) && mapMaxH > 60;
  } else {
    let cy = y + 44;
    if (nBars > 0) {
      barsTop = cy;
      cy += barsH + 26;
    }
    if (m.record) {
      recTop = cy;
      cy += recH + 20;
    }
    if (m.kcal) {
      kcalTop = cy;
    }
  }

  // ── Muscle map (portrait only) fills the space between stats and bottom ─────
  if (drawMap) {
    const imgs = [front, back].filter((im): im is HTMLImageElement => !!im);
    const gap = imgs.length > 1 ? 28 : 0;
    const aspects = imgs.map((im) => im.width / im.height);
    const aSum = aspects.reduce((s, a) => s + a, 0);
    let mh = mapMaxH;
    let totalW = mh * aSum + gap;
    if (totalW > innerW) {
      mh = (innerW - gap) / aSum;
      totalW = innerW;
    }
    let dx = (w - totalW) / 2;
    const dyTop = mapTop + (mapMaxH - mh) / 2;
    for (let k = 0; k < imgs.length; k++) {
      const iw = mh * aspects[k];
      ctx.drawImage(imgs[k], dx, dyTop, iw, mh);
      dx += iw + gap;
    }
  }

  // ── Muscle bars (full width, no dividers) ──────────────────────────────────
  if (nBars > 0) {
    const labelW = story ? 250 : 210;
    const pctW = 90;
    const barX = padX + labelW + 20;
    const barW = innerW - labelW - pctW - 40;
    let by = barsTop;
    for (const mu of m.muscles.slice(0, nBars)) {
      const midY = by + barRowH / 2;
      ctx.fillStyle = C.text;
      ctx.font = `600 ${story ? 30 : 27}px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ellipsize(ctx, mu.name, labelW), padX, midY);
      const trackH = 14;
      roundRect(ctx, barX, midY - trackH / 2, barW, trackH, trackH / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      const fillW = Math.max(trackH, (Math.min(100, mu.pct) / 100) * barW);
      roundRect(ctx, barX, midY - trackH / 2, fillW, trackH, trackH / 2);
      ctx.fillStyle = C.brass;
      ctx.fill();
      ctx.fillStyle = C.muted;
      ctx.font = `600 ${story ? 28 : 25}px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${mu.pct}%`, padX + innerW, midY);
      by += barRowH + barGap;
    }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  // ── Record card (gold) ─────────────────────────────────────────────────────
  if (m.record) {
    roundRect(ctx, padX, recTop, innerW, recH, 26);
    ctx.fillStyle = C.brassSoft;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,168,106,0.34)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = C.brass;
    ctx.font = `700 22px ${FONT}`;
    ctx.save();
    ctx.letterSpacing = '2px';
    ctx.fillText(
      '★ ' + ellipsize(ctx, m.record.name.toUpperCase(), innerW - 220),
      padX + 34,
      recTop + (story ? 50 : 46),
    );
    ctx.restore();
    ctx.fillStyle = C.text;
    ctx.font = `800 ${story ? 46 : 40}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(m.record.detail, padX + innerW - 34, recTop + recH - (story ? 40 : 36));
    ctx.textAlign = 'left';
  }

  // ── Calorie chip (blue) ────────────────────────────────────────────────────
  if (m.kcal) {
    roundRect(ctx, padX, kcalTop, innerW, kcalH, 24);
    ctx.fillStyle = 'rgba(61,132,201,0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(61,132,201,0.32)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // flame glyph
    ctx.fillStyle = '#3d84c9';
    ctx.beginPath();
    const fx = padX + 44;
    const fy = kcalTop + kcalH / 2;
    ctx.moveTo(fx, fy - 22);
    ctx.bezierCurveTo(fx + 20, fy - 6, fx + 16, fy + 22, fx, fy + 22);
    ctx.bezierCurveTo(fx - 16, fy + 22, fx - 20, fy - 2, fx - 4, fy - 10);
    ctx.bezierCurveTo(fx - 6, fy + 2, fx + 2, fy + 6, fx + 4, fy - 2);
    ctx.bezierCurveTo(fx + 6, fy - 10, fx, fy - 14, fx, fy - 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8fbde8';
    ctx.font = `700 ${story ? 40 : 34}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(ellipsize(ctx, m.kcal, innerW - 120), padX + 84, fy + 2);
    ctx.textBaseline = 'alphabetic';
  }

  // ── Footer handle ──────────────────────────────────────────────────────────
  ctx.fillStyle = C.faint;
  ctx.font = `600 24px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.letterSpacing = '3px';
  ctx.fillText(m.handle.toUpperCase(), w / 2, footerBaseline);
  ctx.restore();
  ctx.textAlign = 'left';
}
