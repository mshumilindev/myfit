/**
 * Static review page (assets/exercise-images/review/index.html), rewritten
 * after every exercise so it can stay open in a browser during a run.
 * Reference vs generated start/end side by side, QA score + issues, filters.
 * Approve/Reject marks are kept in the page (localStorage) and exported as a
 * JSON file that `npm run exercise-images -- review --import <file>` applies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, REPO_ROOT } from './config';
import type { Entry, Manifest } from './manifest';

interface Card {
  id: string;
  name: string;
  muscle: string | null;
  equipment: string | null;
  frames: {
    state: string;
    ref: string | null;
    gen: string | null;
    status: string;
    score: number | null;
    issues: string[];
    attempts: number;
    manual: string | null;
    error: string | null;
  }[];
}

function toUrl(fromDir: string, repoRel: string | null): string | null {
  if (!repoRel) return null;
  return path.relative(fromDir, path.join(REPO_ROOT, repoRel)).split(path.sep).join('/');
}

export function buildCards(m: Manifest, fromDir = PATHS.review): Card[] {
  const by = new Map<string, Entry[]>();
  for (const e of Object.values(m.entries)) {
    const l = by.get(e.exerciseId) ?? [];
    l.push(e);
    by.set(e.exerciseId, l);
  }
  const order = { start: 0, end: 1, hero: 2 } as Record<string, number>;
  return [...by.values()].map((list) => {
    const first = list[0];
    return {
      id: first.exerciseId,
      name: first.name,
      muscle: first.primaryMuscle,
      equipment: first.equipment,
      frames: list
        .sort((a, b) => order[a.state] - order[b.state])
        .map((e) => ({
          state: e.state,
          ref: toUrl(
            fromDir,
            e.referenceUrls[e.state === 'end' ? 1 : 0]
              ? `client/public${e.referenceUrls[e.state === 'end' ? 1 : 0]}`
              : null,
          ),
          gen: toUrl(fromDir, e.outputPath),
          status: e.status,
          score: e.qa?.score ?? null,
          issues: e.qaIssues.length ? e.qaIssues : e.error ? [e.error] : [],
          attempts: e.attempts,
          manual: e.manualApproval,
          error: e.error,
        })),
    };
  });
}

export function writeReview(m: Manifest): string {
  fs.mkdirSync(PATHS.review, { recursive: true });
  const file = path.join(PATHS.review, 'index.html');
  const data = JSON.stringify({
    updatedAt: m.updatedAt,
    anchor: m.anchor,
    cards: buildCards(m),
  }).replace(/</g, '\\u003c');
  const anchorUrl = m.anchor ? toUrl(PATHS.review, m.anchor.path) : null;
  fs.writeFileSync(file, PAGE.replace('__DATA__', data).replace('__ANCHOR__', anchorUrl ?? ''));
  return file;
}

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Exercise images — review</title>
<style>
:root{--bg:#16171a;--s:#1f2125;--s2:#262a2d;--t:#e9eaec;--m:#90959a;--a:#d9a24f;--ok:#4cbe8c;--bad:#e2564f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t);font:14px/1.4 Inter,system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);padding:12px 18px;border-bottom:1px solid #ffffff22;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
header h1{font-size:16px;margin:0 12px 0 0}select,input,button{background:var(--s);color:var(--t);border:1px solid #ffffff22;border-radius:8px;padding:6px 8px;font:inherit}
button{cursor:pointer}button.pri{border-color:var(--a);color:var(--a)}.anchor{height:44px;border-radius:6px}
main{padding:14px 18px;display:grid;gap:14px}
.card{background:var(--s);border-radius:12px;padding:12px;display:grid;gap:8px}
.card h2{font-size:15px;margin:0}.meta{color:var(--m);font-size:12px}
.frames{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr));gap:10px}
.frame{background:var(--s2);border-radius:10px;padding:8px;display:grid;gap:6px}
.pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}.pair figure{margin:0}.pair img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:6px;background:#000}
figcaption{font-size:11px;color:var(--m)}.st{font-weight:600}.st.approved{color:var(--ok)}.st.rejected,.st.failed{color:var(--bad)}
.issues{margin:0;padding-left:16px;color:#f3c2bf;font-size:12px}.row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.mark{font-size:12px;color:var(--a)}
</style></head><body>
<header>
<h1>Exercise images</h1>
<img class="anchor" id="anchor" alt="identity anchor" title="identity anchor">
<select id="fStatus"><option value="">all statuses</option><option>pending review</option><option>approved</option><option>generated</option><option>rejected</option><option>failed</option><option>retry</option></select>
<select id="fMuscle"><option value="">all muscles</option></select>
<select id="fEquip"><option value="">all equipment</option></select>
<label>QA ≤ <input id="fScore" type="number" min="0" max="10" step="0.5" style="width:64px"></label>
<input id="fText" placeholder="search">
<span id="count" class="meta"></span>
<button class="pri" id="export">Export decisions</button>
<label class="meta"><input type="checkbox" id="auto"> auto-refresh</label>
</header>
<main id="list"></main>
<script>
const DATA = __DATA__;
const ANCHOR = "__ANCHOR__";
const KEY = 'exercise-image-review';
let marks = {}; try { marks = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(marks)); } catch {} };
if (ANCHOR) document.getElementById('anchor').src = ANCHOR; else document.getElementById('anchor').remove();
const uniq = (k) => [...new Set(DATA.cards.map(c => c[k]).filter(Boolean))].sort();
for (const [id, k] of [['fMuscle','muscle'],['fEquip','equipment']]) for (const v of uniq(k)) document.getElementById(id).append(new Option(v, v));
const el = (t, a = {}, ...kids) => { const e = document.createElement(t); Object.assign(e, a); e.append(...kids.filter(k => k != null)); return e; };
function pendingReview(f) { return (f.status === 'generated' || f.status === 'rejected' || f.status === 'approved') && !f.manual; }
function render() {
  const s = fStatus.value, mu = fMuscle.value, eq = fEquip.value, sc = parseFloat(fScore.value), q = fText.value.toLowerCase();
  const list = DATA.cards.filter(c =>
    (!mu || c.muscle === mu) && (!eq || c.equipment === eq) && (!q || (c.name + c.id).toLowerCase().includes(q)) &&
    c.frames.some(f => (!s || (s === 'pending review' ? pendingReview(f) : f.status === s)) && (isNaN(sc) || (f.score ?? 0) <= sc)));
  count.textContent = list.length + ' / ' + DATA.cards.length + ' exercises · updated ' + DATA.updatedAt;
  const main = document.getElementById('list'); main.replaceChildren();
  for (const c of list) {
    const frames = el('div', { className: 'frames' });
    for (const f of c.frames) {
      const k = c.id + ':' + f.state;
      const mark = marks[k];
      const ok = el('button', { textContent: 'Approve', onclick: () => { marks[k] = 'approved'; save(); render(); } });
      const no = el('button', { textContent: 'Reject', onclick: () => { const note = prompt('What is wrong? (fed into the regeneration)') || ''; marks[k] = { decision: 'rejected', note }; save(); render(); } });
      frames.append(el('div', { className: 'frame' },
        el('div', { className: 'pair' },
          el('figure', {}, f.ref ? el('img', { src: f.ref, loading: 'lazy' }) : null, el('figcaption', { textContent: 'reference · ' + f.state })),
          el('figure', {}, f.gen ? el('img', { src: f.gen + '?t=' + Date.now(), loading: 'lazy' }) : null, el('figcaption', { textContent: 'generated · ' + f.state }))),
        el('div', { className: 'row' },
          el('span', { className: 'st ' + f.status, textContent: f.status }),
          el('span', { className: 'meta', textContent: 'QA ' + (f.score ?? '—') + ' · attempts ' + f.attempts + (f.manual ? ' · manual: ' + f.manual : '') }),
          ok, no, mark ? el('span', { className: 'mark', textContent: 'marked: ' + (mark.decision || mark) }) : null),
        f.issues.length ? el('ul', { className: 'issues' }, ...f.issues.map(i => el('li', { textContent: i }))) : null));
    }
    main.append(el('section', { className: 'card' },
      el('h2', { textContent: c.name }),
      el('div', { className: 'meta', textContent: c.id + ' · ' + (c.muscle || '—') + ' · ' + (c.equipment || '—') }),
      frames));
  }
}
for (const id of ['fStatus','fMuscle','fEquip','fScore','fText']) document.getElementById(id).addEventListener('input', render);
document.getElementById('export').onclick = () => {
  const blob = new Blob([JSON.stringify(marks, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'review-decisions.json' }); a.click();
};
let timer = null;
const auto = document.getElementById('auto');
const setAuto = (on) => { clearInterval(timer); auto.checked = on; try { localStorage.setItem(KEY + ':auto', on ? '1' : ''); } catch {} if (on) timer = setInterval(() => location.reload(), 20000); };
auto.onchange = (e) => setAuto(e.target.checked);
try { if (localStorage.getItem(KEY + ':auto')) setAuto(true); } catch {}
render();
</script></body></html>
`;
