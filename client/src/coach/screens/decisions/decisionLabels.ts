import type { C360Strings } from '../../../i18n/coachClient360';
import type { DecisionsStrings } from '../../../i18n/coachDecisions';
import type { LocaleId } from '../../../i18n';
import type { RosterStrings } from '../../../i18n/coachRoster';
import { decisionsCsv } from '../../domain/csv';
import {
  followUpOf,
  followUpText,
  monthTitle,
  type DecisionResult,
  type DecisionRow,
  type GroupBy,
} from '../decisionModel';
import type { Range } from './decisionsConfig';

export const rangeLabelOf = (c: C360Strings, v: Range): string =>
  v === 'all' ? c.drFAllTime : v === '30' ? c.drFLast30 : c.drFLast90;

export const groupNameOf = (d: DecisionsStrings, g: GroupBy): string =>
  g === 'client'
    ? d.dcGroupClient
    : g === 'result'
      ? d.dcGroupResult
      : g === 'trigger'
        ? d.dcGroupTrigger
        : g === 'month'
          ? d.dcGroupMonth
          : d.dcGroupNone;

/** Heading of one group of rows (client name, result, trigger kind or month). */
export function groupTitleOf(o: {
  group: GroupBy;
  key: string;
  rows: readonly DecisionRow[];
  r: RosterStrings;
  locale: LocaleId;
  label: (x: DecisionResult) => string;
}): string {
  const { group, key, rows, r, locale, label } = o;
  return group === 'client'
    ? rows[0].name
    : group === 'result'
      ? label(rows[0].result)
      : group === 'trigger'
        ? r.sgKind[rows[0].rec.signal.kind]
        : monthTitle(key, locale);
}

/** The CSV spec of a set of decision rows. */
export function decisionsCsvOf(
  rows: readonly DecisionRow[],
  o: { c: C360Strings; now: number; label: (x: DecisionResult) => string },
) {
  return decisionsCsv(
    rows.map((x) => ({
      rec: x.rec,
      client: x.name,
      title: x.title,
      result: x.result,
      resultLabel: o.label(x.result),
      followupLabel: followUpText(o.c, followUpOf(x.rec, o.now)),
    })),
  );
}
