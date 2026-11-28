import { ago, h } from './dom.js';
import { renderMd } from './md.js';

export const TABS = [
  ['overview', 'Overview'],
  ['plan', 'Plan & AC'],
  ['docs', 'Spike → Plan'],
  ['pauses', 'Pauses & flow'],
  ['runs', 'Runs'],
  ['ci', 'CI'],
  ['quality', 'Quality'],
  ['risks', 'Risks'],
  ['rules', 'Rules & DoD'],
  ['linearsync', 'Linear sync'],
  ['release', 'Release'],
];

const kpi = (label, value, note) =>
  h(
    'div',
    { class: 'kpi' },
    h('span', { class: 'lbl' }, label),
    h('span', { class: 'v num' }, value),
    h('span', { class: 'd' }, note),
  );

const card = (title, meta, ...body) =>
  h(
    'section',
    { class: 'card' },
    h('div', { class: 'ch' }, h('h2', null, title), meta ? h('span', { class: 'm' }, meta) : null),
    ...body,
  );

const note = (text) => h('p', { class: 'empty-note' }, text);

export function emptyState(snap) {
  return h(
    'div',
    {
      class: 'card',
      style:
        'margin-top:40px;padding:56px 40px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px',
    },
    h('h1', { style: 'margin:0;font-size:28px;font-weight:600' }, 'Nothing in flight'),
    h(
      'p',
      { class: 't-m', style: 'margin:0;max-width:460px;font-size:14px' },
      'No task is in work and no branch is waiting for cpd. A lane appears here by itself when a task starts.',
    ),
    snap ? h('span', { class: 'chip' }, 'read-only · localhost') : null,
  );
}

export function staleBanner(text) {
  return h(
    'div',
    {
      class: 'card',
      style:
        'padding:14px 18px;border-color:color-mix(in srgb, var(--amb) 50%, transparent);display:flex;gap:12px;align-items:center;flex-wrap:wrap',
    },
    h('span', { class: 'pill p' }, 'STALE'),
    h('span', { class: 't-m' }, text),
  );
}

export function overall(snap, select) {
  const tasks = snap.tasks;
  const work = tasks.filter((t) => t.source !== 'ready');
  const ready = tasks.filter((t) => t.source === 'ready');
  const avg = tasks.length
    ? Math.round(tasks.reduce((a, t) => a + t.plan.pct, 0) / tasks.length)
    : 0;
  const sum = (k) => tasks.reduce((a, t) => a + (t.capture[k] ?? 0), 0);
  const stops = sum('stops');
  const rows = tasks.map((t) =>
    h(
      'button',
      { class: 'row btnrow c-ov', on: { click: () => select(t.id) } },
      h('span', { class: 't-id' }, t.id),
      h('span', { class: 'bar' }, h('i', { style: `width:${t.plan.pct}%` })),
      h('span', { class: 't-mono' }, `${t.plan.done}/${t.plan.total}`),
      h('span', { class: 't-m' }, `${t.plan.pct}%`),
      h('span', { class: 't-m' }, `${t.capture.unforced} stops`),
      h(
        'span',
        { class: 'pill ' + (t.source === 'ready' ? 'p' : 'w') },
        t.source === 'ready' ? 'cpd' : 'work',
      ),
    ),
  );
  return [
    h(
      'div',
      { class: 'hd' },
      h(
        'div',
        null,
        h('h1', null, 'Σ Overall'),
        h(
          'div',
          { class: 'sub' },
          `${tasks.length} task${tasks.length === 1 ? '' : 's'} in flight`,
        ),
      ),
    ),
    h(
      'div',
      { class: 'kpis' },
      kpi('In work', String(work.length), 'tasks'),
      kpi('Waiting for cpd', String(ready.length), 'branches'),
      kpi('Average progress', `${avg}`, 'percent over tasks'),
      kpi('Stops without result', String(sum('unforced')), `of ${stops} stops`),
      kpi('Owner nudges', String(sum('nudges')), 'prompts right after such a stop'),
    ),
    card('Tasks', 'click a row to open', h('div', { class: 'tbl' }, rows)),
  ];
}

const needsPill = (n) => h('span', { class: 'pill p' }, n);

/** Chapters of the plan, like a video timeline: items group by the id prefix (`A.1`, `A.2` -> `A`), a segment's width is
 *  its item count, its fill is the done share, and hovering (or focusing) a segment lists what is inside. */
function chapters(t) {
  if (!t.items.length) return note('No plan items on this machine yet.');
  const groups = new Map();
  for (const it of t.items) {
    const key = String(it.id).split('.')[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const mark = { done: '✓', doing: '▶', blocked: '■', todo: '○' };
  const bar = h(
    'div',
    { class: 'chap-bar' },
    [...groups].map(([key, items], idx, all) => {
      const done = items.filter((i) => i.status === 'done').length;
      const doing = items.some((i) => i.status === 'doing');
      const blocked = items.some((i) => i.status === 'blocked');
      const pct = Math.round((done / items.length) * 100);
      const tip = h(
        'div',
        { class: `chap-tip${idx > all.length / 2 ? ' end' : ''}`, role: 'tooltip' },
        h('div', { class: 'chap-tt' }, `${key} · ${done}/${items.length} done`),
        items.map((i) =>
          h(
            'div',
            { class: `chap-it s-${i.status}` },
            `${mark[i.status] ?? '·'} ${i.id}  ${i.text}`,
          ),
        ),
      );
      return h(
        'div',
        {
          class: `chap${doing ? ' is-doing' : ''}${blocked ? ' is-blocked' : ''}`,
          style: `flex:${items.length} 1 0`,
          tabindex: '0',
          'aria-label': `${key}: ${done} of ${items.length} done`,
        },
        h('div', { class: 'chap-fill', style: `width:${pct}%` }),
        tip,
      );
    }),
  );
  return h('div', null, bar, h('div', { class: 'chap-lbl t-m' }, [...groups.keys()].join('  ·  ')));
}

function overview(t) {
  return [
    h(
      'div',
      { class: 'kpis' },
      kpi('Progress', `${t.plan.pct}`, `${t.plan.done} of ${t.plan.total} items`),
      kpi('Doing', String(t.plan.doing), 'in work now'),
      kpi('To do', String(t.plan.todo), 'queued'),
      kpi('Waiting for me', String(t.plan.blocked), 'blocked items'),
      kpi('Sessions', String(t.capture.sessions), 'recorded'),
    ),
    card('Progress by section', `${t.plan.done}/${t.plan.total}`, chapters(t)),
    card(
      'Waiting for the owner',
      `${t.blocked.length}`,
      t.blocked.length
        ? h(
            'div',
            { class: 'tbl' },
            t.blocked.map((b) =>
              h(
                'div',
                { class: 'row', style: 'grid-template-columns:120px 1fr' },
                h('span', { class: 't-id' }, b.id),
                needsPill(b.needs),
              ),
            ),
          )
        : note('Nothing waits for the owner.'),
    ),
  ];
}

function plan(t) {
  const parts = [
    ['done', 'k-l'],
    ['doing', 'k-w'],
    ['blocked', 'k-p'],
    ['todo', 'k-c'],
  ];
  const total = Math.max(1, t.plan.total);
  return [
    card(
      'Plan progress',
      `${t.plan.done}/${t.plan.total}`,
      h(
        'div',
        { class: 'tl sm' },
        parts.map(([k, c]) =>
          t.plan[k] ? h('span', { class: `seg ${c}`, style: `flex:${t.plan[k] / total}` }) : null,
        ),
      ),
      h(
        'div',
        { class: 'legend' },
        parts.map(([k]) => h('span', null, `${k} ${t.plan[k]}`)),
      ),
    ),
    t.items.length
      ? card(
          'Items',
          `${t.items.length}`,
          h(
            'div',
            { class: 'tbl' },
            t.items.map((i) =>
              h(
                'div',
                { class: 'row', style: 'grid-template-columns:28px 60px minmax(0,1fr) 80px' },
                h('span', { class: 'chk' + (i.status === 'done' ? ' on' : '') }),
                h('span', { class: 't-id' }, i.id),
                h('span', { class: 't-m' }, i.text),
                h(
                  'span',
                  { class: `pill ${{ done: 'l', blocked: 'p', doing: 'w' }[i.status] ?? 'c'}` },
                  i.status,
                ),
              ),
            ),
          ),
        )
      : note('This task is not the active wf task, so only the branch is known.'),
  ];
}

function pauses(t) {
  const c = t.capture;
  if (!c.sessions)
    return [
      card(
        'Pauses & flow',
        null,
        note(
          'No recorded sessions yet. Capture starts with the next Claude session after the recorder hooks are active.',
        ),
      ),
    ];
  return [
    h(
      'div',
      { class: 'kpis' },
      kpi('Sessions', String(c.sessions), 'recorded'),
      kpi('Prompts', String(c.prompts), 'from the owner'),
      kpi('Stops', String(c.stops), 'turn ends'),
      kpi('Without result', String(c.unforced), 'open items left'),
      kpi('Nudges', String(c.nudges), 'prompt right after'),
    ),
    card(
      'Activity',
      c.lastTs ? `last event ${ago(Date.now() - c.lastTs)}` : null,
      h('div', { class: 't-m' }, `${c.tools} tool calls · ${c.compactions} compactions`),
    ),
  ];
}

/** The document open in the viewer (module state so the poll re-render keeps it); text is fetched once per open. */
let openDoc = null;
function openDocument(t, d, rerender) {
  openDoc = { task: t.id, dir: d.dir, name: d.name, text: null, failed: false };
  rerender();
  const q = new URLSearchParams({ task: t.id, dir: d.dir, name: d.name });
  fetch(`/api/doc?${q}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error('doc'))))
    .then((text) => {
      if (openDoc && openDoc.name === d.name) openDoc.text = text;
    })
    .catch(() => {
      if (openDoc && openDoc.name === d.name) openDoc.failed = true;
    })
    .finally(rerender);
}

function docs(t, rerender) {
  if (openDoc && openDoc.task === t.id) {
    const o = openDoc;
    return [
      card(
        o.name,
        o.dir,
        h(
          'button',
          {
            class: 'tab md-back',
            type: 'button',
            on: {
              click: () => {
                openDoc = null;
                rerender();
              },
            },
          },
          '← All documents',
        ),
        o.failed
          ? note('This document could not be read.')
          : o.text === null
            ? note('Loading…')
            : h('div', { class: 'md' }, renderMd(o.text)),
      ),
    ];
  }
  const designs = t.designs ?? [];
  const cards = [];
  if (!t.docs.length)
    cards.push(
      card(
        'Spike → Plan',
        null,
        note('No spike, design, risk or plan documents found for this task.'),
      ),
    );
  else
    cards.push(
      card(
        'Spike → Plan',
        `${t.docs.length} documents`,
        h(
          'div',
          { class: 'tbl' },
          t.docs.map((d) =>
            h(
              'div',
              {
                class: 'row is-link',
                role: 'button',
                tabindex: '0',
                style: 'grid-template-columns:90px minmax(0,1fr) 70px',
                on: {
                  click: () => openDocument(t, d, rerender),
                  keydown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDocument(t, d, rerender);
                    }
                  },
                },
              },
              h('span', { class: 'pill n' }, d.kind),
              h('span', { class: 't-mono' }, d.name),
              h('span', { class: 't-m' }, d.dir),
            ),
          ),
        ),
      ),
    );
  cards.push(
    card(
      'Designs',
      designs.length ? `${designs.length} canvases` : null,
      designs.length
        ? h(
            'div',
            { class: 'tbl' },
            designs.map((d) =>
              h(
                'a',
                {
                  class: 'row is-link',
                  href: `https://claude.ai/artifact/${d.id}`,
                  target: '_blank',
                  rel: 'noreferrer',
                  style: 'grid-template-columns:90px minmax(0,1fr) 70px',
                },
                h('span', { class: 'pill n' }, 'canvas'),
                h('span', { class: 't-mono' }, d.id.slice(0, 8)),
                h('span', { class: 't-m' }, 'open ↗'),
              ),
            ),
          )
        : note('No design canvas is linked in this task\u2019s spec or plan documents.'),
    ),
  );
  return cards;
}

function risks(t) {
  const r = t.risks;
  if (!r.total) return [card('Risks', null, note('No risk register found for this task.'))];
  return [
    h(
      'div',
      { class: 'kpis' },
      kpi('Risks', String(r.total), 'in the register'),
      kpi('High impact', String(r.high), 'need a proof'),
      kpi('Medium', String(r.medium), 'impact'),
      kpi('Low', String(r.low), 'impact'),
    ),
    note('Open versus closed is tracked in the close-out document, not parsed here yet.'),
  ];
}

function rules(snap) {
  return [
    card(
      'Rules & DoD',
      `${snap.rules.length} rule files`,
      h(
        'div',
        { class: 'steps' },
        snap.rules.map((r) => h('span', { class: 'step done' }, r)),
      ),
    ),
  ];
}

function runs(t) {
  const c = t.capture;
  const tools = Object.entries(c.byTool).sort((a, b) => b[1] - a[1]);
  if (!tools.length)
    return [
      card(
        'Runs',
        null,
        note(
          'No tool calls recorded yet. They appear once the recorder hooks have run in a session.',
        ),
      ),
    ];
  const max = tools[0][1];
  const hours = Object.entries(c.byHour)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-24);
  const hmax = Math.max(1, ...hours.map((x) => x[1]));
  return [
    h(
      'div',
      { class: 'grid2' },
      card(
        'Tool calls',
        `${c.tools} total`,
        h(
          'div',
          { class: 'tbl' },
          tools
            .slice(0, 12)
            .map(([name, n]) =>
              h(
                'div',
                { class: 'row', style: 'grid-template-columns:130px minmax(0,1fr) 60px' },
                h('span', { class: 't-id' }, name),
                h(
                  'span',
                  { class: 'meter' },
                  h('i', { style: `width:${Math.round((n / max) * 100)}%;background:var(--ind)` }),
                ),
                h('span', { class: 't-m' }, String(n)),
              ),
            ),
        ),
      ),
      card(
        'Activity by hour',
        'last 24 active hours',
        h(
          'div',
          { class: 'hist' },
          hours.map(([hour, n]) =>
            h('i', {
              title: `${hour}:00 · ${n}`,
              style: `height:${Math.max(6, Math.round((n / hmax) * 100))}%;background:var(--lime)`,
            }),
          ),
        ),
        h(
          'div',
          { class: 'hl' },
          h('span', null, hours[0] ? hours[0][0].slice(5, 13).replace('T', ' ') : ''),
          h(
            'span',
            null,
            hours.length ? hours[hours.length - 1][0].slice(5, 13).replace('T', ' ') : '',
          ),
        ),
      ),
    ),
  ];
}

function ci(snap) {
  if (!snap.ci.length)
    return [
      card(
        'CI',
        'main',
        note(
          'No CI data: the GitHub CLI (gh) is not available on this machine or has no access. Install and sign in to gh to see runs here.',
        ),
      ),
    ];
  return [
    card(
      'CI · main',
      `${snap.ci.length} latest runs`,
      h(
        'div',
        { class: 'tbl' },
        snap.ci.map((r) =>
          h(
            'div',
            { class: 'row', style: 'grid-template-columns:minmax(0,1fr) 90px 80px 70px' },
            h('span', { class: 't-m' }, r.name),
            h(
              'span',
              {
                class:
                  'pill ' + (r.status === 'success' ? 'l' : r.status === 'failure' ? 's' : 'c'),
              },
              r.status,
            ),
            h('span', { class: 't-mono' }, r.sha),
            h(
              'span',
              { class: 't-m' },
              r.sec === null ? '' : `${Math.floor(r.sec / 60)}m ${r.sec % 60}s`,
            ),
          ),
        ),
      ),
    ),
  ];
}

function release(snap, t) {
  const waiting = t.source === 'ready';
  return [
    h(
      'div',
      { class: 'kpis' },
      kpi('Unpushed commits', String(snap.release.unpushed), 'on main, waiting for cpd'),
      kpi('Branch', waiting ? 'ready' : 'none', t.branch ?? 'no ready-for-cpd branch'),
      kpi(
        'Deployed to prod',
        snap.release.deployed.includes(t.id) ? 'yes' : 'no',
        'marked by dash-close',
      ),
    ),
    note(
      'Linear status and release notes need the Linear key (wf item B); nothing is pushed or deployed without the owner saying cpd.',
    ),
  ];
}

function linearsync(t) {
  if (!t.linear)
    return [
      card(
        'Linear sync',
        null,
        note(
          'No Linear data yet. It loads within a minute when a Linear key is present on this machine (environment or .claude/settings.local.json).',
        ),
      ),
    ];
  const s = t.linear.syncedSecAgo;
  return [
    h(
      'div',
      { class: 'kpis' },
      kpi('Linear status', t.linear.state, 'as seen now'),
      kpi('Progress comment', s === null ? 'none' : ago(s * 1000), 'last wf sync'),
      kpi('Open in Linear', '↗', 'issue page'),
    ),
    h(
      'p',
      { class: 'empty-note' },
      h(
        'a',
        { href: `https://linear.app/issue/${t.id}`, target: '_blank', rel: 'noreferrer' },
        `Open ${t.id} in Linear`,
      ),
    ),
  ];
}

function quality(snap) {
  if (!snap.jobs.length)
    return [
      card(
        'Quality',
        'latest CI on main',
        note('No gate data: needs the GitHub CLI (gh) on this machine.'),
      ),
    ];
  const bad = snap.jobs.filter((j) => j.status !== 'success' && j.status !== 'skipped').length;
  return [
    card(
      'Quality gates',
      `${snap.jobs.length} jobs · ${bad} not green`,
      h(
        'div',
        { class: 'tbl' },
        snap.jobs.map((j) =>
          h(
            'div',
            { class: 'row', style: 'grid-template-columns:minmax(0,1fr) 100px 80px' },
            h('span', { class: 't-m' }, j.name),
            h(
              'span',
              {
                class:
                  'pill ' + (j.status === 'success' ? 'l' : j.status === 'failure' ? 's' : 'c'),
              },
              j.status,
            ),
            h(
              'span',
              { class: 't-m' },
              j.sec === null ? '' : `${Math.floor(j.sec / 60)}m ${j.sec % 60}s`,
            ),
          ),
        ),
      ),
    ),
  ];
}

const PENDING = {};

export function taskView(t, tab, selectTab, snap) {
  const body =
    tab === 'overview'
      ? overview(t)
      : tab === 'plan'
        ? plan(t)
        : tab === 'pauses'
          ? pauses(t)
          : tab === 'docs'
            ? docs(t, () => selectTab('docs'))
            : tab === 'runs'
              ? runs(t)
              : tab === 'quality'
                ? quality(snap)
                : tab === 'linearsync'
                  ? linearsync(t)
                  : tab === 'ci'
                    ? ci(snap)
                    : tab === 'release'
                      ? release(snap, t)
                      : tab === 'risks'
                        ? risks(t)
                        : tab === 'rules'
                          ? rules(snap)
                          : [card(PENDING[tab][0], 'not collected yet', note(PENDING[tab][1]))];
  return [
    h(
      'div',
      { class: 'hd' },
      h(
        'div',
        null,
        h('h1', null, t.id),
        h(
          'div',
          { class: 'sub' },
          h(
            'span',
            { class: 'pill ' + (t.source === 'ready' ? 'p' : 'w') },
            t.source === 'ready' ? 'waiting for cpd' : 'in work',
          ),
          t.branch ? h('span', { class: 't-mono' }, t.branch) : null,
        ),
      ),
    ),
    h(
      'div',
      { class: 'tabs', role: 'tablist' },
      TABS.map(([id, label]) =>
        h(
          'button',
          {
            class: 'tab' + (id === tab ? ' on' : ''),
            role: 'tab',
            'aria-selected': id === tab,
            on: { click: () => selectTab(id) },
          },
          label,
        ),
      ),
    ),
    ...body,
  ];
}
