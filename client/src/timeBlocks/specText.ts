import type { BlockSpec } from './model';

/** m:ss for a length in seconds (the same on every locale: digits only). */
export function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** One-line, language-neutral summary of a block ("12:00", "60 s × 10", "20 s / 10 s × 8", "21-15-9"). */
export function specTitle(s: BlockSpec): string {
  switch (s.fmt) {
    case 'amrap':
      return mmss(s.capSec ?? 0);
    case 'emom':
      return `${s.everySec ?? 60} s × ${s.rounds ?? 0}`;
    case 'intervals':
      return `${s.workSec ?? 0} s / ${s.restSec ?? 0} s × ${s.rounds ?? 0}`;
    case 'fortime':
      return `${s.scheme?.join('-') ?? '∞'}${s.capSec != null ? ` · ${mmss(s.capSec)}` : ''}`;
    default:
      return '';
  }
}

/** The spec as the plan and the ready card read it: "12 min · target 8 rounds", "cap 15 min · 21-15-9", "every 60 s × 10". */
export function specLong(
  t: {
    minN: (m: number) => string;
    targetN: (n: number) => string;
    capN: (m: number) => string;
    everyN: (s: number, n: number) => string;
  },
  s: BlockSpec,
): string {
  const mins = (sec: number) => Math.max(1, Math.round(sec / 60));
  switch (s.fmt) {
    case 'amrap':
      return [t.minN(mins(s.capSec ?? 0)), s.targetRounds ? t.targetN(s.targetRounds) : '']
        .filter(Boolean)
        .join(' · ');
    case 'emom':
      return t.everyN(s.everySec ?? 60, s.rounds ?? 0);
    case 'fortime':
      return [s.capSec != null ? t.capN(mins(s.capSec)) : '', s.scheme?.join('-') ?? '']
        .filter(Boolean)
        .join(' · ');
    default:
      return specTitle(s);
  }
}
