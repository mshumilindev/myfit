import { ago, h } from './dom.js';
import { emptyState, overall, staleBanner, taskView } from './views.js';

const STALE_MS = 10 * 60 * 1000;
const state = { snap: null, error: false, lane: 'overall', tab: 'overview', fetchedAt: 0 };

const read = (k, d) => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: the choice just does not persist */
  }
};
let theme = read('dev-console-theme', 'dark') === 'light' ? 'light' : 'dark';

function lane(t, onSelect, cpd) {
  return h(
    'button',
    {
      class: `lane${cpd ? ' cpd' : ''}${state.lane === t.id ? ' on' : ''}`,
      on: { click: () => onSelect(t.id) },
    },
    h(
      'span',
      { class: 'lane-t' },
      h('span', { class: `led ${cpd ? 'p' : 'w'}` }),
      h('span', { class: 'lane-id' }, t.id),
    ),
    h(
      'span',
      { class: 'lane-p' },
      h('span', { class: 'bar' }, h('i', { style: `width:${t.plan.pct}%` })),
      h('span', { class: 'lane-pc' }, `${t.plan.pct}%`),
    ),
  );
}

function render() {
  const root = document.getElementById('root');
  const snap = state.snap;
  const tasks = snap?.tasks ?? [];
  if (state.lane !== 'overall' && !tasks.some((t) => t.id === state.lane)) state.lane = 'overall'; // a closed task's tab disappears
  const select = (id) => {
    state.lane = id;
    state.tab = 'overview';
    render();
  };
  const cpd = tasks.filter((t) => t.source === 'ready');
  const work = tasks.filter((t) => t.source !== 'ready');
  const age = snap ? Date.now() - snap.generatedAt : null;
  const stale = state.error || (age !== null && age > STALE_MS);

  const rail = h(
    'nav',
    { class: 'rail', 'aria-label': 'Lanes' },
    h(
      'button',
      {
        class: 'lane' + (state.lane === 'overall' ? ' on' : ''),
        on: { click: () => select('overall') },
      },
      h(
        'span',
        { class: 'lane-t' },
        h('span', { class: 'led o' }),
        h('span', { class: 'lane-id' }, 'Σ Overall'),
      ),
    ),
    h(
      'div',
      { class: 'rail-h amb' },
      h('span', null, 'Waiting for cpd'),
      h('span', null, cpd.length),
    ),
    cpd.map((t) => lane(t, select, true)),
    h('div', { class: 'rail-h' }, h('span', null, 'In work'), h('span', null, work.length)),
    work.map((t) => lane(t, select, false)),
    h('span', { class: 'grow' }),
    h(
      'p',
      { class: 'sk', style: 'padding:14px 12px 0' },
      'A tab closes itself once its task is Deployed to prod and its branch is deleted.',
    ),
  );

  let main;
  if (!snap)
    main = [
      state.error
        ? staleBanner('No data from the local collector. Is it running?')
        : h('p', { class: 't-m' }, 'Loading…'),
    ];
  else if (tasks.length === 0)
    main = [stale ? staleBanner(`Data is ${ago(age)}.`) : null, emptyState(snap)];
  else if (state.lane === 'overall')
    main = [stale ? staleBanner(`Data is ${ago(age)}.`) : null, ...overall(snap, select)];
  else
    main = [
      stale ? staleBanner(`Data is ${ago(age)}.`) : null,
      ...taskView(
        tasks.find((t) => t.id === state.lane),
        state.tab,
        (tab) => {
          state.tab = tab;
          render();
        },
        snap,
      ),
    ];

  root.replaceChildren(
    h(
      'div',
      { class: `app ${theme === 'light' ? 'light' : ''}` },
      h(
        'header',
        { class: 'top' },
        h('div', { class: 'logo', 'aria-hidden': 'true' }, '>_'),
        h('div', { class: 'brand' }, 'SPOTTER', h('i', null, '//'), 'DEV'),
        h('span', { class: 'chip' }, 'DEV CONSOLE'),
        h('span', { class: 'grow' }),
        h('span', { class: 'chip' }, `${location.host} · read-only`),
        h(
          'span',
          { class: 'chip' },
          h('span', { class: 'pulse' }),
          snap ? `synced ${ago(age)}` : 'not synced',
        ),
        h(
          'button',
          {
            class: 'btn',
            'aria-label': 'Switch theme',
            on: {
              click: () => {
                theme = theme === 'dark' ? 'light' : 'dark';
                write('dev-console-theme', theme);
                render();
              },
            },
          },
          theme === 'dark' ? 'Light theme' : 'Dark theme',
        ),
      ),
      h('div', { class: 'shell' }, rail, h('main', { class: 'mainc' }, main)),
    ),
  );
  document.body.style.background = theme === 'light' ? '#F3F5F8' : '#101318';
}

async function poll() {
  try {
    const res = await fetch('/api/snapshot', { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    state.snap = data;
    state.error = false;
  } catch {
    state.error = true;
  }
  render();
}

render();
poll();
setInterval(poll, 5000);
