import { useCallback, useEffect, useState } from 'react';
import { currentHash, pushHash, replaceHash } from '../../route';

/**
 * The schedule's view state lives in the hash query (`#/c/schedule?view=day&d=20733&open=<slot>&form=move`), so a
 * refresh, Back and a shared link restore it, and other screens deep-link to the forms
 * (`?form=pick&client=c1` = the reschedule form with "which session?" for that client). Path handling stays in
 * `routes.ts`, which ignores the query.
 */
export type ScheduleView = 'week' | 'day' | 'month';
export type ScheduleForm = 'plan' | 'oneoff' | 'move' | 'pick' | 'counter' | 'settings';

export interface ScheduleParams {
  view: ScheduleView;
  /** the day shown (day key); null = today */
  d: number | null;
  /** selected session id */
  open: string | null;
  form: ScheduleForm | null;
  /** form=move: the session; form=pick|plan|oneoff: preselected client */
  slot: string | null;
  client: string | null;
  /** form=counter: the request answered */
  req: string | null;
  /** filters */
  who: string | null;
  gym: string | null;
  /** legend filters: comma list of hidden kinds (`done,missed,overlap`), see `legend.ts`; null = all shown */
  hide: string | null;
  /** create-from-an-empty-slot form: `day.start[.dur]`, see `grid.ts` */
  create: string | null;
}

const EMPTY: ScheduleParams = {
  view: 'week',
  d: null,
  open: null,
  form: null,
  slot: null,
  client: null,
  req: null,
  who: null,
  gym: null,
  hide: null,
  create: null,
};
const VIEWS: readonly ScheduleView[] = ['week', 'day', 'month'];
const FORMS: readonly ScheduleForm[] = ['plan', 'oneoff', 'move', 'pick', 'counter', 'settings'];

export function readScheduleParams(hash: string): ScheduleParams {
  const q = hash.split('?')[1];
  if (!q) return EMPTY;
  const p = new URLSearchParams(q);
  const view = p.get('view') as ScheduleView;
  const form = p.get('form') as ScheduleForm;
  const d = Number(p.get('d'));
  return {
    view: VIEWS.includes(view) ? view : 'week',
    d: p.get('d') && Number.isFinite(d) ? d : null,
    open: p.get('open'),
    form: FORMS.includes(form) ? form : null,
    slot: p.get('slot'),
    client: p.get('client'),
    req: p.get('req'),
    who: p.get('who'),
    gym: p.get('gym'),
    hide: p.get('hide'),
    create: p.get('create'),
  };
}

export function writeScheduleParams(base: string, p: Partial<ScheduleParams>): string {
  const q = new URLSearchParams();
  if (p.view && p.view !== 'week') q.set('view', p.view);
  if (p.d != null) q.set('d', String(p.d));
  for (const k of [
    'open',
    'form',
    'slot',
    'client',
    'req',
    'who',
    'gym',
    'hide',
    'create',
  ] as const) {
    const v = p[k];
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export interface ScheduleParamsApi extends ScheduleParams {
  set(patch: Partial<ScheduleParams>, push?: boolean): void;
}

export function useScheduleParams(): ScheduleParamsApi {
  const [params, setParams] = useState<ScheduleParams>(() =>
    typeof window === 'undefined' ? EMPTY : readScheduleParams(currentHash()),
  );
  useEffect(() => {
    const on = () => setParams(readScheduleParams(currentHash()));
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  const set = useCallback((patch: Partial<ScheduleParams>, push = false) => {
    const next = { ...readScheduleParams(currentHash()), ...patch };
    const base = currentHash().split('?')[0] || '#/c/schedule';
    const hash = writeScheduleParams(base, next);
    setParams(next);
    try {
      if (push) pushHash(hash);
      else replaceHash(hash);
    } catch {
      /* history blocked: the screen state above still works */
    }
  }, []);
  return { ...params, set };
}

/** Hash for another screen to link here (Client 360 "Move a session", "Add sessions"). */
export const scheduleHref = (p: Partial<ScheduleParams>): string =>
  writeScheduleParams('#/c/schedule', p);
