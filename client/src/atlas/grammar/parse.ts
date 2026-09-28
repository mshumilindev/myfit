/**
 * Shallow dependency parse of one clause: predicate (verb group with aux /
 * modal / negation), subject by case / agreement / word order (pro-drop aware),
 * objects, adverbials, tense / aspect / mood / modality / person.
 */
import { content, isFin, zeroCopula, type Seg } from './clauses';
import { INTRANS, type LangSpec, type T } from './core';
import type { Clause, Dep, Modality, Phrase, Tense } from './types';

export interface ParseCtx {
  spec: LangSpec;
  sentenceQuestion: boolean;
  /** Any past-time signal in the sentence (for English "could"). */
  pastCtx: boolean;
}

const SUBJ_ADV =
  /^(usually|always|never|just|also|still|only|really|even|already|often|sometimes|rarely|actually|honestly|probably|constantly|ever)$/;

/** Participles read as states after "be" ("the gym was closed"): the copula stays the predicate. */
const STATIVE_PP =
  /^(closed|open|opened|done|finished|gone|tired|bored|excited|interested|worried|stressed|exhausted|scared|confused|allowed|supposed|used|located|packed|crowded|full|broken|busy|stuck|sore|dehydrated|motivated|pumped|hooked|obsessed|married|divorced|born|swollen|bloated|dizzy|sick|lost|ready|tight|stiff|numb)$/;

function phrase(ts: T[], idx: number[], head: T, sem?: Phrase['sem']): Phrase {
  const tok = idx.map((i) => ts[i]);
  return {
    text: tok.map((t) => t.text).join(' '),
    lemma: head.lemma,
    tokens: idx,
    ...(sem ? { sem } : {}),
  };
}

function setDep(t: T, dep: Dep, head?: T): void {
  if (t.dep && t.dep !== 'compound' && dep === 'compound') return;
  t.dep = dep;
  if (head && head !== t) t.head = head.i;
}

/** NP chunk ending at head h (extends left over DET/ADJ/NUM/NOUN/poss). */
function npLeft(ts: T[], h: T, min: number): number[] {
  const out = [h.i];
  let k = h.i - 1;
  while (k >= min) {
    const t = ts[k];
    if (t.x.cont) {
      k--;
      continue;
    }
    if (
      t.pos === 'DET' ||
      t.pos === 'ADJ' ||
      t.pos === 'NUM' ||
      (t.pos === 'NOUN' && h.pos === 'NOUN' && t.i === out[0] - 1) ||
      t.norm === "'s"
    ) {
      out.unshift(k);
      k--;
      continue;
    }
    break;
  }
  return out;
}

function npRight(ts: T[], s: T, max: number): number[] {
  const out = [s.i];
  let k = s.i + 1;
  while (k <= max) {
    const t = ts[k];
    if (
      t.pos === 'NOUN' ||
      t.pos === 'ADJ' ||
      t.pos === 'NUM' ||
      t.norm === "'s" ||
      (t.pos === 'DET' && out.length === 0)
    ) {
      out.push(k);
      k++;
      continue;
    }
    break;
  }
  return out;
}

const who = (t: T | undefined): 'user' | 'atlas' | 'other' | undefined => {
  if (!t) return undefined;
  if (t.x.pron) return t.x.pron.p === 1 ? 'user' : t.x.pron.p === 2 ? 'atlas' : 'other';
  return 'other';
};

export function parseClause(ts: T[], seg: Seg, ctx: ParseCtx): Clause {
  const { spec } = ctx;
  const all = seg.idx.map((i) => ts[i]);
  const c = content(ts, seg.idx).filter((t) => !t.x.cont);
  const lead = seg.lead !== undefined ? ts[seg.lead] : undefined;
  const body = c.filter((t) => t !== lead || !!t.x.wh || !!t.x.qp);
  const clause: Clause = {
    text: all
      .filter(
        (t, k) => !(t.kind === 'p' && (k === all.length - 1 || k === 0) && /^[,;:]$/.test(t.text)),
      )
      .map((t) => t.text)
      .join(' ')
      .replace(/\s+([,.!?;:…)])/g, '$1')
      .replace(/([(])\s+/g, '$1'),
    role: seg.role,
    ...(seg.kind ? { kind: seg.kind } : {}),
    ...(lead &&
    (lead.pos === 'SCONJ' ||
      lead.pos === 'CONJ' ||
      lead.x.corr ||
      (seg.role === 'subordinate' && (lead.x.wh || lead.x.qp)))
      ? { connector: connectorText(ts, lead) }
      : {}),
    tokens: all,
    tokenIdx: seg.idx,
    objects: [],
    adverbials: [],
    tense: 'none',
    mood: 'indicative',
    negated: false,
    subjectIsUser: false,
    subjectIsAtlas: false,
    interrogative: false,
  };
  if (lead && (lead.pos === 'SCONJ' || lead.pos === 'CONJ'))
    setDep(lead, lead.pos === 'CONJ' ? 'cc' : 'mark');
  if (spec.lang === 'en') parseEn(ts, body, clause, ctx);
  else parseFree(ts, body, clause, ctx);
  if (lead && clause.predicate && lead.dep)
    lead.head = clause.predicate.tokens[clause.predicate.tokens.length - 1];
  return clause;
}

function connectorText(ts: T[], lead: T): string {
  const out = [lead.norm];
  for (let k = lead.i + 1; k < ts.length && ts[k].x.cont; k++) out.push(ts[k].norm);
  return out.join(' ');
}

// ─────────────────────────── English ───────────────────────────

function parseEn(ts: T[], c: T[], cl: Clause, ctx: ParseCtx): void {
  const spec = ctx.spec;
  let k0 = 0;
  while (
    k0 < c.length &&
    (c[k0].x.disc || c[k0].x.voc || c[k0].x.please || c[k0].pos === 'INTJ' || c[k0].x.excl)
  )
    k0++;
  const body = c.slice(k0);
  const whIdx = body.findIndex((t) => !!t.x.wh && !t.x.rhet);
  const wh = body.find((t) => !!t.x.wh);
  if (wh && cl.role !== 'subordinate' && body.indexOf(wh) <= 1) cl.whWord = wh.x.wh;
  // finite element
  const F = body.find((t) => isFin(t) || t.x.hort);
  const neg = body.some((t) => t.x.neg || (t.x.negq && !(t.pos === 'INTJ')));
  cl.negated = neg;
  let lex: T | undefined;
  let modality: Modality | undefined;
  let inversion = false;
  if (!F) {
    // non-finite: "how to squat", "why not commenting"
    lex = body.find((t) => t.pos === 'VERB');
    if (lex) {
      cl.predicate = phrase(ts, [lex.i], lex);
      setDep(lex, 'root');
    }
    cl.tense = 'none';
    if (wh) cl.interrogative = cl.role !== 'subordinate';
    fillEnArgs(ts, body, cl, lex, undefined, ctx);
    // "why u ignoring me": dropped auxiliary before -ing
    const sp = lex && lex.x.vf === 'ing' ? body[body.indexOf(lex) - 1] : undefined;
    if (sp && sp.pos === 'PRON' && sp.x.pron && sp.x.pron.c !== 'acc') {
      cl.tense = 'present';
      cl.aspect = 'progressive';
      cl.subject = phrase(ts, [sp.i], sp);
      setDep(sp, 'nsubj', lex);
      cl.person = sp.x.pron.p;
      cl.subjectIsUser = sp.x.pron.p === 1;
      cl.subjectIsAtlas = sp.x.pron.p === 2;
    }
    return;
  }
  const fIdx = body.indexOf(F);
  const auxTo = (u: T): boolean => u.x.aux === 'going' || u.x.aux === 'used';
  /** A participle / -ing form / "able to" follows position k (skipping adverbs and negation). */
  const verbalAfter = (k: number): boolean => {
    for (let q = k + 1; q < body.length; q++) {
      const u = body[q];
      if (u.x.neg || u.pos === 'ADV') continue;
      return (
        u.x.modalTo === true ||
        u.lemma === 'be' ||
        (u.pos === 'VERB' && (u.x.vf === 'ing' || u.x.vf === 'pp' || u.x.vf === 'pastpp'))
      );
    }
    return false;
  };
  // wh-phrase: "how many sets", "what muscles", "which exercises", "how much protein"
  const whPhrase = new Set<T>();
  if (wh) {
    let q = body.indexOf(wh) + 1;
    if (wh.pos === 'DET' || /^how_(much|many)$/.test(wh.x.wh ?? '') || wh.x.about)
      while (q < body.length && (body[q].pos === 'NOUN' || body[q].pos === 'ADJ') && body[q] !== F)
        whPhrase.add(body[q++]);
  }
  // inversion: aux first (after wh-word), subject after it
  const beforeF = body
    .slice(0, fIdx)
    .filter(
      (t) =>
        !t.x.wh &&
        !whPhrase.has(t) &&
        !t.x.neg &&
        !t.x.cont &&
        !(t.pos === 'ADV' && SUBJ_ADV.test(t.norm)),
    );
  const afterF = body[fIdx + 1];
  if (
    F.pos === 'AUX' &&
    !beforeF.length &&
    afterF &&
    (spec.nomCapable(afterF) ||
      afterF.pos === 'DET' ||
      afterF.norm === 'there' ||
      (afterF.pos === 'NUM' && body[fIdx + 2]?.pos === 'NOUN') ||
      (afterF.pos === 'ADJ' && body[fIdx + 2]?.pos === 'NOUN') ||
      (afterF.x.neg &&
        body[fIdx + 2] &&
        (spec.nomCapable(body[fIdx + 2]) || body[fIdx + 2].pos === 'DET')))
  ) {
    inversion = true;
  }
  // verb chain
  const chain: T[] = [F];
  const npTok = (t: T): boolean =>
    ['PRON', 'NOUN', 'DET', 'ADJ', 'NUM'].includes(t.pos) || t.norm === "'s" || t.norm === 'there';
  if (
    F.pos === 'AUX' ||
    F.x.hort ||
    F.lemma === 'want' ||
    F.lemma === 'need' ||
    auxTo(F) ||
    !!F.x.modalTo
  ) {
    let k = fIdx + 1;
    let subjDone = !inversion;
    const skip = (t: T): boolean =>
      !!t.x.neg ||
      (t.pos === 'ADV' &&
        (SUBJ_ADV.test(t.norm) || t.x.sem === 'degree' || t.x.sem === 'frequency'));
    for (; k < body.length; k++) {
      const t = body[k];
      if (skip(t)) continue;
      if (!subjDone) {
        // subject NP of the inversion (or a gerund subject after do/modal)
        if (t.pos === 'VERB' && t.x.vf === 'ing' && k === fIdx + 1 && F.lemma !== 'be') {
          subjDone = true;
          continue;
        }
        if (npTok(t)) {
          let q = k;
          if (t.pos === 'PRON' && t.x.pron) q = k;
          else {
            while (
              q + 1 < body.length &&
              npTok(body[q + 1]) &&
              !(body[q + 1].pos === 'PRON' && body[q + 1].x.pron) &&
              body[q].pos !== 'PRON'
            ) {
              if (F.lemma === 'be' && body[q + 1].pos === 'ADJ' && body[q].pos === 'NOUN') break;
              q++;
            }
            // "wasn't my run [from this morning] saved": a PP inside the inverted subject
            while (
              body[q + 1]?.pos === 'ADP' &&
              body[q + 2] &&
              npTok(body[q + 2]) &&
              body
                .slice(q + 2)
                .some(
                  (u) =>
                    u.pos === 'VERB' &&
                    (u.x.vf === 'pp' || u.x.vf === 'pastpp' || u.x.vf === 'ing'),
                )
            ) {
              q += 2;
              while (q + 1 < body.length && npTok(body[q + 1]) && body[q + 1].pos !== 'PRON') q++;
            }
          }
          k = q;
          subjDone = true;
          continue;
        }
        if (F.lemma === 'be' && t.pos === 'VERB' && t.x.vf === 'ing') break; // "is walking…" — gerund subject, copula
        subjDone = true;
      }
      if (t.norm === 'to' || t.x.modalTo || auxTo(t)) {
        if (t.x.modalTo || auxTo(t)) chain.push(t);
        if (
          F.lemma === 'be' &&
          !t.x.aux &&
          !t.x.modalTo &&
          !chain.some((u) => auxTo(u) || u.x.modalTo)
        )
          break;
        continue;
      }
      if (F.x.hort && t.pos === 'PRON') continue;
      // be / have inside the verb group: "'ll be doing", "could have avoided", "should have been able to"
      if (
        t.pos === 'AUX' ||
        ((t.lemma === 'be' || t.lemma === 'have') && t.feats.form !== 'fin' && verbalAfter(k))
      ) {
        chain.push(t);
        continue;
      }
      if (t.pos === 'VERB' && t.feats.form !== 'fin') {
        const needTo = F.pos === 'VERB' && (F.lemma === 'want' || F.lemma === 'need');
        if (needTo && body[k - 1]?.norm !== 'to') break;
        const lastAux = chain[chain.length - 1];
        if (
          lastAux.lemma === 'be' &&
          !(
            t.x.vf === 'ing' ||
            t.feats.form === 'part' ||
            t.x.vf === 'pp' ||
            t.x.vf === 'pastpp'
          ) &&
          !chain.some((u) => auxTo(u) || u.x.modalTo)
        )
          break;
        lex = t;
        break;
      }
      break;
    }
    if (!lex && F.pos === 'VERB' && (F.lemma === 'want' || F.lemma === 'need')) lex = F;
  }
  // "got injured": passive with get
  if (!lex && F.pos === 'VERB' && F.lemma === 'get') {
    const n = body.slice(fIdx + 1).find((t) => !(t.pos === 'ADV' || t.x.neg));
    const ppC = n?.cands.find(
      (c) => c.pos === 'VERB' && (c.x?.vf === 'pp' || c.x?.vf === 'pastpp'),
    );
    if (
      n &&
      !STATIVE_PP.test(n.norm) &&
      ((n.pos === 'VERB' && (n.x.vf === 'pp' || n.x.vf === 'pastpp')) || (n.pos === 'ADJ' && ppC))
    ) {
      chain.push(F);
      lex = n;
      if (n.pos === 'ADJ' && ppC) n.lemma = ppC.lemma;
    }
  }
  // stative participle after the copula ("the gym was closed") is a predicative adjective
  if (lex && chain.some((t) => t.lemma === 'be') && STATIVE_PP.test(lex.norm)) lex = undefined;
  for (const t of chain) if (t.x.modal) modality = t.x.modal;
  if ((F.lemma === 'want' || F.lemma === 'need') && lex && lex !== F)
    modality = F.lemma as Modality;
  const head = lex ?? chain.find((t) => t.x.cop || t.lemma === 'be') ?? F;
  const predIdx = [...new Set([...chain.map((t) => t.i), head.i])].sort((a, b) => a - b);
  for (const t of body)
    if (t.x.neg && t.i > (predIdx[0] ?? 0) - 3 && t.i < head.i + 2) predIdx.push(t.i);
  predIdx.sort((a, b) => a - b);
  cl.predicate = phrase(ts, [...new Set(predIdx)], head);
  if (head.x.hort) cl.predicate.lemma = 'let';
  setDep(head, 'root');
  for (const a of chain) if (a !== head) setDep(a, 'aux', head);
  for (const t of body) if (t.x.neg) setDep(t, 'neg', head);
  if (modality) cl.modality = modality;
  // tense / aspect / mood
  const fin = F;
  // negative imperative: "Don't give me…"
  const negImp =
    F.pos === 'AUX' &&
    F.lemma === 'do' &&
    fIdx === 0 &&
    !!body[1]?.x.neg &&
    !!lex &&
    !body.slice(2, body.indexOf(lex)).some((t) => spec.nomCapable(t));
  const imp = fin.feats.form === 'imp' || !!fin.x.hort || negImp;
  const hasAux = (f: (t: T) => boolean): boolean => chain.some(f);
  if (imp) {
    cl.tense = 'none';
    cl.mood = 'imperative';
  } else if (hasAux((t) => t.x.aux === 'will') || hasAux((t) => t.x.aux === 'going'))
    cl.tense = 'future';
  else if (hasAux((t) => t.x.aux === 'used')) cl.tense = 'past';
  else if (
    // modal perfect: "could have avoided", "must have pulled", "would have done", "should have been able to"
    (fin.x.modal || fin.x.aux === 'would') &&
    chain.some(
      (t, k) =>
        k > 0 &&
        t.lemma === 'have' &&
        (chain.slice(k + 1).some((u) => u.norm === 'been') ||
          (!!lex && (lex.x.vf === 'pp' || lex.x.vf === 'pastpp'))),
    )
  )
    cl.tense = 'past';
  else if (
    fin.lemma === 'have' &&
    fin.pos === 'AUX' &&
    chain.concat(lex ? [lex] : []).some((t) => t.feats.form === 'part' || t.norm === 'been')
  ) {
    cl.tense = 'past';
    cl.aspect = 'perfect';
  } else if (fin.x.aux === 'would' && fin.lemma === 'can') {
    const q = ctx.sentenceQuestion || cl.role === 'subordinate';
    cl.tense = !q && ctx.pastCtx ? 'past' : 'present';
    if (cl.tense === 'present') cl.mood = 'conditional';
  } else if (fin.x.aux === 'would') {
    cl.tense = 'present';
    cl.mood = 'conditional';
  } else cl.tense = fin.feats.tense === 'past' ? 'past' : 'present';
  if (
    !cl.aspect &&
    chain.some((t) => t.lemma === 'be' && t.pos === 'AUX') &&
    lex &&
    lex.x.vf === 'ing'
  )
    cl.aspect = 'progressive';
  // interrogative
  if (!imp && cl.role !== 'subordinate') {
    if (inversion) cl.interrogative = true;
    if (wh && body.indexOf(wh) <= 1) cl.interrogative = true;
  }
  if (inversion && cl.role !== 'subordinate') cl.interrogative = true;
  fillEnArgs(
    ts,
    body,
    cl,
    head,
    negImp ? { ...F, feats: { ...F.feats, form: 'imp' } } : F,
    ctx,
    inversion && !negImp,
    whIdx >= 0 ? body[whIdx] : undefined,
    whPhrase,
  );
  // "Me and my girlfriend ran…": a coordinated subject that includes the speaker
  if (cl.subject && !cl.subjectIsUser && fIdx > 0) {
    const pre = ts.slice(body[0].i, F.i);
    if (
      pre.some((t) => !!t.x.pron && t.x.pron.p === 1 && t.pos === 'PRON') &&
      pre.some((t) => t.pos === 'CONJ' && t.x.coord === 'and')
    ) {
      cl.subjectIsUser = true;
      cl.subjectIsAtlas = false;
      cl.person = 1;
      cl.number = 'pl';
    }
  }
  // "Can't sleep after evening workouts": a sentence-initial negated modal without a subject
  if (
    !imp &&
    !cl.subject &&
    !inversion &&
    fIdx === 0 &&
    F.pos === 'AUX' &&
    (!!F.x.modal || F.norm === 'did' || F.x.aux === 'will') &&
    cl.negated &&
    cl.role !== 'subordinate'
  ) {
    cl.subjectIsUser = true;
    cl.person = 1;
    cl.number = 'sg';
  }
  // diary style "just finished a 5k run": subjectless past statement = the user
  if (
    !imp &&
    !cl.subject &&
    !inversion &&
    F.pos === 'VERB' &&
    F.feats.tense === 'past' &&
    cl.role !== 'subordinate' &&
    !ctx.sentenceQuestion &&
    fIdx <= 1
  ) {
    cl.subjectIsUser = true;
    cl.person = 1;
    cl.number = 'sg';
  }
  if (imp) {
    if (F.x.hort) {
      cl.person = 1;
      cl.number = 'pl';
      cl.subjectIsUser = true;
    } else {
      cl.person = 2;
      cl.subjectIsAtlas = true;
    }
  }
  if (cl.interrogative) cl.mood = 'interrogative';
}

function fillEnArgs(
  ts: T[],
  body: T[],
  cl: Clause,
  head: T | undefined,
  F: T | undefined,
  ctx: ParseCtx,
  inversion = false,
  wh?: T,
  whPhrase: Set<T> = new Set(),
): void {
  const spec = ctx.spec;
  let subj: T | undefined;
  let subjIdx: number[] = [];
  if (F && !(F.feats.form === 'imp' || F.x.hort)) {
    const fIdx = body.indexOf(F);
    if (inversion) {
      // first nominal after the aux
      for (let k = fIdx + 1; k < body.length; k++) {
        const t = body[k];
        if (t.x.neg) continue;
        if (t.norm === 'there') {
          const n = body
            .slice(k + 1)
            .find((u) => u.pos === 'NOUN' || (u.pos === 'PRON' && u.x.pron));
          subj = n ?? t;
          break;
        }
        if (t.pos === 'PRON' || t.pos === 'NOUN' || (t.pos === 'VERB' && t.x.vf === 'ing')) {
          // head of NP: last noun of the run
          let h = t;
          if (t.pos === 'NOUN') {
            let q = k + 1;
            while (q < body.length && body[q].pos === 'NOUN' && body[q] !== head) q++;
            h = body[q - 1];
          }
          subj = h;
          break;
        }
        if (t.pos === 'ADJ' && body[k + 1] && !['NOUN', 'ADJ'].includes(body[k + 1].pos)) {
          subj = t; // "a beginner" tagged as adjective
          break;
        }
        if (t.pos === 'DET' || t.pos === 'ADJ' || t.pos === 'NUM') continue;
        break;
      }
    } else {
      // wh-subject: "who designed", "what happens", "which exercises target"
      if (wh && wh.pos !== 'ADV' && body.indexOf(wh) < fIdx) {
        const between = body
          .slice(body.indexOf(wh) + 1, fIdx)
          .filter((t) => !t.x.cont && !t.x.neg && !(t.pos === 'ADV'));
        if (!between.length || between.every((t) => whPhrase.has(t))) {
          subj = between.length ? between[between.length - 1] : wh;
        }
      }
      if (!subj) {
        for (let k = fIdx - 1; k >= 0; k--) {
          const t = body[k];
          if (t.pos === 'ADV' || t.x.neg || t.x.cont) continue;
          if (t.norm === 'there' && F.lemma === 'be') {
            subj = body.slice(fIdx + 1).find((u) => u.pos === 'NOUN');
            break;
          }
          if (spec.nomCapable(t) || (t.pos === 'NUM' && body[k + 1]?.pos === 'NOUN')) {
            subj = t;
            break;
          }
          if (t.pos === 'ADP' || t.pos === 'SCONJ') break;
          if (t.pos === 'DET' || t.pos === 'ADJ' || t.pos === 'NUM') continue;
          break;
        }
      }
    }
    // "yesterday was leg day": copula with the nominal after it
    if (!subj && !inversion && F.lemma === 'be')
      subj = body.slice(fIdx + 1).find((u) => u.pos === 'NOUN');
    if (subj) {
      subjIdx = subj.pos === 'PRON' ? [subj.i] : npLeft(ts, subj, body[0].i);
      cl.subject = phrase(ts, subjIdx, subj);
      setDep(subj, 'nsubj', head);
      const w = who(subj);
      cl.subjectIsUser = w === 'user';
      cl.subjectIsAtlas = w === 'atlas';
      if (subj.x.pron) {
        cl.person = subj.x.pron.p;
        cl.number = subj.x.pron.n;
      } else {
        cl.person = 3;
        cl.number = subj.feats.number === 'pl' ? 'pl' : 'sg';
      }
      if (subj.norm === 'you' || subj.norm === 'u') cl.number = undefined;
    }
  }
  // objects & adverbials
  const hi = head ? head.i : -1;
  let k = 0;
  while (k < body.length) {
    const t = body[k];
    if (subjIdx.includes(t.i) || (head && t === head) || t.x.cont) {
      k++;
      continue;
    }
    if (t.pos === 'ADP') {
      // PP → obl adverbial
      const np: T[] = [];
      let q = k + 1;
      while (q < body.length && ['DET', 'ADJ', 'NUM', 'NOUN', 'PRON'].includes(body[q].pos))
        np.push(body[q++]);
      const h = [...np].reverse().find((u) => u.pos === 'NOUN' || u.pos === 'PRON');
      if (h) {
        setDep(t, 'case', h);
        setDep(h, 'obl', head);
        const sem =
          t.norm === 'for' &&
          np.some((u) => u.x.unit && /^(h|min|sec|day|week|month|year)$/.test(u.x.unit))
            ? 'duration'
            : np.some((u) => u.x.time)
              ? 'time'
              : /^(at|in|to|into)$/.test(t.norm) &&
                  /^(gym|home|office|work|park|pool|track)$/.test(h.lemma)
                ? 'place'
                : undefined;
        cl.adverbials.push(phrase(ts, [t.i, ...np.map((u) => u.i)], h, sem));
      }
      k = q;
      continue;
    }
    if (t.pos === 'ADV' || t.x.time) {
      setDep(t, 'advmod', head);
      if (t.x.sem || t.x.time)
        cl.adverbials.push(phrase(ts, [t.i], t, t.x.time ? 'time' : t.x.sem));
      k++;
      continue;
    }
    if (
      (t.pos === 'NOUN' || (t.pos === 'PRON' && t.x.pron?.c !== 'nom') || t.pos === 'ADJ') &&
      t.i > hi &&
      head
    ) {
      const np: T[] = [t];
      let q = k + 1;
      while (
        q < body.length &&
        ['NOUN', 'ADJ', 'NUM'].includes(body[q].pos) &&
        body[q].kind !== 'p'
      )
        np.push(body[q++]);
      const h =
        [...np].reverse().find((u) => u.pos === 'NOUN' || u.pos === 'PRON') ?? np[np.length - 1];
      const start = t.i > 0 && ts[t.i - 1].pos === 'DET' ? [ts[t.i - 1].i] : [];
      setDep(h, 'obj', head);
      cl.objects.push(phrase(ts, [...start, ...np.map((u) => u.i)], h));
      for (const u of np)
        if (u !== h)
          setDep(u, u.pos === 'ADJ' ? 'amod' : u.pos === 'NUM' ? 'nummod' : 'compound', h);
      k = q;
      continue;
    }
    if (t.pos === 'DET') setDep(t, 'det', body[k + 1]);
    if (t.pos === 'NUM') setDep(t, 'nummod', body[k + 1]);
    k++;
  }
  void ctx;
}

// ─────────────────────── free word order (uk ru pl lt et) ───────────────────────

const TIME_UNIT = /^(h|min|sec|day|week|month|year)$/;
const PAST_COP = /^(було|був|була|були|было|был|была|были|było|był|była|byli|buvo|oli)$/;
const FUT_COP = /^(буде|будуть|будет|будут|będzie|bus|saab)$/;

function parseFree(ts: T[], c: T[], cl: Clause, ctx: ParseCtx): void {
  const spec = ctx.spec;
  let k0 = 0;
  while (
    k0 < c.length &&
    (c[k0].x.disc ||
      c[k0].x.voc ||
      c[k0].x.please ||
      c[k0].pos === 'INTJ' ||
      c[k0].x.excl ||
      c[k0].x.corr)
  )
    k0++;
  const body = c.slice(k0);
  const wh = body.find((t) => !!t.x.wh);
  if (wh && cl.role !== 'subordinate' && body.indexOf(wh) <= 2) cl.whWord = wh.x.wh;
  const fins = body.filter(isFin);
  const infs = body.filter((t) => t.pos === 'VERB' && t.feats.form === 'inf');
  const predics = body.filter(
    (t) =>
      !!t.x.predic &&
      !(
        t.x.predic === 'eval' &&
        fins.some((f) => (f.pos === 'VERB' || f.pos === 'AUX') && !(f.x.cop && f.i < t.i))
      ),
  );
  const F: T | undefined = fins[0];
  // a modal predicative ("можна") beats an eval one
  let head: T | undefined;
  let tense: Tense | 'none' = 'none';
  const chain: T[] = [];
  let modality: Modality | undefined;
  let zeroIdx = -1;
  // copula as auxiliary of a predicative: "було важко"
  const copF =
    F &&
    F.x.cop &&
    (predics.length || zeroCopula(body, spec) >= 0) &&
    !body.some(
      (t) => t.pos === 'NOUN' && t.feats.case === 'nom' && t.i > F!.i && !zeroCopula(body, spec),
    )
      ? F
      : undefined;
  if (F && !copF) {
    chain.push(F);
    const inf = infs.find((t) => t.i > F!.i) ?? infs.find((t) => t.i < F!.i);
    if ((F.x.modal || F.x.aux === 'fut' || F.x.hort || F.x.modalTo) && inf) {
      head = inf;
      if (F.x.modal) modality = F.x.modal;
    } else if (F.x.hort) {
      const other = fins.find((t) => t !== F);
      head = other ?? F;
    } else head = F;
    const tf = F.x.hort && head !== F ? head : F;
    if (tf.feats.form === 'imp' || F.x.hort) tense = 'none';
    else if (F.x.aux === 'fut') tense = 'future';
    else if (
      tf.feats.tense === 'present' &&
      tf.feats.aspect === 'perfective' &&
      spec.lang !== 'et' &&
      !F.x.modal
    )
      tense = 'future';
    else tense = tf.feats.tense ?? 'present';
    if (F.x.modal && head !== F)
      tense =
        F.feats.tense === 'present' && F.feats.aspect === 'perfective'
          ? 'future'
          : (F.feats.tense ?? 'present');
  } else if (predics.length) {
    const p = predics.find((t) => t.x.predic !== 'eval') ?? predics[0];
    chain.push(p);
    if (copF) chain.push(copF);
    const inf = infs[0];
    head = inf ?? p;
    if (p.x.predic !== 'eval') modality = p.x.predic as Modality;
    tense = copF
      ? PAST_COP.test(copF.norm)
        ? 'past'
        : FUT_COP.test(copF.norm)
          ? 'future'
          : 'present'
      : 'present';
  } else if (
    copF &&
    infs.length &&
    (zeroIdx = zeroCopula(body, spec)) >= 0 &&
    zeroIdx < infs[0].i &&
    body.some((t) => t.pos === 'CONJ' && t.i > zeroIdx && t.i < infs[0].i)
  ) {
    head = copF;
    chain.push(copF);
    tense = copF.feats.tense ?? 'present';
  } else if (spec.lang === 'et' && copF && infs.length) {
    // "Kas parem on trenni teha…": copula + adjective, the infinitive phrase is the subject
    head = copF;
    tense = copF.feats.tense ?? 'present';
  } else if (infs.length) {
    head = infs[0];
    tense = 'none';
  } else if ((zeroIdx = zeroCopula(body, spec)) >= 0) {
    head = ts[zeroIdx];
    tense = copF
      ? PAST_COP.test(copF.norm)
        ? 'past'
        : FUT_COP.test(copF.norm)
          ? 'future'
          : 'present'
      : 'present';
    if (copF) {
      head = copF;
      chain.push(copF);
    }
  } else if (copF) {
    head = copF;
    chain.push(copF);
    tense = copF.feats.tense ?? 'present';
  }
  if (head && !chain.includes(head)) chain.push(head);
  {
    const lastPred = chain.length ? Math.max(...chain.map((t) => t.i)) : Infinity;
    cl.negated = body.some((t) => ((t.x.neg || t.feats.neg) && t.i <= lastPred) || t.x.negq);
  }
  cl.tense = tense;
  if (head) {
    const predIdx = chain.map((t) => t.i);
    for (const t of body)
      if (t.x.neg && t.i < head.i && t.i >= Math.min(...predIdx) - 2) predIdx.push(t.i);
    cl.predicate = phrase(
      ts,
      [...new Set(predIdx)].sort((a, b) => a - b),
      head,
    );
    setDep(head, 'root');
    for (const a of chain) if (a !== head) setDep(a, 'aux', head);
    for (const t of body) if (t.x.neg) setDep(t, 'neg', head);
    if (head.feats.aspect) cl.aspect = head.feats.aspect;
  }
  if (modality) cl.modality = modality;
  const Fv = F && !copF ? F : undefined;
  if (Fv && (Fv.feats.form === 'imp' || Fv.x.hort)) cl.mood = 'imperative';
  if (body.some((t) => t.feats.cond || /^(б|би|бы|by|bym|byś)$/.test(t.norm))) {
    cl.mood = 'conditional';
    // "я б хотів" = would like (present); past only with a counterfactual protasis ("якби знав…")
    const counterfactual = ts.some(
      (t, k) =>
        /^(якби|якбы|gdyby|jesliby|jezeliby)$/.test(t.lk) ||
        (/^(если|коли|якщо)$/.test(t.lk) && /^(б|би|бы)$/.test(ts[k + 1]?.lk ?? '')),
    );
    if (cl.tense === 'past' && !counterfactual) cl.tense = 'present';
  }
  // interrogative
  if (cl.role !== 'subordinate' && cl.mood !== 'imperative') {
    if (wh && body.indexOf(wh) <= 2) cl.interrogative = true;
    if (body.some((t, k) => t.x.qp && k <= 1)) cl.interrogative = true;
  }
  // subject
  let subj: T | undefined;
  const afterPrep = (t: T): boolean => {
    const k = body.indexOf(t);
    // "у мене все болить": the possessive MWE "у мене" does not govern the next word
    return k > 0 && body[k - 1].pos === 'ADP' && !body[k - 1].x.poss;
  };
  const nomPron = body.find(
    (t) =>
      t.pos === 'PRON' &&
      t.x.pron &&
      (t.feats.case === 'nom' || !t.feats.case) &&
      !afterPrep(t) &&
      !t.x.wh,
  );
  if (
    Fv &&
    Fv.feats.person === 2 &&
    !nomPron &&
    body.some((t) => t.pos === 'NOUN' && t.feats.case === 'nom' && !afterPrep(t) && t.i < Fv.i)
  ) {
    const c3 = Fv.cands.find(
      (c) => c.lemma === Fv.lemma && c.feats.person === 3 && c.feats.tense === Fv.feats.tense,
    );
    if (c3) Fv.feats = { ...Fv.feats, person: 3 };
  }
  const verbForAgr = Fv;
  if (nomPron && (!Fv || !Fv.feats.person || Fv.feats.person === nomPron.x.pron!.p || Fv.x.cop))
    subj = nomPron;
  const isPredicative = !Fv && !!head && (!!head.x.predic || predics.length > 0);
  const modalPredic = isPredicative && predics.some((p) => p.x.predic !== 'eval');
  const infHead = !!head && head.pos === 'VERB' && head.feats.form === 'inf' && (!Fv || Fv.x.hort);
  const zeroHead = !Fv && zeroIdx >= 0;
  const evalOnly = isPredicative && !modalPredic && !infHead;
  const lookNom = Fv
    ? !(Fv.feats.form === 'imp') && !Fv.x.impers && (!Fv.feats.person || Fv.feats.person === 3)
    : zeroHead || evalOnly || (!!copF && !infHead);
  if (!subj && lookNom) {
    const cands = body.filter(
      (t) =>
        t !== head &&
        !afterPrep(t) &&
        !t.mx.time &&
        !(
          t.x.unit &&
          (body[body.indexOf(t) - 1]?.pos === 'NUM' ||
            (TIME_UNIT.test(t.x.unit) &&
              ['ADJ', 'DET'].includes(body[body.indexOf(t) - 1]?.pos ?? '')))
        ) &&
        !(body[body.indexOf(t) - 1]?.pos === 'NUM' && !(isPredicative || zeroHead)) &&
        ((t.pos === 'NOUN' && spec.nomCapable(t) && t.feats.case !== 'acc') ||
          (t.pos === 'PRON' && !t.x.pron && spec.nomCapable(t) && t.feats.case !== 'dat') ||
          (t.pos === 'NUM' &&
            body[body.indexOf(t) + 1]?.pos === 'NOUN' &&
            (isPredicative || zeroHead))) &&
        !(t.x.wh && Fv && Fv.feats.person && Fv.feats.person !== 3),
    );
    const agrees = (t: T): boolean => {
      const v = verbForAgr;
      if (!v) return true;
      if (v.x.cop || v.x.impers) return true;
      const tn = t.feats.number;
      if (v.feats.number && tn && v.feats.number !== tn && t.pos !== 'NUM') return false;
      if (
        v.feats.gender &&
        t.feats.gender &&
        v.feats.number !== 'pl' &&
        v.feats.gender !== t.feats.gender
      )
        return false;
      return true;
    };
    const useful = cands.filter(agrees);
    const hi = Fv ? Fv.i : head ? head.i : 1e9;
    const beforeV = useful.filter((t) => t.i < hi);
    // after the verb only for 3rd-person present, reflexive or intransitive verbs ("болить коліно", "пішов дощ")
    const postOk =
      !Fv ||
      Fv.feats.tense !== 'past' ||
      /(ся|сь)$/.test(Fv.norm) ||
      INTRANS.test(Fv.lemma) ||
      !!Fv.x.cop ||
      // experiencer constructions: "мені набрид цей зал", "тобі сподобався план"
      body.some((t) => !!t.x.pron && t.feats.case === 'dat');
    const pickT =
      beforeV[0] ??
      (postOk
        ? useful.find(
            (t) =>
              t.i > hi &&
              !body.some(
                (u) =>
                  u.pos === 'VERB' &&
                  u.i > hi &&
                  u.i < t.i &&
                  !(u.feats.form === 'inf' && (!!Fv?.x.modal || Fv?.pos === 'AUX')),
              ),
          )
        : undefined);
    if (pickT) {
      subj = pickT;
      if (subj.pos === 'NUM') subj = body[body.indexOf(subj) + 1];
    }
  }
  if (
    !subj &&
    Fv &&
    head === Fv &&
    !Fv.x.impers &&
    !body.some((t) => !!t.x.pron && t.feats.case === 'dat') &&
    ((Fv.feats.tense === 'past' && Fv.feats.gender === 'n') ||
      (Fv.feats.person === 3 && Fv.feats.number === 'sg' && Fv.feats.tense === 'present'))
  ) {
    const q = body.find(
      (t, k) => t.pos === 'NUM' && body[k + 1]?.pos === 'NOUN' && !afterPrep(t) && t.i > Fv.i,
    );
    if (q) subj = body[body.indexOf(q) + 1];
  }
  let implicit: 'user' | 'atlas' | 'other' | undefined;
  let person: 1 | 2 | 3 | undefined;
  let number: 'sg' | 'pl' | undefined;
  if (subj) {
    const w = who(subj);
    implicit = w;
    if (subj.x.pron) {
      person = subj.x.pron.p;
      number = subj.x.pron.n;
    } else {
      person = 3;
      number = subj.feats.number ?? 'sg';
    }
    const np = subj.pos === 'PRON' ? [subj.i] : npLeft(ts, subj, body[0].i);
    cl.subject = phrase(ts, np, subj);
    setDep(subj, 'nsubj', head);
  } else if (Fv && (Fv.feats.form === 'imp' || Fv.x.hort)) {
    const h = head && head !== Fv ? head : Fv;
    if (Fv.x.hort || (h.feats.person === 1 && h.feats.number === 'pl')) {
      implicit = 'user';
      person = 1;
      number = 'pl';
    } else {
      implicit = 'atlas';
      person = 2;
      number = h.feats.number;
    }
  } else if (Fv && !Fv.x.impers && !(Fv.x.cop && !Fv.feats.person)) {
    const p = Fv.feats.person;
    if (p === 1) implicit = 'user';
    else if (p === 2) implicit = 'atlas';
    else if (p === 3) implicit = 'other';
    else if (Fv.feats.tense === 'past' && Fv.feats.gender !== 'n') implicit = 'user';
    person = p ?? (implicit === 'user' ? 1 : undefined);
    number = Fv.feats.number;
    if (spec.lang === 'et' && !p && Fv.feats.tense === 'past') implicit = 'user';
  } else if (!Fv && copF && (copF.feats.person === 1 || copF.feats.person === 2)) {
    // "jestem głodny", "olen väsinud", "esu pavargęs": the copula's person ending
    implicit = copF.feats.person === 1 ? 'user' : 'atlas';
    person = copF.feats.person;
    number = copF.feats.number;
  }
  const dativeExp = (): boolean =>
    body.some(
      (t) =>
        !!t.x.pron &&
        (t.feats.case === 'dat' || (spec.lang === 'et' && t.feats.case === 'loc')) &&
        t.x.pron.p !== 3,
    );
  // impersonal use of a personal verb: 3sg present / neuter past without a nominative ("мені болить", "мені набридло")
  const impUse =
    !!Fv &&
    !Fv.x.cop &&
    Fv.feats.form === 'fin' &&
    ((Fv.feats.person === 3 && Fv.feats.number === 'sg' && Fv.feats.tense === 'present') ||
      (Fv.feats.tense === 'past' && Fv.feats.gender === 'n')) &&
    !body.some(
      (t) =>
        t !== head &&
        !afterPrep(t) &&
        ((t.pos === 'NOUN' && t.feats.case === 'nom' && spec.nomCapable(t)) ||
          (t.pos === 'NUM' && body[body.indexOf(t) + 1]?.pos === 'NOUN') ||
          (t.pos === 'PRON' &&
            (!t.x.pron || t.x.pron.p === 3) &&
            !t.x.wh &&
            (t.feats.case === 'nom' || !t.feats.case))),
    );
  if (
    !subj &&
    (!implicit || isPredicative || (Fv && (Fv.x.impers || Fv.x.cop)) || (!Fv && head) || impUse)
  ) {
    // dative experiencer: мені треба, man reikia, mul on vaja; "в мене колить"
    const dat = body.find(
      (t) =>
        t.x.pron &&
        (t.feats.case === 'dat' || (spec.lang === 'et' && t.feats.case === 'loc')) &&
        t.x.pron.p !== 3 &&
        !afterPrep(t),
    );
    const possT = impUse ? body.find((t) => t.x.poss && t.pos !== 'PRON') : undefined;
    const possP = possT
      ? /^(мене|меня|нас|mnie)$/.test(ts[possT.i + 1]?.lk ?? '')
        ? 1
        : /^(тебе|тебя|ciebie)$/.test(ts[possT.i + 1]?.lk ?? '')
          ? 2
          : undefined
      : undefined;
    if (dat && (isPredicative || !Fv || Fv.x.impers || Fv.x.cop || impUse)) {
      implicit = dat.x.pron!.p === 1 ? 'user' : 'atlas';
      person = dat.x.pron!.p;
      number = dat.x.pron!.n;
    } else if (possP) {
      implicit = possP === 1 ? 'user' : 'atlas';
      person = possP;
    } else if (
      !Fv &&
      head &&
      head.pos === 'ADJ' &&
      zeroIdx >= 0 &&
      !body.some((t) => t.pos === 'NOUN' && spec.nomCapable(t) && !afterPrep(t))
    ) {
      // "постійно втомлений", "не впевнений": the speaker
      if (head.feats.number !== 'pl') {
        implicit = 'user';
        person = 1;
        number = 'sg';
      }
    } else if (Fv && Fv.x.impers) {
      implicit = undefined;
      person = undefined;
    }
  }
  // extraposed subject: "Ar normalu, kad…", "Kas on normaalne, et…", "czy to normalne",
  // "Kas parem on trenni teha" — the clause / demonstrative / infinitive is the subject
  if (!subj && head && implicit !== 'atlas' && !(implicit === 'user' && Fv)) {
    const lastI = Math.max(...cl.tokenIdx);
    const nx = ts.slice(lastI + 1).find((k) => k.kind === 'w');
    const evalHead =
      head.x.predic === 'eval' || head.pos === 'ADJ' || (!!copF && head === copF) || zeroIdx >= 0;
    const demo = body.some((t) => /^(to|це|это|tai|see)$/.test(t.lk) && t.i < head.i);
    const compAfter =
      !!nx && /^(що|шо|что|ze|że|kad|et)$/.test(nx.lk) && ts[nx.i - 1]?.kind === 'p';
    const etInf = spec.lang === 'et' && !!copF && head === copF && infs.length > 0;
    if (evalHead && (demo || compAfter || etInf) && !dativeExp()) {
      implicit = 'other';
      person = 3;
      number = 'sg';
    }
  }
  // possession / wh + nominative zero copula: "в мене тільки гантелі", "де мій графік"
  if (!head && !subj && !Fv) {
    const nomN = body.find(
      (t) =>
        t.pos === 'NOUN' &&
        spec.nomCapable(t) &&
        t.feats.case !== 'acc' &&
        !afterPrep(t) &&
        !t.mx.time,
    );
    if (nomN && (body.some((t) => t.x.poss) || (!!wh && !wh.x.about))) {
      cl.tense = 'present';
      implicit = 'other';
      person = 3;
      number = nomN.feats.number ?? 'sg';
      cl.subject = phrase(ts, [nomN.i], nomN);
    }
  }
  // "Моя мета — пожати 100 кг": nominal subject, dash, infinitive predicate
  if (
    !subj &&
    head &&
    head.feats.form === 'inf' &&
    !Fv &&
    !isPredicative &&
    cl.tokens.some((t) => t.norm === '—' || t.norm === '–')
  ) {
    const n = body.find(
      (t) => t.pos === 'NOUN' && spec.nomCapable(t) && t.i < head.i && !afterPrep(t),
    );
    if (n) {
      cl.tense = 'present';
      implicit = 'other';
      person = 3;
      number = n.feats.number ?? 'sg';
      cl.subject = phrase(ts, [n.i], n);
    }
  }
  cl.subjectIsUser = implicit === 'user';
  cl.subjectIsAtlas = implicit === 'atlas';
  if (person) cl.person = person;
  if (number) cl.number = number;
  if (cl.interrogative) cl.mood = 'interrogative';
  // objects / adverbials
  for (let k = 0; k < body.length; k++) {
    const t = body[k];
    if (t === subj || t === head || chain.includes(t)) continue;
    if (t.pos === 'ADP') {
      if (t.x.poss) continue;
      let q = t.i + 1;
      while (
        ts[q] &&
        (ts[q].pos === 'DET' || ts[q].pos === 'ADJ' || ts[q].pos === 'NUM' || ts[q].x.cont)
      )
        q++;
      const n =
        ts[q] && (ts[q].pos === 'NOUN' || ts[q].pos === 'PRON') && ts[q] !== subj
          ? ts[q]
          : undefined;
      if (n && n.i - t.i <= 3) {
        setDep(t, 'case', n);
        setDep(n, 'obl', head);
        const span = body.filter((u) => u.i >= t.i && u.i <= n.i).map((u) => u.i);
        const sem = body.slice(k, k + 4).some((u) => u.x.time) ? 'time' : undefined;
        cl.adverbials.push(phrase(ts, span, n, sem));
      }
      continue;
    }
    if (t.pos === 'ADV' || t.x.time) {
      setDep(t, 'advmod', head);
      if (t.x.sem || t.x.time)
        cl.adverbials.push(phrase(ts, [t.i], t, t.x.time ? 'time' : t.x.sem));
      continue;
    }
    if (
      t.pos === 'NOUN' &&
      head &&
      !afterPrep(t) &&
      body[k - 1]?.pos !== 'NUM' &&
      !(body[k - 1]?.pos === 'NOUN' && t.feats.case === 'gen')
    ) {
      setDep(t, 'obj', head);
      cl.objects.push(phrase(ts, npRight(ts, t, t.i).length ? [t.i] : [t.i], t));
      continue;
    }
    if (t.pos === 'ADJ') setDep(t, 'amod', body[k + 1]);
    if (t.pos === 'NUM') setDep(t, 'nummod', body[k + 1]);
  }
}
