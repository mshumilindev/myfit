import { useCallback, useEffect, useState } from 'react';

/**
 * The Agenda's view state lives in the hash query (`#/c/agenda?view=stage&open=<key>&decision=<key>&option=<id>`),
 * so a refresh, Back and a shared link restore it (plan S-01 "URL ?open="). Path handling stays in
 * `routes.ts` (it ignores the query); this hook only reads and writes the query part.
 */
export type TodayView = 'priority' | 'stage';

export interface TodayParams {
  view: TodayView;
  /** selected card (signal key) on Today */
  open: string | null;
  /** signal key of the Decision screen, when it is shown */
  decision: string | null;
  /** option preselected on the Decision screen */
  option: string | null;
}

const EMPTY: TodayParams = { view: 'priority', open: null, decision: null, option: null };

export function readParams(hash: string): TodayParams {
  const q = hash.split('?')[1];
  if (!q) return EMPTY;
  const p = new URLSearchParams(q);
  return {
    view: p.get('view') === 'stage' ? 'stage' : 'priority',
    open: p.get('open'),
    decision: p.get('decision'),
    option: p.get('option'),
  };
}

export function writeParams(base: string, p: Partial<TodayParams>): string {
  const q = new URLSearchParams();
  if (p.view === 'stage') q.set('view', 'stage');
  if (p.open) q.set('open', p.open);
  if (p.decision) q.set('decision', p.decision);
  if (p.option) q.set('option', p.option);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export interface TodayParamsApi extends TodayParams {
  /** `push` adds a history entry (Back returns); default replaces it. */
  set(patch: Partial<TodayParams>, push?: boolean): void;
}

export function useTodayParams(): TodayParamsApi {
  const [params, setParams] = useState<TodayParams>(() =>
    typeof window === 'undefined' ? EMPTY : readParams(window.location.hash),
  );

  useEffect(() => {
    const on = () => setParams(readParams(window.location.hash));
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);

  const set = useCallback((patch: Partial<TodayParams>, push = false) => {
    const next = { ...readParams(window.location.hash), ...patch };
    const base = window.location.hash.split('?')[0] || '#/c/agenda';
    const hash = writeParams(base, next);
    setParams(next);
    try {
      if (push) window.history.pushState(null, '', hash);
      else window.history.replaceState(null, '', hash);
    } catch {
      /* history blocked: the screen state above still works */
    }
  }, []);

  return { ...params, set };
}
