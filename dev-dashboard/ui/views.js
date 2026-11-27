import { ago, h } from './dom.js';

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
    t.source === 'wf'
      ? note('Item texts and evidence arrive from the wf state in a later step; counts are live.')
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

const PENDING = {
  docs: [
    'Spike → Plan',
    'Spike, design, risk and plan documents are listed here once the collector reads docs/specs and docs/plans.',
  ],
  runs: [
    'Runs',
    'Command runs per task need the journal fields to be extended; not collected yet.',
  ],
  ci: ['CI', 'CI status needs the GitHub API; it arrives with the cpd workflow integration.'],
  quality: ['Quality', 'Gate results (lint, typecheck, tests) are not collected yet.'],
  risks: ['Risks', 'The risk register is read from docs/plans/SPO-N-*-risk.md in a later step.'],
  rules: ['Rules & DoD', 'Rule coverage is read from CLAUDE.md and .claude/rules in a later step.'],
  linearsync: ['Linear sync', 'Needs a Linear API key on the owner machine (wf item B).'],
  release: ['Release', 'Release state follows Linear status and the deployed marker (wf item B).'],
};

export function taskView(t, tab, selectTab) {
  const body =
    tab === 'overview'
      ? overview(t)
      : tab === 'plan'
        ? plan(t)
        : tab === 'pauses'
          ? pauses(t)
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
