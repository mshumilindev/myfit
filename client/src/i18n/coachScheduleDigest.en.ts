/**
 * Week digest strip (Coach, S-14). Own dictionary so it never collides with `coachSchedule`; read through
 * `useScheduleDigestT()` in `coachScheduleDigest.ts`.
 */
export const scheduleDigestEn = {
  wdLabel: 'This week at a glance',
  wdDone: 'Sessions done',
  wdPlanned: 'Sessions planned',
  wdMoves: 'Waiting for an answer',
  wdDecisions: 'Decisions open',
  /** "2 of 9 sessions are not counted: those clients do not share their totals." */
  wdHidden: (n: number) =>
    n === 1
      ? '1 session is not counted: that client does not share totals.'
      : `${n} sessions are not counted: those clients do not share totals.`,
};
