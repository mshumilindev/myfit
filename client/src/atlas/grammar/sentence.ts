/** Sentence type and question kind from the parsed clauses. */
import type { LangSpec, T } from './core';
import type { Seg } from './clauses';
import type { Clause, QuestionKind, SentenceType, WhWord } from './types';

export interface Typed {
  type: SentenceType;
  questionKind?: QuestionKind;
  whWord?: WhWord;
  mainClause: number;
  questionClause?: number;
}

const OR_WORDS: Record<string, RegExp> = {
  en: /^(or)$/,
  uk: /^(чи|або|альбо|чи то)$/,
  ru: /^(или|либо|чи)$/,
  pl: /^(czy|albo|lub)$/,
  lt: /^(ar|arba)$/,
  et: /^(voi|ehk)$/,
};

const RHET_NEED =
  /^(потрібен|потрібна|потрібно|потрібні|треба|нужен|нужна|нужно|надо|нада|potrzebny|reikia|vaja)$/;
const SECOND_MODAL =
  /^(можеш|можете|можна|могли|зможеш|можешь|можете|możesz|gali|galite|saad|võid|could|can)$/;

export function typeSentence(ts: T[], segs: Seg[], clauses: Clause[], spec: LangSpec): Typed {
  const words = ts.filter((t) => t.kind === 'w' || t.kind === 'n');
  const puncts = ts.filter((t) => t.kind === 'p');
  const lastP =
    puncts.length &&
    ts
      .slice()
      .reverse()
      .find((t) => t.kind !== 'e') === puncts[puncts.length - 1]
      ? puncts[puncts.length - 1].text
      : '';
  const endQ = /\?/.test(lastP) || /\?\s*[!.]*$/.test(ts.map((t) => t.text).join(''));
  const endEx = !endQ && /!/.test(lastP);
  let main = clauses.findIndex((c) => c.role === 'main');
  if (main < 0) main = 0;
  const indep = clauses.map((c, k) => (c.role !== 'subordinate' ? k : -1)).filter((k) => k >= 0);
  // particle "or not" / "чи ні" at the end makes a yes/no question
  const orNot =
    words.some((t) => t.x.orNot) ||
    /(^|\s)(чи ні|або ні|или нет|czy nie|ar ne|või mitte|voi mitte)\s*[?!.]*$/i.test(
      ts.map((t) => t.norm).join(' '),
    );
  // Ukrainian / Russian request without '?': "можеш зробити…", "мені нада … чи ні"
  for (const k of indep) {
    const c = clauses[k];
    const first = (c.tokens as T[]).find((t) => (t.pos === 'VERB' || t.pos === 'AUX') && !t.x.disc);
    const fc = (c.tokens as T[]).filter((t) => t.kind === 'w' && !t.x.disc && !t.x.voc)[0];
    if (
      !c.interrogative &&
      fc &&
      first === fc &&
      SECOND_MODAL.test(fc.norm) &&
      spec.lang !== 'en' &&
      c.mood !== 'imperative'
    )
      c.interrogative = true;
  }
  // sentence-final "це нормально" without '?' in a message that reports pain / soreness
  if (!endQ && spec.lang !== 'en') {
    const lc = clauses[clauses.length - 1];
    const lw = (lc.tokens as T[]).filter((t) => t.kind === 'w').map((t) => t.norm);
    if (
      lw.length <= 3 &&
      /^(нормально|норм|ок|окей|это нормально|це нормально)$/.test(
        lw
          .filter((w) => w === 'це' || w === 'это' || /^(нормально|норм|ок|окей)$/.test(w))
          .join(' '),
      ) &&
      clauses.length > 1 &&
      lc.role !== 'subordinate'
    )
      lc.interrogative = true;
  }
  // Ukrainian / Polish "X чи Y" inside a clause asks a choice question even without '?'
  if (spec.lang === 'uk' || spec.lang === 'pl' || spec.lang === 'lt') {
    for (const k of indep) {
      const toks = (clauses[k].tokens as T[]).filter(
        (t) => t.kind === 'w' && !t.x.disc && !t.x.corr,
      );
      if (
        toks.some(
          (t, j) => j > 0 && (t.norm === 'чи' || t.lk === 'czy' || t.lk === 'ar') && !t.x.orNot,
        )
      )
        clauses[k].interrogative = true;
    }
  }
  // "…any tips", "any ideas": a closing request for advice asks a question
  if (!endQ && spec.lang === 'en' && indep.length) {
    const lw = words.slice(-2).map((t) => t.norm);
    if (
      lw[0] === 'any' &&
      /^(tips|ideas|advice|suggestions|thoughts|recommendations)$/.test(lw[1] ?? '')
    )
      clauses[indep[indep.length - 1]].interrogative = true;
  }
  let qs = indep.filter((k) => clauses[k].interrogative);
  if (!qs.length && (endQ || orNot) && indep.length) {
    const last = indep[indep.length - 1];
    clauses[last].interrogative = true;
    clauses[last].mood = 'interrogative';
    qs = [last];
  }
  const tag =
    segs.some((s) => s.tag) ||
    words.some((t) => t.x.tag && t === words[words.length - 1] && endQ && words.length > 2);
  if (tag && !qs.length && indep.length) qs = [indep[indep.length - 1]];
  const isQ = qs.length > 0;
  // embedded wh (complement clause)
  const compWh = (): WhWord | undefined => {
    for (let k = 0; k < clauses.length; k++) {
      const s = segs[k];
      if (clauses[k].role === 'subordinate' && clauses[k].kind === 'complement') {
        const l = s.lead !== undefined ? ts[s.lead] : undefined;
        if (l && l.x.wh) return l.x.wh;
      }
    }
    return undefined;
  };
  if (isQ) {
    const withWh = qs.find((k) => clauses[k].whWord);
    const q = withWh ?? qs[qs.length - 1];
    const qc = clauses[q];
    let kind: QuestionKind;
    let wh = qc.whWord;
    const qTok = qc.tokens as T[];
    const rhet =
      qTok.some((t) => t.x.rhet) ||
      (qTok.some((t) => t.norm === 'who') &&
        qTok.some((t) => /^(care|cares|knows)$/.test(t.norm))) ||
      (qTok.some((t) => t.norm === 'кому' || t.norm === 'кому') &&
        qTok.some((t) => RHET_NEED.test(t.norm)));
    const orRe = OR_WORDS[spec.lang];
    const choice =
      !orNot &&
      words.some((t, k) => {
        if (!orRe.test(t.lk) || t.x.cont) return false;
        if (spec.lang === 'en') return t.pos === 'CONJ';
        // non-initial "чи" / "czy" / "ar" inside a clause = "or"
        const cl = clauses.find((c) => c.tokenIdx.includes(t.i));
        const firstW =
          cl && (cl.tokens as T[]).find((u) => u.kind === 'w' && !u.x.disc && !u.x.corr);
        if (firstW !== t) return k > 0;
        // clause-initial "чи" after an evaluative question clause = alternative
        const ci = cl ? clauses.indexOf(cl) : -1;
        const prevC = ci > 0 ? clauses[ci - 1] : undefined;
        if (!prevC) return false;
        const pw = (prevC.tokens as T[]).filter((u) => u.kind === 'w' && !u.x.disc && !u.x.corr);
        return !!pw[0] && (!!pw[0].x.predic || !!pw[0].x.qp || prevC.interrogative);
      });
    if (tag) kind = 'tag';
    else if (rhet) {
      kind = 'rhetorical';
      if (!wh) wh = qTok.find((t) => t.x.wh)?.x.wh;
    } else if (wh) kind = 'wh';
    else if (choice) kind = 'choice';
    else {
      const cw = compWh();
      if (cw) {
        kind = 'wh';
        wh = cw;
      } else kind = 'yesno';
    }
    return {
      type: 'question',
      questionKind: kind,
      ...(wh ? { whWord: wh } : {}),
      mainClause: main,
      questionClause: q,
    };
  }
  const wh = compWh();
  const mc = clauses[main];
  const lastIndep = indep.length ? clauses[indep[indep.length - 1]] : undefined;
  // "Я поспішаю, дай щось на 20 хвилин": a closing imperative makes the message a request
  if ((mc && mc.mood === 'imperative') || (lastIndep && lastIndep.mood === 'imperative'))
    return { type: 'command', ...(wh ? { whWord: wh } : {}), mainClause: main };
  if (endEx) return { type: 'exclamation', ...(wh ? { whWord: wh } : {}), mainClause: main };
  return { type: 'statement', ...(wh ? { whWord: wh } : {}), mainClause: main };
}
