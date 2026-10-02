/**
 * Minimal SVG path bounding box (M/m L/l H/h V/v C/c S/s Q/q T/t Z/z; no arcs —
 * the `body-muscles` paths do not use them). Curves contribute their control
 * points, so the box is a safe superset of the drawn shape. Pure maths: no DOM,
 * so it works under jsdom/SSR and in the window-table generator + its test.
 */
export type Box = { x0: number; y0: number; x1: number; y1: number };

export function pathBounds(d: string): Box {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cmd = '';
  let i = 0;
  const b: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const add = (px: number, py: number) => {
    b.x0 = Math.min(b.x0, px);
    b.y0 = Math.min(b.y0, py);
    b.x1 = Math.max(b.x1, px);
    b.y1 = Math.max(b.y1, py);
  };
  const num = () => Number(tokens[i++]);
  const arity: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2 };
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) cmd = tokens[i++];
    const lower = cmd.toLowerCase();
    if (lower === 'z') {
      x = sx;
      y = sy;
      continue;
    }
    const n = arity[lower];
    if (!n) throw new Error(`unsupported path command ${cmd}`);
    const rel = cmd === lower;
    const a = Array.from({ length: n }, num);
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (lower === 'h') {
      x = a[0] + ox;
    } else if (lower === 'v') {
      y = a[0] + oy;
    } else {
      for (let k = 0; k < n - 2; k += 2) add(a[k] + ox, a[k + 1] + oy);
      x = a[n - 2] + ox;
      y = a[n - 1] + oy;
    }
    add(x, y);
    if (lower === 'm') {
      sx = x;
      sy = y;
      cmd = rel ? 'l' : 'L'; // implicit lineto after the first pair
    }
  }
  return b;
}

export function unionBounds(boxes: Box[]): Box {
  return boxes.reduce(
    (u, b) => ({
      x0: Math.min(u.x0, b.x0),
      y0: Math.min(u.y0, b.y0),
      x1: Math.max(u.x1, b.x1),
      y1: Math.max(u.y1, b.y1),
    }),
    { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
  );
}
