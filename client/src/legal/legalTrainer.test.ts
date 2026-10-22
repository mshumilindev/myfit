/**
 * Contracts of the DRAFT Trainer Terms + DPA texts (SPO-289): the visible markers are exactly the pending items (release
 * blockers), uk/pl keep the English structure and markers, no invented numbers, no overclaims, the sub-processors follow
 * docs/compliance/processors.md, one `trainer-terms` kind with a versioned text hash of both documents.
 */
import { describe, expect, it } from 'vitest';
import { LEGAL_TRAINER_LOCALES, legalTrainerTexts } from '../i18n/legalTrainer';
import type { DocBlock, LegalDocText } from '../i18n/legal.types';
import { RELEASED_VERSIONS, LEGAL_VERSIONS, HASH_REQUIRED_KINDS } from './consents';
import { PENDING } from './pending';
import { sha256Hex } from './textHash';
import { TRAINER_DOC_IDS, trainerTermsHashInput, trainerTermsNeeded } from './trainerTerms';
import type { ConsentRecord } from './consents';

const strings = (b: DocBlock): string[] =>
  'p' in b ? [b.p] : 'ul' in b ? [...b.ul] : [...b.table.head, ...b.table.rows.flat()];
const docs = (l: 'en' | 'uk' | 'pl'): Record<'trainer-terms' | 'dpa', LegalDocText> => ({
  'trainer-terms': legalTrainerTexts(l).trainerTerms,
  dpa: legalTrainerTexts(l).dpa,
});
const textOf = (d: LegalDocText): string[] => [
  d.title,
  ...d.sections.flatMap((s) => [s.title, ...s.body.flatMap(strings)]),
];
const shape = (b: DocBlock): string =>
  'p' in b
    ? 'p'
    : 'ul' in b
      ? `ul${b.ul.length}`
      : `t${b.table.head.length}x${b.table.rows.length}`;
const MARKER = /\{\{(ЮРИСТ|ПОТРІБНО|ЗАЛЕЖИТЬ):([a-z0-9-]+)\}\}/g;
const LOCALES = ['en', 'uk', 'pl'] as const;
const trainerPending = PENDING.filter((p) => p.doc === 'trainer-terms' || p.doc === 'dpa');

describe('trainer documents: markers and pending items', () => {
  it.each(LOCALES)(
    '%s: every marker is a registered pending item of the right kind and section',
    (l) => {
      for (const [doc, d] of Object.entries(docs(l))) {
        for (const s of d.sections) {
          for (const str of s.body.flatMap(strings)) {
            for (const m of str.matchAll(MARKER)) {
              const item = trainerPending.find((p) => p.id === m[2]);
              expect(item, `${doc}/${s.id} ${m[2]}`).toBeTruthy();
              expect(item?.doc).toBe(doc);
              expect(item?.section).toBe(s.id);
              const kind = { ЮРИСТ: 'lawyer', ПОТРІБНО: 'owner', ЗАЛЕЖИТЬ: 'depends' }[m[1]];
              expect(item?.kind, m[2]).toBe(kind);
            }
          }
        }
      }
    },
  );

  it('every pending item of these documents is a marker in the English text, or a whole-document review item', () => {
    const used = new Set<string>();
    for (const d of Object.values(docs('en')))
      for (const str of textOf(d)) for (const m of str.matchAll(MARKER)) used.add(m[2]);
    for (const p of trainerPending) {
      if (p.id.endsWith('-lawyer-review')) continue;
      expect(used.has(p.id), p.id).toBe(true);
    }
    expect(trainerPending.filter((p) => p.blocksRelease).length).toBe(trainerPending.length);
  });

  it('uk and pl carry the same markers as English, in the same places', () => {
    const marks = (l: 'en' | 'uk' | 'pl') =>
      Object.values(docs(l)).map((d) =>
        d.sections.map((s) =>
          s.body.flatMap(strings).flatMap((x) => [...x.matchAll(MARKER)].map((m) => m[2])),
        ),
      );
    expect(marks('uk')).toEqual(marks('en'));
    expect(marks('pl')).toEqual(marks('en'));
  });
});

describe('trainer documents: structure and honesty', () => {
  it('are marked DRAFT in every language and the note says it is not reviewed', () => {
    for (const l of LOCALES) {
      expect(legalTrainerTexts(l).draftNote.length).toBeGreaterThan(20);
      expect(docs(l)['trainer-terms'].title).toMatch(/DRAFT|ЧЕРНЕТКА|WERSJA ROBOCZA/);
      expect(docs(l).dpa.title).toMatch(/DRAFT|ЧЕРНЕТКА|WERSJA ROBOCZA/);
    }
  });

  it('uk and pl have the same sections, ids and block shapes as English', () => {
    for (const l of ['uk', 'pl'] as const)
      for (const k of TRAINER_DOC_IDS) {
        expect(docs(l)[k].sections.map((s) => s.id)).toEqual(
          docs('en')[k].sections.map((s) => s.id),
        );
        expect(docs(l)[k].sections.map((s) => s.body.map(shape))).toEqual(
          docs('en')[k].sections.map((s) => s.body.map(shape)),
        );
      }
  });

  it('section ids are unique plain tokens', () => {
    const en = docs('en');
    for (const [k, prefix] of [
      ['trainer-terms', 'tt'],
      ['dpa', 'dp'],
    ] as const) {
      const ids = en[k].sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(new RegExp(`^${prefix}\\d+$`));
    }
  });

  it.each(LOCALES)(
    '%s: no invented numbers (only the 18+ age), no contact address, no overclaims',
    (l) => {
      const all = Object.values(docs(l)).flatMap(textOf).join('\n');
      const withoutMarkers = all.replace(MARKER, '');
      expect([...new Set(withoutMarkers.match(/\d+/g) ?? [])]).toEqual(['18']);
      expect(all).not.toMatch(/[\w.-]+@[\w.-]+\.\w+|mailto:|href=/i);
      expect(all).not.toMatch(/we cannot see|ми не бачимо|nie widzimy/i);
      for (const line of all.split('\n').filter((x) => /end-to-end|наскрізн/i.test(x)))
        expect(line).toMatch(/not end-to-end|не наскрізне|nie szyfrowanie end-to-end/i);
    },
  );

  it('the sub-processor table names the processors of docs/compliance/processors.md that hold trainer data', () => {
    const dpa = textOf(docs('en').dpa).join('\n');
    expect(dpa).toMatch(/Google \(Firebase/);
    expect(dpa).toMatch(/reCAPTCHA/);
  });

  it('covers the product: legacy notes, sharing grants, team/manager, suspension keeps the client history', () => {
    const tt = textOf(docs('en')['trainer-terms']).join('\n');
    expect(tt).toMatch(/legacy trainer notes/);
    expect(tt).toMatch(/Sharing page/);
    expect(tt).toMatch(/manager/);
    expect(tt).toMatch(/Suspending a trainer never removes a client’s own history/);
  });

  it('lt and et read the English text', () => {
    expect(legalTrainerTexts('lt')).toBe(legalTrainerTexts('en'));
    expect(Object.keys(LEGAL_TRAINER_LOCALES).sort()).toEqual(['en', 'pl', 'uk']);
  });
});

describe('trainer-terms consent: kind, version, hash', () => {
  it('is versioned with a 2026-10-22 baseline and needs the text hash', () => {
    expect(RELEASED_VERSIONS['trainer-terms']).toContain('2026-10-22');
    expect(LEGAL_VERSIONS['trainer-terms']).toBe('2026-10-22');
    expect(HASH_REQUIRED_KINDS).toContain('trainer-terms');
  });

  it('the hash covers BOTH documents in the shown language, so it differs per language and per text', async () => {
    const [en, uk] = await Promise.all([
      sha256Hex(trainerTermsHashInput('en')),
      sha256Hex(trainerTermsHashInput('uk')),
    ]);
    expect(en).toMatch(/^[0-9a-f]{64}$/);
    expect(en).not.toBe(uk);
    const t = legalTrainerTexts('en');
    expect(trainerTermsHashInput('en')).toContain(t.trainerTerms.title);
    expect(trainerTermsHashInput('en')).toContain(t.dpa.title);
    expect(trainerTermsHashInput('en').indexOf(t.trainerTerms.title)).toBeLessThan(
      trainerTermsHashInput('en').indexOf(t.dpa.title),
    );
  });

  it('is needed until a current grant exists (never, withdrawn, older version)', () => {
    const r = (action: 'grant' | 'withdraw', version: string): ConsentRecord => ({
      id: 'x',
      kind: 'trainer-terms',
      action,
      version,
      at: 1,
    });
    expect(trainerTermsNeeded([])).toBe(true);
    expect(trainerTermsNeeded([r('grant', LEGAL_VERSIONS['trainer-terms'])])).toBe(false);
    expect(trainerTermsNeeded([r('grant', '2026-10-21')])).toBe(true);
    expect(trainerTermsNeeded([r('withdraw', LEGAL_VERSIONS['trainer-terms'])])).toBe(true);
  });
});

describe('trainer documents: what the code really does (A2)', () => {
  it.each(LOCALES)('%s: the sub-processor table lists QR Server with its marker', (l) => {
    const dp7 = docs(l).dpa.sections.find((x) => x.id === 'dp7')!;
    const text = dp7.body.flatMap(strings).join('\n');
    expect(text).toContain('api.qrserver.com');
    expect(text).toContain('{{ЮРИСТ:dp-qrserver}}');
    expect(PENDING.some((p) => p.id === 'dp-qrserver' && p.section === 'dp7')).toBe(true);
  });

  it.each(LOCALES)('%s: no blanket "none of the other services gets client records" claim', (l) => {
    const dp7 = docs(l).dpa.sections.find((x) => x.id === 'dp7')!;
    const text = dp7.body.flatMap(strings).join('\n');
    expect(text).not.toMatch(
      /do not receive the client records|не отримують записи про клієнтів|Nie otrzymują zapisów o klientach/,
    );
  });

  it.each(LOCALES)(
    '%s: tt5 and dp6 do not promise a log for every read or a grant-only access',
    (l) => {
      const tt5 = docs(l)['trainer-terms'].sections.find((x) => x.id === 'tt5')!;
      const dp6 = docs(l).dpa.sections.find((x) => x.id === 'dp6')!;
      const all = [...tt5.body, ...dp6.body].flatMap(strings).join('\n');
      expect(all).not.toMatch(
        /Each time you read|Кожне читання даних клієнта|Każdy odczyt danych klienta/,
      );
      expect(all).not.toMatch(
        /only through the client’s sharing grant\.|тільки через його грант на поширення\.|wyłącznie przez jego zgodę na udostępnianie\./,
      );
    },
  );
});
