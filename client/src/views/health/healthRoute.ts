/* Health overlay: its shape and its #/health/... hash (pure). Leaf module: App.tsx imports it. */
import type { HealthFormSpec } from '../../health';
import type { Injury, RestPeriod } from '../../types';

export type HealthOverlay = {
  screen: 'health';
  view?: 'history';
  hist?: 'list' | 'timeline';
  form?: HealthFormSpec;
  /** A long-term condition page: 'new' or a condition id; `condKey` = the picked catalogue entry. */
  cond?: string;
  condKey?: string;
  /** Nicotine pages (hub, What I use, Use in calculations). */
  nic?: 'hub' | 'products' | 'calc';
  /** Alcohol pages (hub, What I drink, Usual days, Use in calculations). */
  alc?: 'hub' | 'products' | 'days' | 'calc';
  /** Supplements pages (hub, What I take, Use in calculations). */
  sup?: 'hub' | 'products' | 'calc';
  /** Cycle pages (hub, settings). */
  cyc?: 'hub' | 'settings' | 'patterns';
  /** Health › Privacy and sharing. */
  priv?: boolean;
};

/** Health hash: #/health, then optionally /history (+ /timeline), then a form:
 *  /new/{ctx}/{type}, /edit/{periodId} or /injury/{injuryId}. */
export function healthHash(o: HealthOverlay): string {
  const parts = ['#/health'];
  if (o.view === 'history') {
    parts.push('history');
    if (o.hist === 'timeline' && !o.form) parts.push('timeline');
  }
  const f = o.form;
  if (f?.kind === 'new') parts.push('new', f.ctx, f.type);
  else if (f?.kind === 'edit') parts.push('edit', encodeURIComponent(f.periodId));
  else if (f?.kind === 'edit-injury') parts.push('injury', encodeURIComponent(f.injuryId));
  if (o.cond) {
    parts.push('cond', encodeURIComponent(o.cond));
    if (o.condKey) parts.push(encodeURIComponent(o.condKey));
  }
  if (o.nic) {
    parts.push('nicotine');
    if (o.nic !== 'hub') parts.push(o.nic);
  }
  if (o.cyc) {
    parts.push('cycle');
    if (o.cyc !== 'hub') parts.push(o.cyc);
  }
  if (o.alc) {
    parts.push('alcohol');
    if (o.alc !== 'hub') parts.push(o.alc);
  }
  if (o.sup) {
    parts.push('supplements');
    if (o.sup !== 'hub') parts.push(o.sup);
  }
  if (o.priv) parts.push('privacy');
  return parts.join('/');
}

export function healthFromHash(rest: string[]): HealthOverlay {
  const o: HealthOverlay = { screen: 'health' };
  let i = 0;
  if (rest[i] === 'history') {
    o.view = 'history';
    i++;
    if (rest[i] === 'timeline') {
      o.hist = 'timeline';
      i++;
    }
  }
  const [k, a, b] = rest.slice(i);
  const types = ['off', 'active', 'illness', 'injury'] as const;
  if (k === 'new' && (a === 'start' || a === 'past') && types.includes(b as (typeof types)[number]))
    o.form = { kind: 'new', ctx: a, type: b as (typeof types)[number] };
  else if (k === 'edit' && a) o.form = { kind: 'edit', periodId: decodeURIComponent(a) };
  else if (k === 'injury' && a) o.form = { kind: 'edit-injury', injuryId: decodeURIComponent(a) };
  else if (k === 'cond' && a) {
    o.cond = decodeURIComponent(a);
    if (b) o.condKey = decodeURIComponent(b);
  } else if (k === 'nicotine') {
    // The old #/health/nicotine/privacy page now lives in Health › Privacy and sharing.
    if (a === 'privacy') o.priv = true;
    else o.nic = a === 'products' || a === 'calc' ? a : 'hub';
  } else if (k === 'cycle') {
    o.cyc = a === 'settings' || a === 'patterns' ? a : 'hub';
  } else if (k === 'alcohol') {
    o.alc = a === 'products' || a === 'days' || a === 'calc' ? a : 'hub';
  } else if (k === 'supplements') {
    o.sup = a === 'products' || a === 'calc' ? a : 'hub';
  } else if (k === 'privacy') {
    o.priv = true;
  }
  return o;
}

/** A form for a period / injury that no longer exists (deleted elsewhere, a stale link) is not shown. */
export function formExists(
  form: HealthFormSpec | undefined,
  periods: readonly RestPeriod[],
  injuries: readonly Injury[],
): boolean {
  if (!form) return false;
  if (form.kind === 'edit') return periods.some((p) => p.id === form.periodId);
  if (form.kind === 'edit-injury') return injuries.some((i) => i.id === form.injuryId);
  return true;
}

/** The form edits or starts an injury (its own consent, SPO-290). */
export const isInjuryForm = (form: HealthFormSpec | undefined): boolean =>
  form?.kind === 'edit-injury' || (form?.kind === 'new' && form.type === 'injury');
