/**
 * Clause segmentation: cut at punctuation, coordinators, subordinators and
 * embedded wh-words; split two predicates without a connector (asyndeton,
 * "I think I overtrained", "sore is that normal"); then merge segments that are
 * not clauses (no predicate, VP coordination sharing a subject, tags).
 */
import { INTRANS, type LangSpec, type T } from './core';
import type { ClauseKind, Lang } from './types';

export interface Seg {
  idx: number[];
  /** Connector token index (sub / coord / wh / particle) opening the segment. */
  lead?: number;
  how: 'start' | 'punct' | 'coord' | 'sub' | 'wh' | 'qp' | 'corr' | 'asyn' | 'rel';
  role: 'main' | 'subordinate' | 'coordinate';
  kind?: ClauseKind;
  /** Segment is a trailing tag ("…, right?"). */
  tag?: boolean;
}

const CUT_PUNCT = /^[,;:()–—-]$|^\.{2,}$|^…$/;

export function content(ts: T[], idx: number[]): T[] {
  return idx.map((i) => ts[i]).filter((t) => t.kind === 'w' || t.kind === 'n');
}

/** Finite verb / imperative / predicative (a predicate unit start). */
export function isFin(t: T): boolean {
  if (t.x.cont) return false;
  if (t.pos === 'VERB' || t.pos === 'AUX') return t.feats.form === 'fin' || t.feats.form === 'imp';
  return false;
}

const isModalPred = (t: T): boolean => !!t.x.predic && t.x.predic !== 'eval' && !t.x.cont;

/** Lightweight predicate test for a segment (used before full parsing). */
export function segPred(ts: T[], idx: number[], spec: LangSpec): { pred: boolean; fin: number[] } {
  const c = content(ts, idx);
  const evalUnit = (t: T): boolean => {
    if (t.x.predic !== 'eval') return false;
    const pv = ts[t.i - 1];
    const pp = ts[t.i - 2];
    const objVerb = (v: T | undefined): boolean =>
      !!v &&
      v.pos === 'VERB' &&
      (v.feats.person === 1 ||
        v.feats.person === 2 ||
        v.feats.form === 'imp' ||
        v.feats.form === 'inf');
    if (pv && /^(це|то|это|to|tai|see)$/.test(pv.lk) && !objVerb(pp)) return true;
    // "…присід 100 на 5 нормально чи ні": a final evaluation not attached to a verb
    const n = ts[t.i + 1];
    const p = ts[t.i - 1];
    const end = !n || n.kind === 'p' || !!n.x.orNot;
    // "robię to źle": an object pronoun after a verb, not an evaluation unit
    if (p && (p.pos === 'DET' || p.pos === 'PRON') && objVerb(pp)) return false;
    return end && !!p && p.pos !== 'VERB' && p.pos !== 'AUX' && p.pos !== 'ADV' && !p.x.neg;
  };
  const fin = c
    .filter((t) => isFin(t) || (spec.lang !== 'en' && (isModalPred(t) || evalUnit(t))))
    .map((t) => t.i);
  if (fin.length) return { pred: true, fin };
  if (c.some(isModalPred)) return { pred: true, fin: c.filter(isModalPred).map((t) => t.i) };
  if (spec.lang === 'en') {
    // "why not commenting…", "how to squat": non-finite verb after a wh-word.
    const hasWh = c.some((t) => t.x.wh);
    if (hasWh && c.some((t) => t.pos === 'VERB')) return { pred: true, fin: [] };
    // "whether to cut or bulk": a subordinator-led infinitive clause
    if (c[0] && c[0].pos === 'SCONJ' && c[0].norm === 'whether' && c.some((t) => t.pos === 'VERB'))
      return { pred: true, fin: [] };
    return { pred: false, fin: [] };
  }
  if (c.some((t) => t.x.predic === 'eval'))
    return { pred: true, fin: c.filter((t) => t.x.predic === 'eval').map((t) => t.i) };
  if (c.some((t) => t.pos === 'VERB' && t.feats.form === 'inf')) return { pred: true, fin: [] };
  if (zeroCopula(c, spec) >= 0) return { pred: true, fin: [] };
  if (
    c.some((t) => t.x.poss) &&
    c.some((t) => (t.pos === 'NOUN' && spec.nomCapable(t)) || t.pos === 'NUM')
  )
    return { pred: true, fin: [] };
  // nominal predicate with zero copula: "ти тренер"
  const pk = c.findIndex((t) => t.pos === 'PRON' && !!t.x.pron && t.feats.case === 'nom');
  if (pk >= 0 && c[pk + 1] && c[pk + 1].pos === 'NOUN' && spec.nomCapable(c[pk + 1]))
    return { pred: true, fin: [] };
  return { pred: false, fin: [] };
}

/** Index (token.i) of a predicative adjective in a verbless clause, else -1. */
export function zeroCopula(c: T[], spec: LangSpec): number {
  for (let k = 0; k < c.length; k++) {
    const t = c[k];
    if (t.pos !== 'ADJ' || t.x.wh || t.x.attr) continue;
    if (t.feats.case && t.feats.case !== 'nom') continue;
    if (t.feats.form === 'pred') return t.i; // short form: потрібен, певен
    const n = c[k + 1];
    const p = c[k - 1];
    if (p && p.pos === 'ADP') continue;
    if (p && p.pos === 'PRON' && p.x.pron && p.feats.case !== 'dat' && p.feats.case !== 'gen')
      return t.i; // ти найкращий
    const attrib =
      n &&
      (n.pos === 'NOUN' || (n.pos === 'ADJ' && c[k + 2]?.pos === 'NOUN')) &&
      spec.nomCapable(n) &&
      (!t.feats.number || !n.feats.number || t.feats.number === n.feats.number);
    if (attrib) continue;
    // "czy to normalne", "це нормальне": demonstrative subject + predicative adjective
    if (p && /^(to|це|это|tai|see)$/.test(p.lk) && (!n || n.pos !== 'NOUN')) return t.i;
    if (p && p.pos === 'DET' && !p.x.wh) continue;
    return t.i;
  }
  return -1;
}

function hasSubject(ts: T[], idx: number[], spec: LangSpec, fin: number[]): boolean {
  const c = content(ts, idx);
  if (spec.lang === 'en') {
    const f = fin[0];
    if (f === undefined) return false;
    // subject before the first finite, or right after an initial aux (inversion)
    const before = c.filter((t) => t.i < f);
    if (before.some((t) => spec.nomCapable(t) && !t.x.disc && t.pos !== 'ADP')) return true;
    const ft = ts[f];
    const nx = c.find((t) => t.i > f);
    if (ft.pos === 'AUX' && nx && spec.nomCapable(nx)) return true;
    return false;
  }
  const f0 = fin.map((i) => ts[i]).find((v) => v.pos === 'VERB' || v.pos === 'AUX');
  if (
    !f0 &&
    !c.some((t) => !!t.x.predic) &&
    zeroCopula(c, spec) < 0 &&
    c.some((t) => t.pos === 'VERB' && t.feats.form === 'inf')
  )
    return false;
  const postOk =
    !f0 ||
    (f0.feats.tense === 'present' && f0.feats.person === 3) ||
    /(ся|сь)$/.test(f0.norm) ||
    !!f0.x.cop ||
    INTRANS.test(f0.lemma);
  return c.some((t, k) => {
    if (t.mx.time) return false;
    if (
      t.pos === 'PRON' &&
      (t.feats.case === 'nom' || !t.feats.case) &&
      !t.x.wh &&
      (t.x.pron || spec.nomCapable(t))
    )
      return true;
    if (
      t.pos === 'NOUN' &&
      t.feats.case === 'nom' &&
      c[k - 1]?.pos !== 'ADP' &&
      c[k - 1]?.pos !== 'NUM' &&
      !(
        t.x.unit &&
        /^(h|min|sec|day|week|month|year)$/.test(t.x.unit) &&
        (c[k - 1]?.pos === 'ADJ' || c[k - 1]?.pos === 'DET')
      )
    ) {
      if (f0 && t.i > f0.i && !postOk) return false;
      // agreement with the finite verb, when known
      if (!f0) return true;
      if (f0.feats.person && f0.feats.person !== 3) return false;
      if (f0.feats.number && t.feats.number && f0.feats.number !== t.feats.number) return false;
      return true;
    }
    return false;
  });
}

/** Can a pro-drop predicate share the previous clause's subject? */
function compatible(a: T | undefined, b: T | undefined): boolean {
  if (!a || !b) return true;
  if (a.x.predic || b.x.predic) return false;
  if (b.feats.form === 'imp' || a.feats.form === 'imp') return a.feats.form === b.feats.form;
  const pa = a.feats.person;
  const pb = b.feats.person;
  if (a.x.impers || b.x.impers) return false;
  if (a.feats.gender === 'n' || b.feats.gender === 'n') return a.feats.gender === b.feats.gender;
  if (pa && pb)
    return pa === pb && (!a.feats.number || !b.feats.number || a.feats.number === b.feats.number);
  // past (no person) vs present: sg past is compatible with 1/2/3 sg
  const p = pa ?? pb;
  const num = (a.feats.number ?? 'sg') === (b.feats.number ?? 'sg');
  if (!num) return false;
  if (p === 3) return false; // past + 3rd-person present: different subject in chat ("пробіг а болить")
  return true;
}

const SUBJ_ADV_EN =
  /^(usually|always|never|just|also|still|only|really|even|already|often|sometimes|rarely|actually|honestly|probably|constantly|ever)$/;

/** Start index of the subject NP right before a finite token (English), or -1. */
/** Token of a time expression (also a continuation word of a time MWE: "last [week]"). */
function isTimeTok(ts: T[], t: T): boolean {
  let k = t.i;
  while (k > 0 && ts[k].x.cont) k--;
  return !!(ts[k].x.time || ts[k].mx.time);
}

function npBefore(ts: T[], f: number, from: number): number {
  let k = f - 1;
  while (k >= from && ts[k].pos === 'ADV' && SUBJ_ADV_EN.test(ts[k].norm)) k--;
  if (k < from) return -1;
  const h = ts[k];
  const isHead =
    (h.pos === 'PRON' && h.x.pron?.c !== 'acc' && h.norm !== 'me') ||
    h.pos === 'NOUN' ||
    (h.pos === 'VERB' && h.x.vf === 'ing');
  if (!isHead) return -1;
  let s = k;
  if (h.pos !== 'PRON') {
    while (
      s - 1 >= from &&
      ts[s].pos !== 'DET' &&
      ['DET', 'ADJ', 'NOUN', 'NUM'].includes(ts[s - 1].pos) &&
      !ts[s - 1].x.time &&
      !(ts[s - 1].pos === 'NOUN' && ts[s - 2]?.pos === 'VERB') &&
      !(ts[s - 1].pos === 'ADJ' && (ts[s - 2]?.lemma === 'be' || ts[s - 2]?.x.neg))
    )
      s--;
    if (s - 1 >= from && ts[s - 1].norm === "'s") s -= 2;
    while (s - 1 >= from && ts[s].pos !== 'DET' && ['DET', 'NUM'].includes(ts[s - 1].pos)) s--;
    // "five days a week": a rate phrase is one NP
    if (/^(a|an|per)$/.test(ts[s].norm) && s - 1 >= from && ts[s - 1].x.unit) {
      let q = s - 1;
      while (q - 1 >= from && (ts[q - 1].pos === 'NUM' || ts[q - 1].pos === 'ADJ')) q--;
      if (ts[q].pos === 'NUM') s = q;
    }
  }
  return s;
}

/** Slavic & co: start of the second clause before finite token f (time adverb / agreeing NP). */
function freeSplitBefore(ts: T[], f: number, from: number, spec: LangSpec): number {
  let k = f - 1;
  let s = f;
  const v = ts[f];
  while (k >= from) {
    const t = ts[k];
    if (t.x.neg || t.x.qp) {
      s = k;
      k--;
      continue;
    }
    if (
      t.pos === 'ADV' &&
      (t.x.time || t.x.sem === 'degree' || t.x.sem === 'frequency' || t.x.predic)
    ) {
      s = k;
      k--;
      continue;
    }
    if (
      t.pos === 'PRON' &&
      (t.feats.case === 'nom' || t.feats.case === 'dat' || !t.feats.case) &&
      !t.x.wh
    ) {
      s = k;
      k--;
      continue;
    }
    if (
      (t.pos === 'NOUN' || t.pos === 'ADJ') &&
      spec.nomCapable(t) &&
      ts[k - 1]?.pos !== 'ADP' &&
      ts[k - 1]?.pos !== 'NUM'
    ) {
      const agree =
        !v.feats.number || !t.feats.number || v.feats.number === t.feats.number || !!v.x.predic;
      if (!agree) break;
      s = k;
      k--;
      continue;
    }
    break;
  }
  return s;
}

const COMPL_ADJ =
  /^(sure|normal|possible|true|likely|afraid|glad|happy|worried|aware|certain|okay|ok|fine|bad|good|weird|strange|впевнений|певен|певний|нормально|добре|погано|цікаво|важливо|уверен|нормально|pewien|pewna|tikras|kindel)$/;

const REL_HEAD =
  /^(reason|way|time|day|program|plan|exercise|thing|one|place|weight|food|workout|routine)$/;

function prevContent(ts: T[], i: number): T | undefined {
  for (let k = i - 1; k >= 0; k--) {
    const t = ts[k];
    if (t.x.neg || (t.pos === 'ADV' && t.x.sem === 'degree')) continue;
    // "поясни, будь ласка, чому…": politeness markers are transparent
    if (t.x.cont || t.x.please) continue;
    if (t.kind === 'w' || t.kind === 'n') return t;
  }
  return undefined;
}

function isCognLike(t: T | undefined, cogn: (t: T) => boolean): boolean {
  if (!t) return false;
  if (cogn(t)) return true;
  if (COMPL_ADJ.test(t.norm) || COMPL_ADJ.test(t.lemma)) return true;
  return false;
}

export interface SegCtx {
  spec: LangSpec;
  cogn: (t: T) => boolean;
  question: boolean;
}

export function segment(ts: T[], ctx: SegCtx): Seg[] {
  const { spec } = ctx;
  const lang: Lang = spec.lang;
  // 1. explicit cuts
  const segs: Seg[] = [];
  let cur: Seg = { idx: [], how: 'start', role: 'main' };
  const push = (): void => {
    if (cur.idx.length) segs.push(cur);
  };
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (
      t.kind === 'p' &&
      CUT_PUNCT.test(t.text) &&
      !t.x.cont &&
      !(
        t.text === '-' &&
        ts[i - 1] &&
        ts[i + 1] &&
        ts[i - 1].start + ts[i - 1].text.length === t.start
      )
    ) {
      cur.idx.push(i);
      push();
      cur = { idx: [], how: 'punct', role: 'main' };
      continue;
    }
    if (t.x.cont) {
      cur.idx.push(i);
      continue;
    }
    // a preposition right before a wh-word belongs to it: "з яким", "od czego", "nuo ko", "with whom"
    const lastIdx = cur.idx[cur.idx.length - 1];
    const trailAdp =
      !!t.x.wh && lastIdx !== undefined && ts[lastIdx].pos === 'ADP' && ts[lastIdx].kind === 'w';
    const first =
      content(
        ts,
        cur.idx.filter((k) => !(trailAdp && k === lastIdx)),
      ).filter((u) => !u.x.disc && !u.x.voc && !u.x.corr && u.pos !== 'INTJ').length === 0;
    const pcw0 = prevContent(ts, i);
    const pcw = pcw0 && pcw0.pos === 'ADP' ? prevContent(ts, pcw0.i) : pcw0;
    let how: Seg['how'] | null = null;
    if (t.pos === 'SCONJ' && t.x.sub) how = 'sub';
    else if (t.pos === 'CONJ' && t.x.coord) how = 'coord';
    else if (t.x.corr) how = t.norm === 'то' || first ? 'corr' : null;
    else if (t.x.qp && i > 0 && !t.x.orNot) how = 'qp';
    else if (t.x.wh && !t.x.cont) {
      if (t.pos !== 'DET') how = 'wh';
      else if (
        first ||
        (pcw &&
          (ctx.cogn(pcw) ||
            (pcw.pos === 'NOUN' && t.x.sub === 'relative') ||
            // "tell me which muscles…"
            (pcw.pos === 'PRON' &&
              !!pcw.x.pron &&
              pcw.feats.case !== 'nom' &&
              !!prevContent(ts, pcw.i) &&
              ctx.cogn(prevContent(ts, pcw.i) as T))))
      )
        how = 'wh';
    }
    if (how && !first) {
      if (how === 'wh' && trailAdp) {
        cur.idx.pop();
        push();
        cur = { idx: [lastIdx, i], lead: i, how, role: 'main' };
        continue;
      }
      push();
      cur = { idx: [i], lead: i, how, role: 'main' };
      continue;
    }
    if (how && first) {
      cur.lead = i;
      if (cur.how === 'punct') cur.how = how;
      else if (cur.how === 'start') cur.how = how === 'sub' || how === 'coord' ? how : 'start';
    }
    cur.idx.push(i);
  }
  push();

  // 2. asyndetic split of segments with two predicates
  const out: Seg[] = [];
  for (const s of segs) {
    let rest = s;
    for (let guard = 0; guard < 4; guard++) {
      const { fin } = segPred(ts, rest.idx, spec);
      const units = fin;
      if (units.length < 2) break;
      const from = rest.idx[0];
      const f2 = units[1];
      let cut = -1;
      let rel = false;
      const cr = lang === 'en' ? contactRel(rest, units) : null;
      if (cr) {
        out.push(...cr.push);
        rest = cr.rest;
        rel = true;
      } else if (lang === 'en') {
        const t2 = ts[f2];
        const nx = ts[f2 + 1];
        if (
          t2.pos === 'AUX' &&
          nx &&
          (spec.nomCapable(nx) || nx.pos === 'DET' || nx.pos === 'NUM') &&
          !(ts[f2 - 1] && spec.nomCapable(ts[f2 - 1]) && ts[f2 - 1].pos === 'PRON')
        )
          cut = f2;
        else {
          const np = npBefore(ts, f2, from);
          if (np > units[0]) cut = np;
          else if (np < 0) {
            // contact relative: "the program [you gave me] is too hard"
            const np1 = npBefore(ts, units[0], from);
            if (np1 > from && ts[np1].pos === 'PRON' && ts[np1 - 1]?.pos === 'NOUN') {
              const a: Seg = { ...rest, idx: rest.idx.filter((i) => i < np1) };
              const r: Seg = {
                idx: rest.idx.filter((i) => i >= np1 && i < f2),
                how: 'rel',
                role: 'subordinate',
                kind: 'relative',
              };
              const b: Seg = { idx: rest.idx.filter((i) => i >= f2), how: 'punct', role: 'main' };
              out.push(a, r);
              rest = b;
              rel = true;
            }
          }
        }
      } else {
        const t1 = ts[units[0]];
        const t2 = ts[f2];
        // homogeneous predicates without a connector (однорідні присудки) stay together
        const between = rest.idx.filter((i) => i > units[0] && i < f2).map((i) => ts[i]);
        const ownSubj = between.some(
          (t) =>
            (t.pos === 'PRON' && t.feats.case === 'nom') ||
            (t.pos === 'NOUN' && t.feats.case === 'nom'),
        );
        if (t1.x.hort) break;
        if ((t1.x.cop && t2.x.predic) || (t2.x.cop && t1.x.predic)) break;
        if (t1.x.modal || t1.x.aux) {
          if (!(t2.pos === 'VERB' && t2.feats.form === 'fin')) break;
        }
        if (compatible(t1, t2) && !ownSubj && !t2.x.predic) break;
        cut = freeSplitBefore(ts, f2, units[0] + 1, spec);
      }
      if (rel) continue;
      if (cut <= from) break;
      const a: Seg = { ...rest, idx: rest.idx.filter((i) => i < cut) };
      const b: Seg = { idx: rest.idx.filter((i) => i >= cut), how: 'asyn', role: 'main' };
      out.push(a);
      rest = b;
    }
    out.push(rest);
  }

  /**
   * English relative clauses without a comma: contact relatives ("the shoes [I bought] are…",
   * "a workout [I can do]", "the reason [my bench stalled] is…") and who/which/that relatives
   * whose main verb follows the relative ("my physio [who treated my shoulder] recommended…").
   */
  function contactRel(rest: Seg, units: number[]): { push: Seg[]; rest: Seg } | null {
    const from = rest.idx[0];
    const lead = rest.lead !== undefined ? ts[rest.lead] : undefined;
    // who / which / that relative after a noun: the second finite verb is the main clause's
    if (
      lead &&
      (rest.how === 'wh' || rest.how === 'sub') &&
      /^(who|which|that)$/.test(lead.norm) &&
      prevContent(ts, from)?.pos === 'NOUN' &&
      units.length >= 2 &&
      units[0] > lead.i &&
      ts.slice(lead.i + 1, units[0]).every((u) => u.pos === 'ADV' || !!u.x.neg || u.pos === 'AUX')
    ) {
      const f2 = units[1];
      const np = npBefore(ts, f2, from);
      if (np < 0 || np <= units[0] || ts[np].pos !== 'PRON') {
        return {
          push: [{ ...rest, idx: rest.idx.filter((i) => i < f2) }],
          rest: { idx: rest.idx.filter((i) => i >= f2), how: 'punct', role: 'main' },
        };
      }
    }
    for (let m = 0; m < units.length; m++) {
      const f = units[m];
      const sp = npBefore(ts, f, from);
      if (sp <= from) continue;
      const h = ts[sp - 1];
      const indefHead =
        !!h && h.pos === 'PRON' && /^(anything|something|everything|nothing|all)$/.test(h.norm);
      if (!h || (h.pos !== 'NOUN' && !indefHead) || isTimeTok(ts, h) || ts[sp - 2]?.pos === 'NUM')
        continue;
      const st = ts[sp];
      const pronSubj =
        st.pos === 'PRON' && !!st.x.pron && st.x.pron.c !== 'acc' && st.norm !== 'it';
      const relHead = REL_HEAD.test(h.lemma);
      if (!pronSubj && !(relHead && st.pos === 'DET')) continue;
      let hs = sp - 1;
      while (
        hs - 1 >= from &&
        ['DET', 'ADJ', 'NUM', 'NOUN'].includes(ts[hs - 1].pos) &&
        !ts[hs - 1].x.time
      )
        hs--;
      const f2 = units[m + 1];
      const np2 = f2 !== undefined ? npBefore(ts, f2, from) : -1;
      const bare = f2 !== undefined && (np2 < 0 || np2 <= f || isTimeTok(ts, ts[np2]));
      const bh = ts[hs - 1];
      // "I told my coach I was tired": verb + addressee + complement clause, not a relative
      if (
        bh &&
        (bh.pos === 'VERB' || bh.pos === 'AUX') &&
        /^(tell|show|remind|ask|teach|promise|warn|inform|convince|assure|bet|write|text|email)$/.test(
          bh.lemma,
        ) &&
        !bare
      )
        continue;
      if (ts[f].lemma === 'be' && !relHead) continue;
      const end = bare ? f2 : f2 !== undefined ? np2 : Infinity;
      if (!bare && f2 !== undefined && np2 <= f) continue;
      const relIdx = rest.idx.filter((i) => i >= sp && i < end);
      if (!(relHead && bare)) {
        // the relative's verb leaves an object gap: after the verb group only a PP, an adverb,
        // a time word or an indirect-object pronoun may follow
        let hasObj = false;
        for (const i of relIdx) {
          if (i <= f) continue;
          const u = ts[i];
          if (u.pos === 'VERB' || u.pos === 'AUX' || u.x.neg || u.norm === 'to' || u.x.cont)
            continue;
          hasObj = !(
            u.pos === 'ADP' ||
            u.pos === 'ADV' ||
            !!u.x.time ||
            !!u.mx.time ||
            (u.pos === 'PRON' && u.x.pron?.c === 'acc')
          );
          break;
        }
        if (hasObj) continue;
        // a subordinate-led segment keeps its last clause as the main one ("every time I…, I fall over")
        if (!bare && f2 === undefined && rest.how === 'sub') continue;
      }
      const r: Seg = { idx: relIdx, how: 'rel', role: 'subordinate', kind: 'relative' };
      if (bare) {
        const prePred = units.slice(0, m).some((u) => u < hs);
        const headIdx = rest.idx.filter((i) => (prePred ? i >= hs : true) && i < sp);
        const tail = rest.idx.filter((i) => i >= f2);
        if (prePred)
          return {
            push: [{ ...rest, idx: rest.idx.filter((i) => i < hs) }, r],
            rest: { idx: [...headIdx, ...tail], how: 'asyn', role: 'main' },
          };
        return { push: [r], rest: { ...rest, idx: [...headIdx, ...tail] } };
      }
      const a: Seg = { ...rest, idx: rest.idx.filter((i) => i < sp) };
      if (end === Infinity) return { push: [a], rest: r };
      return {
        push: [a, r],
        rest: { idx: rest.idx.filter((i) => i >= end), how: 'asyn', role: 'main' },
      };
    }
    return null;
  }

  // 3. classify and merge
  const infoMemo = new Map<string, { pred: boolean; fin: number[]; subj: boolean }>();
  const info = (s: Seg): { pred: boolean; fin: number[]; subj: boolean } => {
    const key = s.idx.join(',');
    const hit = infoMemo.get(key);
    if (hit) return hit;
    const p = segPred(ts, s.idx, spec);
    const r = { ...p, subj: hasSubject(ts, s.idx, spec, p.fin) };
    infoMemo.set(key, r);
    return r;
  };
  const leadTok = (s: Seg): T | undefined =>
    s.lead !== undefined ? ts[s.lead] : content(ts, s.idx)[0];
  const firstContent = (s: Seg): T | undefined => {
    const c = content(ts, s.idx).filter((t) => !t.x.disc && !t.x.voc);
    return c[0];
  };
  const isTagSeg = (s: Seg): boolean => {
    const c = content(ts, s.idx).filter((t) => !t.x.cont);
    if (!c.length || c.length > 3) return false;
    if (
      c.every(
        (t) =>
          t.x.tag ||
          t.x.neg ||
          (t.pos === 'INTJ' &&
            /^(right|ok|okay|yeah|yes|так|да|правда|ні|нет|prawda|tak|nie|tiesa|ar|ne|eks|jah|ju|onju|ei|або)$/.test(
              t.norm,
            )),
      )
    )
      return true;
    // "didn't I?", "isn't it?"
    if (
      lang === 'en' &&
      c[0].pos === 'AUX' &&
      c.some((t) => t.x.neg) &&
      c[c.length - 1].pos === 'PRON'
    )
      return true;
    return false;
  };

  /** Verbless subordinate clause with a locative / nominal predicate: "бо тренер у відпустці", "хоча я на дефіциті". */
  function locativeZero(s: Seg): boolean {
    if (lang === 'en') return false;
    const c = content(ts, s.idx).filter((t) => !t.x.cont);
    const n = c.findIndex(
      (t, k) =>
        (t.pos === 'NOUN' || (t.pos === 'PRON' && !t.x.wh)) &&
        spec.nomCapable(t) &&
        c[k - 1]?.pos !== 'ADP',
    );
    return n >= 0 && c.slice(n + 1).some((t) => t.pos === 'ADP');
  }
  /** "Тренування, пропущене через хворобу, …": a participial phrase after its noun is not a clause. */
  function participial(s: Seg): boolean {
    if (lang === 'en' || s.how !== 'punct') return false;
    const inf = info(s);
    if (!inf.pred || inf.fin.length) return false;
    const c = content(ts, s.idx).filter((t) => !t.x.cont);
    if (c.some((t) => !!t.x.predic || (t.pos === 'VERB' && t.feats.form === 'inf'))) return false;
    const a = c[0];
    if (!a || a.pos !== 'ADJ' || zeroCopula(c, spec) !== a.i) return false;
    const n = prevContent(ts, s.idx[0]);
    if (!n || n.pos !== 'NOUN') return false;
    if (a.feats.number && n.feats.number && a.feats.number !== n.feats.number) return false;
    if (
      a.feats.gender &&
      n.feats.gender &&
      a.feats.number !== 'pl' &&
      a.feats.gender !== n.feats.gender
    )
      return false;
    return true;
  }

  // relative sandwich: [NP] [rel] [predicate without subject]
  const merged: Seg[] = [];
  for (let k = 0; k < out.length; k++) {
    const s = out[k];
    const r = out[k + 1];
    const b = out[k + 2];
    const bFirstFin = (() => {
      const f = b ? content(ts, b.idx).filter((t) => !t.x.disc)[0] : undefined;
      return !!f && isFin(f) && (f.feats.person === 3 || !f.feats.person);
    })();
    if (r && b && !info(s).pred && isRelSeg(r) && (!info(b).subj || bFirstFin) && info(b).pred) {
      merged.push(
        { ...s, idx: [...s.idx, ...b.idx] },
        { ...r, how: 'rel', role: 'subordinate', kind: 'relative' },
      );
      k += 2;
      continue;
    }
    merged.push(s);
  }
  function isRelSeg(s: Seg): boolean {
    if (s.how === 'rel') return true;
    const l = leadTok(s);
    if (!l) return false;
    if (s.how === 'wh' || s.how === 'sub') {
      const p = prevContent(ts, s.idx[0]);
      return !!p && p.pos === 'NOUN' && (l.x.sub === 'relative' || l.x.sub === 'amb');
    }
    return false;
  }

  const res: Seg[] = [];
  for (let k = 0; k < merged.length; k++) {
    const s = merged[k];
    const inf = info(s);
    const prev = res[res.length - 1];
    const l = leadTok(s);
    const fc = firstContent(s);
    // tag at the end
    if (prev && k === merged.length - 1 && isTagSeg(s)) {
      prev.idx.push(...s.idx);
      prev.tag = true;
      continue;
    }
    const whLed = !!fc && (!!fc.x.wh || !!fc.x.qp);
    const keep = (): boolean => {
      if (s.how === 'rel') return true;
      if (s.how === 'sub') {
        if (
          !inf.pred &&
          l &&
          l.x.sub !== 'relative' &&
          !(l.x.sub === 'amb' && prevContent(ts, s.idx[0])?.pos === 'NOUN') &&
          !locativeZero(s)
        )
          return false;
        return true;
      }
      if (s.how === 'wh') return true;
      if (s.how === 'qp') {
        const cog = isCognLike(prevContent(ts, s.idx[0]), ctx.cogn);
        const cw = content(ts, s.idx).filter((t) => !t.x.qp && !t.x.cont);
        if (
          !cog &&
          !inf.fin.length &&
          cw.length <= 2 &&
          !cw.some((t) => (t.pos === 'VERB' && t.feats.form === 'inf') || !!t.x.predic)
        )
          return false; // "…, бурий рис чи білий": an alternative, not a clause
        if (!inf.pred && !cog) return false;
        const cc = content(ts, s.idx);
        const onlyInf =
          !inf.fin.length &&
          !cc.some((t) => !!t.x.predic) &&
          zeroCopula(cc, spec) < 0 &&
          !cc.some((t) => t.pos === 'PRON' && t.feats.case === 'nom');
        if (onlyInf && !cog) return false;
        return true;
      }
      if (s.how === 'corr') return inf.pred;
      if (!inf.pred) return whLed && s.how !== 'start' && ctx.question;
      if (s.how === 'start') return true;
      if (s.how === 'coord' || s.how === 'punct' || s.how === 'asyn') {
        if (!prev) return true;
        if (s.how === 'asyn') return true;
        if (l && l.x.coord === 'so') return true;
        if (inf.subj) return true;
        if (whLed) return true;
        const pl = prev.lead !== undefined ? ts[prev.lead] : undefined;
        if (
          s.how === 'punct' &&
          (prev.how === 'sub' || (pl && pl.x.sub && pl.x.sub !== 'amb' && pl.x.sub !== 'relative'))
        )
          return true;
        // English: a verb phrase without its own subject shares the previous one
        if (lang === 'en') {
          const f = inf.fin[0] !== undefined ? ts[inf.fin[0]] : undefined;
          if (f && f.feats.form === 'imp' && s.how === 'punct') return true;
          if (
            f &&
            f.pos === 'AUX' &&
            content(ts, s.idx).some((t) => t.i > f.i && spec.nomCapable(t))
          )
            return true; // inversion
          return false;
        }
        // after a subordinate clause, a subjectless "but …" predicate coordinates with the main verb:
        // "я розумію, шо треба відпочивати, але не можу сидіти вдома"
        let base = prev;
        if (s.how === 'coord' && (prev.how === 'sub' || prev.how === 'wh' || prev.how === 'qp')) {
          const ind = [...res].reverse().find((r) => !['sub', 'wh', 'qp', 'rel'].includes(r.how));
          if (ind) base = ind;
        }
        const f2 = inf.fin[0] !== undefined ? ts[inf.fin[0]] : undefined;
        const fp = firstFin(prev);
        const fb = base !== prev ? firstFin(base) : undefined;
        if (fb && f2 && !(fp && compatible(fp, f2)) && compatible(fb, f2)) {
          mergeInto = base;
          return false;
        }
        const f1 = fp;
        if (!f2) {
          // predicative / zero copula start a clause; a bare infinitive depends on the previous verb
          const cc = content(ts, s.idx);
          return (
            cc.some((t) => !!t.x.predic) || zeroCopula(cc, spec) >= 0 || cc.some((t) => !!t.x.poss)
          );
        }
        if (!f1) return true;
        return !compatible(f1, f2);
      }
      return true;
    };
    function firstFin(p: Seg): T | undefined {
      const i = segPred(ts, p.idx, spec).fin[0];
      return i === undefined ? undefined : ts[i];
    }
    if (prev && k < merged.length - 1 && participial(s)) {
      const a = content(ts, s.idx)[0];
      a.x = { ...a.x, attr: true };
      infoMemo.clear();
      prev.idx.push(...s.idx);
      continue;
    }
    let mergeInto: Seg | undefined;
    if (keep() || !prev) {
      res.push({ ...s, idx: [...s.idx] });
    } else {
      (mergeInto ?? prev).idx.push(...s.idx);
    }
  }
  // "Чому, коли я біжу, в мене колить?": a bare wh-word before a subordinate clause belongs to the main clause
  if (
    res.length > 2 &&
    !info(res[0]).pred &&
    firstContent(res[0])?.x.wh &&
    (res[1].how === 'sub' ||
      (res[1].how === 'wh' && /^(temporal|conditional)$/.test(leadTok(res[1])?.x.sub ?? ''))) &&
    info(res[2]).pred
  ) {
    const [a, b, c] = res;
    res.splice(0, 3, b, { ...c, idx: [...a.idx, ...c.idx], how: a.how, lead: a.lead });
  }
  // a leading segment without predicate merges forward
  while (
    res.length > 1 &&
    !info(res[0]).pred &&
    !(res[0].how === 'sub' && leadTok(res[0])?.x.sub === 'relative')
  ) {
    const [a, b] = res;
    const aLead = a.how === 'sub' || (a.how === 'start' && a.lead !== undefined);
    const how = aLead
      ? a.how
      : b.how === 'sub' || b.how === 'wh' || b.how === 'qp' || b.how === 'corr'
        ? b.how
        : a.how;
    res.splice(0, 2, { ...b, idx: [...a.idx, ...b.idx], how, lead: aLead ? a.lead : b.lead });
  }
  for (const s of res) s.idx.sort((a, b) => a - b);
  res.sort((a, b) => a.idx[0] - b.idx[0]);

  // 4. roles & kinds
  let mainSet = false;
  for (let k = 0; k < res.length; k++) {
    const s = res[k];
    const l = leadTok(s);
    const pc = s.idx[0] > 0 ? prevContent(ts, s.idx[0]) : undefined;
    const f0 = k === 0 ? firstContent(s) : undefined;
    if (s.how === 'rel') {
      s.role = 'subordinate';
      s.kind = 'relative';
    } else if (
      k === 0 &&
      f0 &&
      f0.x.wh &&
      (f0.x.sub === 'temporal' || f0.x.sub === 'conditional') &&
      res.length > 1 &&
      res[1].how !== 'sub' &&
      !isInterrogWh(s)
    ) {
      s.role = 'subordinate';
      s.kind = f0.x.sub;
      s.lead = f0.i;
    } else if (s.how === 'sub' && l) {
      s.role = 'subordinate';
      let kind = l.x.sub as ClauseKind | 'amb';
      if (kind === 'amb') {
        const soBefore =
          k > 0 &&
          /^(що|шо|что|ze|kad|et)$/.test(l.lk) &&
          content(ts, res[k - 1].idx).some((t) =>
            /^(так|настільки|настолько|такий|такой|tak|taki|taka|taip|toks|tokia|nii|niivord)$/.test(
              t.lk,
            ),
          );
        if (soBefore)
          kind = 'result'; // "так накачався, шо руки не розгинаються", "tak zmęczyłem nogi, że…"
        else if (
          pc &&
          (pc.pos === 'NOUN' ||
            (pc.pos === 'PRON' && !pc.x.pron && !ctx.cogn(pc) && !/^(sie|sa)$/.test(pc.lk)))
        )
          kind = 'relative';
        else if (pc && /^(so|такий|так|настільки|such)$/.test(pc.norm)) kind = 'result';
        else kind = 'complement';
      }
      const pcc = pc && pc.pos === 'PRON' && pc.feats.case === 'acc' ? prevContent(ts, pc.i) : pc;
      if (
        kind === 'conditional' &&
        l.norm === 'if' &&
        pcc &&
        (ctx.cogn(pcc) || /^(sure|certain|wonder)$/.test(pcc.lemma))
      )
        kind = 'complement';
      if (
        kind === 'purpose' &&
        pc &&
        /^(хотіти|хочу|хоче|хочуть|хотів|хотіла|хотеть|хочет|просити|сказати|казати|want|chcieć|chce|norėti|tahtma)$/.test(
          pc.lemma,
        )
      )
        kind = 'complement';
      if (kind === 'relative' && (!pc || pc.pos !== 'NOUN')) {
        kind =
          isCognLike(pc, ctx.cogn) || (pc && (pc.pos === 'VERB' || pc.pos === 'AUX'))
            ? 'complement'
            : kind;
        if (!pc || pc.kind === 'p') kind = 'relative';
      }
      // "since" + past = temporal ("since I started…"), otherwise causal ("since you're the coach")
      if (l.norm === 'since') {
        const f = content(ts, s.idx).find(isFin);
        kind = f && f.feats.tense === 'past' ? 'temporal' : 'causal';
      }
      s.kind = kind;
      // sentence-initial "when"/"коли"/"як" that is really the question word
      if (k === 0 && l.x.wh && (res.length === 1 || isInterrogWh(s))) {
        s.role = 'main';
        s.kind = undefined;
      }
    } else if (s.how === 'wh' && l) {
      const relCap =
        l.x.sub === 'relative' || (l.x.sub === 'amb' && !(lang === 'en' && l.norm === 'what'));
      const last = k === res.length - 1;
      const interrog = isInterrogWh(s);
      const cognPrev =
        !!pc &&
        (isCognLike(pc, ctx.cogn) ||
          (pc.pos === 'PRON' &&
            pc.feats.case !== 'nom' &&
            isCognLike(prevContent(ts, pc.i), ctx.cogn)) ||
          cognBefore(s.idx[0]));
      const commaBefore = ts[s.idx[0] - 1]?.kind === 'p';
      const bareWhQ =
        lang !== 'en' &&
        last &&
        commaBefore &&
        l.x.sub === 'amb' &&
        strongInterrog(s) &&
        !(pc && isCognLike(pc, ctx.cogn));
      if (
        pc &&
        pc.pos === 'NOUN' &&
        relCap &&
        !(last && ctx.question && interrog && commaBefore) &&
        !bareWhQ
      ) {
        s.role = 'subordinate';
        s.kind = 'relative';
      } else if (
        cognPrev &&
        !(commaBefore && interrog && last && ctx.question && !isCognLike(pc, ctx.cogn))
      ) {
        s.role = 'subordinate';
        s.kind = 'complement';
      } else if (lang === 'en' && pc && pc.lemma === 'be' && /^(what|who)$/.test(l.norm)) {
        s.role = 'subordinate';
        s.kind = 'relative';
      } else if (
        l.x.sub &&
        l.x.sub !== 'amb' &&
        l.x.sub !== 'relative' &&
        !(commaBefore && interrog)
      ) {
        s.role = 'subordinate';
        s.kind = l.x.sub;
      } else if (
        lang !== 'en' &&
        k > 0 &&
        !ctx.question &&
        !strongInterrog(s) &&
        (l.x.sub === 'temporal' || l.x.sub === 'conditional')
      ) {
        // "…, коли надворі дощ" in a statement: a temporal clause, not a question
        s.role = 'subordinate';
        s.kind = l.x.sub;
      } else if (
        lang !== 'en' &&
        k > 0 &&
        l.x.sub === 'amb' &&
        pc &&
        (pc.pos === 'VERB' || pc.pos === 'AUX' || !!pc.x.predic || pc.pos === 'ADJ') &&
        !(last && ctx.question && interrog && commaBefore) &&
        !strongInterrog(s)
      ) {
        // "Мені набридло, що ти…", "Мене турбує, що…": complement of the predicate
        s.role = 'subordinate';
        s.kind = 'complement';
      } else s.role = 'main';
    } else if (s.how === 'qp' && l && pc && (isCognLike(pc, ctx.cogn) || cognBefore(s.idx[0]))) {
      s.role = 'subordinate';
      s.kind = 'complement';
    } else if (
      (s.how === 'asyn' || s.how === 'punct') &&
      k > 0 &&
      (res[k - 1].role !== 'subordinate' ||
        (() => {
          const p = prevContent(ts, s.idx[0]);
          const o = p && res.slice(0, k).find((r) => r.idx.includes(p.i));
          return !!o && o.role !== 'subordinate';
        })())
    ) {
      // "I think [I overtrained]", "says [I train]" — the clause owning the word right before
      const pvT = prevContent(ts, s.idx[0]);
      const owner = (pvT && res.slice(0, k).find((r) => r.idx.includes(pvT.i))) ?? res[k - 1];
      const pv = content(
        ts,
        owner.idx.filter((i) => i < s.idx[0]),
      );
      const lastV = [...pv].reverse().find((t) => t.pos === 'VERB' || t.pos === 'AUX');
      const tail = pv[pv.length - 1];
      if (
        lastV &&
        ctx.cogn(lastV) &&
        (tail === lastV ||
          (tail.pos === 'PRON' && tail.i === lastV.i + 1) ||
          tail.x.sem === 'degree')
      ) {
        s.role = 'subordinate';
        s.kind = 'complement';
      } else if (s.how === 'asyn' && tail && tail.pos === 'ADJ' && isCognLike(tail, ctx.cogn)) {
        s.role = 'subordinate';
        s.kind = 'complement';
      } else if (
        s.how === 'asyn' &&
        lang === 'en' &&
        tail &&
        tail.pos === 'NOUN' &&
        REL_HEAD.test(tail.lemma) &&
        pv.some((t) => t.norm === 'the' && t.i < tail.i)
      ) {
        s.role = 'subordinate';
        s.kind = 'relative';
      } else s.role = 'main';
    } else s.role = 'main';
    if (s.role === 'main') {
      if (mainSet) s.role = 'coordinate';
      mainSet = true;
    }
    if (s.role === 'coordinate' && l && l.x.coord === 'so') s.kind = 'result';
  }
  // Estonian "kui" is both "if" and "when": a habitual statement ("Küünarnukk valutab, kui ma
  // lõuga tõmban") reads temporal; a one-off (time word), a question or a request reads conditional.
  if (lang === 'et') {
    const mainSeg = res.find((r) => r.role === 'main');
    const mt = mainSeg ? content(ts, mainSeg.idx) : [];
    const oneOff =
      ctx.question ||
      mt.some(
        (t) =>
          !!t.x.qp ||
          !!t.x.wh ||
          !!t.x.modal ||
          !!t.feats.cond ||
          t.feats.form === 'imp' ||
          t.feats.tense === 'past',
      );
    for (const s of res) {
      if (s.role !== 'subordinate' || s.kind !== 'conditional' || leadTok(s)?.lk !== 'kui')
        continue;
      const time = ts.some((t) => !!t.mx.time || !!t.x.time);
      if (!time && !oneOff) s.kind = 'temporal';
    }
  }
  // A conditional/temporal clause before "то" / the main clause: fine. Correlative stays main.
  return res;

  /** A verb of saying / knowing right before i, skipping adverbs, object pronouns and politeness ("скажи мені чесно, чи…"). */
  function cognBefore(i: number): boolean {
    for (let k = i - 1; k >= 0; k--) {
      const t = ts[k];
      if (
        t.kind === 'p' ||
        t.x.cont ||
        t.x.please ||
        t.x.neg ||
        (t.pos === 'ADV' && !t.x.time && !t.x.wh) ||
        (t.pos === 'PRON' && !!t.x.pron && t.feats.case !== 'nom' && t.feats.case !== undefined)
      )
        continue;
      return (t.pos === 'VERB' || t.pos === 'AUX') && ctx.cogn(t);
    }
    return false;
  }

  /** Free word order: an infinitive, modal, predicative or dative after the wh-word marks a question. */
  function strongInterrog(s: Seg): boolean {
    const c = content(ts, s.idx).filter((t) => !t.x.cont && !t.x.disc);
    const w = c.findIndex((t) => !!t.x.wh);
    if (w < 0) return false;
    return c
      .slice(w + 1)
      .some(
        (t) =>
          (t.pos === 'VERB' && t.feats.form === 'inf') ||
          (!!t.x.predic && t.x.predic !== 'eval') ||
          !!t.x.modal ||
          (!!t.x.pron && t.feats.case === 'dat'),
      );
  }

  function isInterrogWh(s: Seg): boolean {
    const c = content(ts, s.idx).filter((t) => !t.x.cont && !t.x.disc);
    const w = c.findIndex((t) => !!t.x.wh);
    if (w < 0) return false;
    const after = c.slice(w + 1);
    if (lang === 'en') {
      const n = after[0];
      if (!n) return true;
      if (n.pos === 'AUX') return true;
      if (n.pos === 'VERB' && n.feats.form === 'fin') return true;
      if (n.norm === 'to' || n.norm === 'not') return true;
      if (n.pos === 'NOUN' || n.pos === 'DET') return after.some((t) => t.pos === 'AUX');
      return false;
    }
    // free word order: infinitive / modal / predicative / dative → question
    if (
      after.some(
        (t) =>
          (t.pos === 'VERB' && t.feats.form === 'inf') ||
          t.x.predic ||
          t.x.modal ||
          (t.x.pron && t.feats.case === 'dat'),
      )
    )
      return true;
    if (!after.some(isFin)) return true;
    return false;
  }
}
