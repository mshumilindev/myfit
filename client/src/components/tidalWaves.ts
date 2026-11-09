/**
 * Studio app switch, extra waves (spec 08.11.2026): while the next app loads (`html[data-glitch='load']`) the water
 * stands and 1-3 slower waves rise through it one after another (1.2-2.5 s each, random tilt up to ~150 px across the
 * width, random strength). A wave that has left the top is removed; when the water drops (`in`) the rest fade out.
 * Reduced motion never sets `data-glitch`, so nothing is drawn. The first (big) wave and the surface line are CSS
 * (themes/_studio.switch.css).
 */
let running = false;
let timer: number | undefined;
const live = new Set<HTMLElement>();
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function spawn() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const tilt = (Math.random() < 0.5 ? -1 : 1) * rnd(20, 150);
  const deg = (Math.atan2(tilt, w) * 180) / Math.PI;
  const dur = rnd(1200, 2500);
  const band = document.createElement('div');
  band.className = 'tidal-wave';
  band.setAttribute('aria-hidden', 'true');
  const line = document.createElement('div');
  line.className = 'tidal-wave tidal-wave--line';
  line.style.setProperty('--tidal-la', String(rnd(0.32, 0.57).toFixed(2)));
  for (const el of [band, line]) {
    document.documentElement.appendChild(el);
    live.add(el);
    const from = h + 130 + Math.abs(tilt);
    const to = -130 - Math.abs(tilt);
    const a = el.animate(
      [
        { transform: `translateY(${from}px) rotate(${deg}deg)` },
        { transform: `translateY(${to}px) rotate(${deg}deg)` },
      ],
      { duration: dur, easing: 'cubic-bezier(0.37, 0, 0.63, 1)', fill: 'both' },
    );
    a.onfinish = () => {
      el.remove();
      live.delete(el);
    };
  }
}

function loop() {
  timer = undefined;
  if (!running) return;
  const active = Math.ceil(live.size / 2);
  const target = 1 + Math.floor(Math.random() * 3);
  if (active < target) spawn();
  timer = window.setTimeout(loop, rnd(150, 500));
}

function sync() {
  const html = document.documentElement;
  const phase = html.dataset.glitch;
  const on = phase === 'load' && html.dataset.theme === 'studio';
  if (on && !running) {
    running = true;
    loop();
  } else if (!on) {
    running = false;
    if (timer) window.clearTimeout(timer);
    timer = undefined;
    for (const el of live) {
      el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], {
        duration: phase === 'in' ? 380 : 0,
        fill: 'forwards',
      }).onfinish = () => {
        el.remove();
        live.delete(el);
      };
    }
  }
}

/** Call once at start. */
export function initTidalWaves(): () => void {
  const mo = new MutationObserver(sync);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-glitch'] });
  return () => {
    mo.disconnect();
    running = false;
  };
}
