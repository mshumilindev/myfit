/**
 * Atlas grammar analyser — rule-based, offline, lazy-loadable.
 *
 *   analyze(text, lang?)  → sentences → clauses → tokens (POS, lemma, feats, deps)
 *   focus(analysis)       → routing summary (what is asked, self-report, complaint, quantities…)
 *
 * Pipeline: tokenize → split sentences → detect language (+ transliteration) →
 * lexicon & morphology candidates → multi-word expressions → contextual POS
 * disambiguation → clause segmentation → per-clause shallow dependency parse →
 * sentence type / question kind.
 */
import { segment } from './clauses';
import { applyMwe, cand, type LangSpec, type MWE, type T } from './core';
import { detect } from './detect';
import { EN, enLex } from './lang/en';
import { ET } from './lang/et';
import { LT } from './lang/lt';
import { PL } from './lang/pl';
import { RU, UK } from './lang/slav';
import { TIME, unitOf } from './lex/measure';
import { parseClause } from './parse';
import { quantities, timeRefs } from './quant';
import { typeSentence } from './sentence';
import { fold, splitSentences, tokenize, type RawTok } from './tokenize';
import { detransliterate } from './translit';
import type { Analysis, Clause, Focus, Lang, Sentence, Token } from './types';

export type * from './types';

const SPECS: Record<Lang, LangSpec> = { en: EN, uk: UK, ru: RU, pl: PL, lt: LT, et: ET };

const timeMwes: Partial<Record<Lang, MWE[]>> = {};
function timeList(lang: Lang): MWE[] {
  let l = timeMwes[lang];
  if (!l) {
    l = TIME[lang]
      .split('|')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [ws, id] = p.split('=');
        return { words: ws.trim().split(/\s+/), x: { time: id.trim(), sem: 'time' as const } };
      });
    timeMwes[lang] = l;
  }
  return l;
}

const LATIN: Lang[] = ['en', 'pl', 'lt', 'et'];

function mkTokens(raw: RawTok[], spec: LangSpec): T[] {
  const latin = LATIN.includes(spec.lang);
  return raw.map((r, i) => {
    const lk = latin ? fold(r.norm) : r.norm;
    const t: T = {
      text: r.text,
      norm: r.norm,
      lemma: r.norm,
      pos: 'X',
      feats: {},
      start: r.start,
      i,
      x: {},
      mx: {},
      cands: [],
      lk,
      kind: r.kind,
    };
    if (r.kind === 'w') {
      t.cands = [...spec.analyze(r.norm, lk)];
      for (const a of r.alt ?? []) {
        for (const c of spec.analyze(a, a)) {
          if (
            !t.cands.some(
              (k) =>
                k.pos === c.pos &&
                k.lemma === c.lemma &&
                k.feats.form === c.feats.form &&
                k.feats.case === c.feats.case,
            )
          )
            t.cands.push(c);
        }
      }
    } else if (r.kind === 'n') t.cands = [cand('NUM', r.norm, {}, { num: Number(r.norm) })];
    else if (r.kind === 'p') t.cands = [cand('PUNCT', r.norm)];
    else t.cands = [cand('X', r.norm)];
    if (r.kind === 'w') {
      const u = unitOf(spec.lang, lk.split('-')[0]);
      if (u) {
        t.x.unit = u;
        t.mx.unit = u;
      }
    }
    return t;
  });
}

function toPublic(t: T): Token {
  const o: Token = {
    text: t.text,
    norm: t.norm,
    lemma: t.lemma,
    pos: t.pos,
    feats: t.feats,
    start: t.start,
  };
  if (t.dep) o.dep = t.dep;
  if (t.head !== undefined) o.head = t.head;
  return o;
}

const COGN_EN = (): Set<string> => enLex().cogn;

function analyzeSentence(raw: RawTok[], spec: LangSpec): { s: Sentence; ts: T[] } {
  const ts = mkTokens(raw, spec);
  applyMwe(ts, timeList(spec.lang), (t) => t.lk);
  applyMwe(ts, spec.mwe, (t) => (LATIN.includes(spec.lang) ? t.lk : t.norm));
  spec.disambig(ts);
  const text = raw.map((r) => r.text);
  const question = /\?/.test(text.join(''));
  const cogn = spec.cogn ?? ((t: T) => COGN_EN().has(t.lemma));
  const segs = segment(ts, { spec, cogn, question });
  const pastCtx =
    ts.some(
      (t) => (t.pos === 'VERB' || t.pos === 'AUX') && t.feats.tense === 'past' && t.lemma !== 'can',
    ) || ts.some((t) => /^(yesterday|last_|day_before)/.test(t.x.time ?? ''));
  const clauses: Clause[] = segs.map((s) =>
    parseClause(ts, s, { spec, sentenceQuestion: question, pastCtx }),
  );
  const typed = typeSentence(ts, segs, clauses, spec);
  const pub = ts.map(toPublic);
  for (const c of clauses) {
    c.tokens = c.tokenIdx.map((i) => pub[i]);
  }
  return {
    s: {
      text: raw.map((r) => r.text).join(' '),
      ...typed,
      clauses,
      tokens: pub,
    },
    ts,
  };
}

interface Internal {
  quant: ReturnType<typeof quantities>;
  times: string[];
}
const internals = new WeakMap<Analysis, Internal>();

/** Analyse a chat message. `lang` skips detection. */
export function analyze(text: string, lang?: Lang): Analysis {
  let raw = tokenize(text);
  const det = lang ? { lang, translit: undefined as boolean | undefined } : detect(raw);
  let translit = false;
  if (
    (det.lang === 'uk' || det.lang === 'ru') &&
    raw.some((t) => t.kind === 'w' && /[a-z]/.test(t.norm)) &&
    !raw.some((t) => /[Ѐ-ӿ]/.test(t.norm))
  ) {
    raw = detransliterate(raw, det.lang);
    translit = true;
  }
  const spec = SPECS[det.lang];
  const toks = spec.expand ? spec.expand(raw) : raw;
  const spans = splitSentences(text, toks);
  const sentences: Sentence[] = [];
  const quant: Internal['quant'] = [];
  const times: string[] = [];
  spans.forEach(([a, b], k) => {
    const part = toks.slice(a, b);
    const { s, ts } = analyzeSentence(part, spec);
    const from = part[0].start;
    const lastT = part[part.length - 1];
    s.text = text.slice(from, lastT.start + lastT.text.length);
    sentences.push(s);
    quant.push(...quantities(ts, spec.lang, k));
    times.push(...timeRefs(ts));
  });
  const out: Analysis = { lang: det.lang, sentences, ...(translit ? { translit: true } : {}) };
  internals.set(out, { quant, times });
  return out;
}

const HELP =
  /^(help|advice|advise|tip|tips|recommend|suggest|допомогти|допоможи|підказати|підкажи|порадити|порадь|порада|помочь|помоги|подсказать|посоветовать|pomóc|pomoz|pomóż|poradzić|padėti|padek|patarti|aitama|aita|soovitama)$/;
/** Complaint vocabulary (stems, so prefixed forms like "проігнорував" match). */
const COMPLAIN =
  /(ignor|forg[eo]t|wrong|useless|stupid|broken|ігнор|забу|помиля|игнор|забы|ошиба|zapomn|ignoru|pamir|ignoree|unusta)/;

/** Routing summary of an analysis. */
export function focus(a: Analysis): Focus {
  const inner = internals.get(a) ?? { quant: [], times: [] };
  const qs = a.sentences.filter((s) => s.type === 'question');
  const fs = qs.length ? qs[qs.length - 1] : a.sentences[0];
  const empty: Focus = {
    askedAbout: [],
    isReportAboutSelf: false,
    isComplaint: false,
    isRequestForHelp: false,
    isQuestion: false,
    timeRefs: [],
    quantities: [],
    conditionals: [],
    negated: false,
  };
  if (!fs) return empty;
  const ci = fs.questionClause ?? fs.mainClause;
  const cl = fs.clauses[ci] ?? fs.clauses[0];
  const asked: string[] = [];
  const addL = (l?: string): void => {
    if (l && !asked.includes(l)) asked.push(l);
  };
  if (cl) {
    const isPron = (p: { tokens: number[] }): boolean =>
      p.tokens.every((i) => fs.tokens[i]?.pos === 'PRON' || fs.tokens[i]?.pos === 'DET');
    for (const o of cl.objects) if (!isPron(o)) addL(o.lemma);
    for (const ad of cl.adverbials) if (!ad.sem && !isPron(ad)) addL(ad.lemma);
    const st = cl.subject && cl.tokens.find((t) => t.lemma === cl.subject?.lemma);
    if (st && st.pos === 'NOUN') addL(st.lemma);
    if (!asked.length)
      for (const t of cl.tokens) if (t.pos === 'NOUN' && !t.dep?.startsWith('nsubj')) addL(t.lemma);
  }
  const all = a.sentences.flatMap((s) => s.clauses.map((c) => ({ s, c })));
  const isReportAboutSelf = all.some(
    ({ s, c }) =>
      c.subjectIsUser &&
      c.tense === 'past' &&
      !c.interrogative &&
      c.role !== 'subordinate' &&
      s.type !== 'command',
  );
  const isComplaint = all.some(({ s, c }) => {
    const why = s.whWord === 'why' || c.whWord === 'why';
    const toAtlas = c.subjectIsAtlas || (!c.subject && why && c.negated);
    if (!toAtlas) return false;
    if (c.negated && (why || s.type !== 'question')) return true;
    return c.tokens.some((t) => COMPLAIN.test(t.lemma));
  });
  const isRequestForHelp = a.sentences.some(
    (s) =>
      s.type === 'command' ||
      (s.type === 'question' &&
        s.clauses.some(
          (c) =>
            (c.subjectIsUser && (!!c.modality || !!s.whWord)) ||
            (c.subjectIsAtlas && (c.modality === 'can' || c.mood === 'conditional')) ||
            (!c.subject && !!s.whWord && s.whWord !== 'why') ||
            (!!c.modality && !c.subject),
        )) ||
      s.tokens.some((t) => HELP.test(t.lemma)),
  );
  const conditionals: Focus['conditionals'] = [];
  for (const s of a.sentences) {
    s.clauses.forEach((c, k) => {
      if (c.role === 'subordinate' && c.kind === 'conditional') {
        const then =
          s.clauses[s.mainClause] !== c
            ? s.clauses[s.mainClause]
            : s.clauses.find((x, j) => j !== k && x.role !== 'subordinate');
        if (then) conditionals.push({ if: c, then });
      }
    });
  }
  const mc = fs.clauses[fs.mainClause];
  return {
    askedAbout: asked,
    ...(cl?.predicate ? { action: cl.predicate.lemma } : {}),
    isReportAboutSelf,
    isComplaint,
    isRequestForHelp,
    isQuestion: qs.length > 0,
    ...(fs.whWord ? { whWord: fs.whWord } : {}),
    ...(inner.times[0] ? { timeRef: inner.times[0] } : {}),
    timeRefs: inner.times,
    quantities: inner.quant,
    conditionals,
    negated: !!mc?.negated,
  };
}
