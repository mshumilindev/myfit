export const scheduleDigestEt: typeof import('./coachScheduleDigest.en').scheduleDigestEn = {
  wdLabel: 'Nädal lühidalt',
  wdDone: 'Toimunud treeninguid',
  wdPlanned: 'Planeeritud treeninguid',
  wdMoves: 'Ootab vastust',
  wdDecisions: 'Avatud otsused',
  wdHidden: (n) =>
    n === 1
      ? '1 treeningut ei arvestata: see klient ei jaga kokkuvõtteid.'
      : `Arvestamata treeninguid: ${n}. Need kliendid ei jaga kokkuvõtteid.`,
};
