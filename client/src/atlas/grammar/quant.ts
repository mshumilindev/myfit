/** Quantities with units ("5км", "3x10", "3 по 10", "100 на 5", "10k steps") and time references. */
import type { T } from './core';
import { THOUSAND, unitOf } from './lex/measure';
import type { Lang, Quantity, Unit } from './types';

const REP_PREP = /^(на|по|po|of|x)$/;

function valueOf(t: T | undefined): number | undefined {
  if (!t) return undefined;
  if (t.kind === 'n') return Number(t.norm);
  if (t.pos === 'NUM' && t.x.num !== undefined) return t.x.num;
  return undefined;
}

function unitAt(lang: Lang, t: T | undefined): Unit | undefined {
  if (!t) return undefined;
  if (t.text === '%') return '%';
  if (t.x.unit) return t.x.unit;
  const k = t.lk.split('-')[0];
  return unitOf(lang, k) ?? unitOf(lang, t.lk);
}

export function quantities(ts: T[], lang: Lang, sentence: number): Quantity[] {
  const out: Quantity[] = [];
  const pos = new Map<Quantity, number>();
  const used = new Set<number>();
  const push = (value: number, unit: Unit, from: number, to: number): void => {
    const q: Quantity = {
      value,
      unit,
      text: ts
        .slice(from, to + 1)
        .map((t) => t.text)
        .join(' '),
      sentence,
    };
    out.push(q);
    pos.set(q, from);
    for (let k = from; k <= to; k++) used.add(k);
  };
  for (let i = 0; i < ts.length; i++) {
    if (used.has(i)) continue;
    const t = ts[i];
    if (t.x.unit === 'time' && t.x.num !== undefined && t.kind === 'w') {
      push(t.x.num, 'time', i, i);
      continue;
    }
    // approximate inversion (uk / ru): "кіла 4", "часа два" = about 4 kg, about two hours
    if (
      (lang === 'uk' || lang === 'ru') &&
      t.x.unit &&
      t.x.unit !== 'time' &&
      valueOf(ts[i + 1]) !== undefined &&
      valueOf(ts[i - 1]) === undefined &&
      !(ts[i + 2] && unitAt(lang, ts[i + 2]))
    ) {
      push(valueOf(ts[i + 1]) as number, t.x.unit, i, i + 1);
      continue;
    }
    let v = valueOf(t);
    if (v === undefined) continue;
    let j = i + 1;
    // compound word numerals: "двадцять один", "сто двадцять", "two hundred", "kakskümmend viis"
    if (t.kind === 'w') {
      while (ts[j] && ts[j].kind === 'w' && ts[j].pos === 'NUM' && ts[j].x.num !== undefined) {
        const n = ts[j].x.num as number;
        if (n === 100 && v < 10) v *= 100;
        else if (v >= 20 && v < 100 && v % 10 === 0 && n < 10 && n >= 1) v += n;
        else if (v >= 100 && v % 100 === 0 && n < 100 && n >= 1) v += n;
        else break;
        j++;
      }
    }
    // "10 тисяч", "10k"
    if (
      ts[j] &&
      (THOUSAND.has(ts[j].lk) ||
        (ts[j].norm === 'k' && ts[j].start === t.start + t.text.length && unitAt(lang, ts[j + 1])))
    ) {
      v *= 1000;
      j++;
    } else if (ts[j] && ts[j].norm === 'k' && ts[j].start === t.start + t.text.length) {
      push(v, 'km', i, j);
      continue;
    }
    // "1.5", "2,5" already one token; "і пів"/"and a half" ignored
    const n = ts[j];
    // 3x10
    if (n && n.norm === 'x' && valueOf(ts[j + 1]) !== undefined) {
      push(v, 'set', i, j);
      push(valueOf(ts[j + 1]) as number, 'rep', j + 1, j + 1);
      continue;
    }
    let u = unitAt(lang, n);
    if (u) {
      // "N раз(и/ів)" after "на"/"по" = reps; otherwise times
      if (u === 'time' && i > 0 && REP_PREP.test(ts[i - 1].lk)) u = 'rep';
      push(v, u, i, j);
      continue;
    }
    // "3 по 10", "3 sets of 10" — second number after по/of without a unit = reps
    if (i > 0 && REP_PREP.test(ts[i - 1].lk) && ts[i - 1].norm !== 'x') {
      const prevQ = out[out.length - 1];
      const prevNum = valueOf(ts[i - 2]);
      if (
        prevQ &&
        (prevQ.unit === 'set' || prevQ.unit === 'kg' || prevQ.unit === 'lb') &&
        used.has(i - 2)
      ) {
        push(v, 'rep', i, i);
        continue;
      }
      if (prevNum !== undefined && !used.has(i - 2)) {
        // "3 по 10" / "100 на 5"
        if (ts[i - 1].lk === 'po' || ts[i - 1].norm === 'по') push(prevNum, 'set', i - 2, i - 2);
        else if (prevNum >= 20) push(prevNum, 'kg', i - 2, i - 2);
        push(v, 'rep', i, i);
        continue;
      }
    }
    // number followed by "по N" / "на N" handled when we reach N
  }
  return out.sort((a, b) => (pos.get(a) ?? 0) - (pos.get(b) ?? 0));
}

/** First-to-last time references (canonical ids) of a sentence. */
export function timeRefs(ts: T[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (!t.x.time || t.x.cont) continue;
    // "раз в неділю" (surzhyk: once a week) is a frequency, not Sunday
    if (
      t.x.time === 'sun' &&
      i >= 2 &&
      /^(в|на|у)$/.test(ts[i - 1].norm) &&
      /^(раз|рази|разів|раза)$/.test(ts[i - 2].norm)
    )
      continue;
    out.push(t.x.time);
  }
  return out;
}
