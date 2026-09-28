/** Scores the analyser against a gold set (used by the tests and the accuracy report). */
import type { GoldRow, RowLang } from './gold';
import { analyze, focus } from './index';
import type { Analysis, ClauseKind, Sentence } from './types';

export const FIELDS = [
  'lang',
  'type',
  'questionKind',
  'whWord',
  'clauses',
  'pred',
  'subject',
  'tense',
  'negation',
  'person',
  'quantities',
  'timeRef',
] as const;
export type Field = (typeof FIELDS)[number];

const KIND: Record<ClauseKind, string> = {
  conditional: 'cond',
  causal: 'caus',
  temporal: 'temp',
  concessive: 'conc',
  purpose: 'purp',
  relative: 'rel',
  complement: 'comp',
  result: 'res',
  comparison: 'compar',
};

export interface Expected {
  type: string;
  questionKind: string;
  whWord: string;
  clauses: string;
  pred: string;
  subject: string;
  tense: string;
  negation: string;
  person: string;
  quantities: string;
  timeRef: string;
}

const TYPE: Record<string, string> = {
  s: 'statement',
  q: 'question',
  c: 'command',
  e: 'exclamation',
};

export function parseSpec(spec: string): Expected {
  const [a, cl, p, q, tm] = spec.split('|').map((x) => x.trim());
  const [ty, qk = '', wh = ''] = a.split('/');
  const [pred, subj, tense, neg, person] = p.split(/\s+/);
  return {
    type: TYPE[ty],
    questionKind: qk,
    whWord: wh,
    clauses: cl,
    pred,
    subject: subj,
    tense,
    negation: neg === '+' ? 'yes' : 'no',
    person,
    quantities: normQ(q ?? ''),
    timeRef: tm ?? '',
  };
}

function normQ(s: string): string {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .sort()
    .join(', ');
}

export function actual(a: Analysis, s: Sentence, si: number): Expected {
  const m = s.clauses[s.mainClause] ?? s.clauses[0];
  const f = focus(a);
  const subj = !m
    ? 'none'
    : m.subjectIsUser
      ? 'user'
      : m.subjectIsAtlas
        ? 'atlas'
        : m.subject || m.person === 3
          ? 'other'
          : 'none';
  return {
    type: s.type,
    questionKind: s.questionKind ?? '',
    whWord: s.whWord ?? '',
    clauses: s.clauses
      .map((c) =>
        c.role === 'main'
          ? 'main'
          : c.role === 'coordinate'
            ? 'coord'
            : `sub:${c.kind ? KIND[c.kind] : '?'}`,
      )
      .join(','),
    pred: m?.predicate?.lemma ?? '-',
    subject: subj,
    tense: m?.tense ?? 'none',
    negation: m?.negated ? 'yes' : 'no',
    person: String(m?.person ?? 0),
    quantities: normQ(
      f.quantities
        .filter((q) => q.sentence === si)
        .map((q) => `${q.value} ${q.unit}`)
        .join(','),
    ),
    timeRef: f.timeRefs[0] ?? '',
  };
}

export type Group = 'en' | 'uk' | 'ru+' | 'pl' | 'lt' | 'et';
export const groupOf = (l: RowLang): Group =>
  l === 'en'
    ? 'en'
    : l === 'uk'
      ? 'uk'
      : l === 'pl'
        ? 'pl'
        : l === 'lt'
          ? 'lt'
          : l === 'et'
            ? 'et'
            : 'ru+';

const LANG_OK: Record<RowLang, string[]> = {
  en: ['en'],
  uk: ['uk'],
  ru: ['ru'],
  pl: ['pl'],
  lt: ['lt'],
  et: ['et'],
  sz: ['uk', 'ru'],
  'uk-tr': ['uk'],
  'ru-tr': ['ru'],
};

export interface Report {
  stats: Record<Group, Record<Field, { ok: number; n: number }>>;
  errors: { lang: RowLang; text: string; field: Field; exp: string; got: string }[];
}

export function score(rows: GoldRow[]): Report {
  const stats = {} as Report['stats'];
  const errors: Report['errors'] = [];
  for (const [lang, text, spec] of rows) {
    const g = groupOf(lang);
    stats[g] ??= Object.fromEntries(FIELDS.map((f) => [f, { ok: 0, n: 0 }])) as Record<
      Field,
      { ok: number; n: number }
    >;
    const exp = parseSpec(spec);
    const a = analyze(text);
    const got = actual(a, a.sentences[0], 0);
    const row: Record<Field, [string, string]> = {
      lang: [LANG_OK[lang].join('|'), a.lang],
      type: [
        exp.type,
        a.sentences.length > 1 ? `${got.type}(+${a.sentences.length - 1} sent)` : got.type,
      ],
      questionKind: [exp.questionKind, got.questionKind],
      whWord: [exp.whWord, got.whWord],
      clauses: [exp.clauses, got.clauses],
      pred: [exp.pred, got.pred],
      subject: [exp.subject, got.subject],
      tense: [exp.tense, got.tense],
      negation: [exp.negation, got.negation],
      person: [exp.person, got.person],
      quantities: [exp.quantities, got.quantities],
      timeRef: [exp.timeRef, got.timeRef],
    };
    for (const f of FIELDS) {
      const [e, gv] = row[f];
      const ok = f === 'lang' ? LANG_OK[lang].includes(gv) : e === gv;
      stats[g][f].n++;
      if (ok) stats[g][f].ok++;
      else errors.push({ lang, text, field: f, exp: e, got: gv });
    }
  }
  return { stats, errors };
}

export function table(r: Report): string {
  const groups = Object.keys(r.stats) as Group[];
  const head = `| field | ${groups.map((g) => `${g} (n=${r.stats[g].type.n})`).join(' | ')} |`;
  const sep = `|---|${groups.map(() => '---').join('|')}|`;
  const lines = FIELDS.map(
    (f) =>
      `| ${f} | ${groups.map((g) => ((100 * r.stats[g][f].ok) / r.stats[g][f].n).toFixed(1)).join(' | ')} |`,
  );
  return [head, sep, ...lines].join('\n');
}
