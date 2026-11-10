/* global window, document, getComputedStyle */
/* Contrast scan of the REAL app screen (paste into the browser console on localhost, or run through Playwright's
   page.evaluate). Storybook audits only see what a story renders; this sees the live Today / Overview / sheets with
   real data. Returns [ratio, class, text] for every visible text whose colour against its composited background is
   below WCAG AA (4.5, or 3 for large text). Ignores faded (opacity < 1) and gradient-clip (transparent) text.
   Usage: set `data-mode` / `data-sleep` / `data-accent` on <html>, open each screen, run `liveContrastScan()`. */
window.liveContrastScan = () => {
  const parse = (s) => {
    const m = s.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)/);
    if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] == null ? 1 : +m[4]];
    const r = s.match(/rgba?\(([^)]+)\)/);
    if (!r) return [0, 0, 0, 0];
    const p = r[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]];
  };
  const over = (t, b) => [0, 1, 2].map((i) => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
  const lum = (c) => {
    const f = c
      .slice(0, 3)
      .map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  const bgOf = (el) => {
    const chain = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) chain.push(c);
      if (c[3] >= 1) break;
    }
    let base = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (base[3] < 1) base = [255, 255, 255, 1];
    for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base);
    return base;
  };
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const t = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim())
      .join(' ');
    if (!t) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width < 2 || r.height < 2)
      continue;
    let op = 1;
    for (let n = el; n; n = n.parentElement) op *= +getComputedStyle(n).opacity;
    if (op < 0.99) continue;
    const bg = bgOf(el);
    const fg = over(parse(cs.color), bg);
    const a = lum(fg);
    const b = lum(bg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const fs = parseFloat(cs.fontSize);
    const need = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700) ? 3 : 4.5;
    const k = `${el.className}|${t.slice(0, 20)}`;
    if (ratio < need && !seen.has(k)) {
      seen.add(k);
      out.push([ratio.toFixed(2), String(el.className).slice(0, 45), t.slice(0, 24)]);
    }
  }
  return out;
};
