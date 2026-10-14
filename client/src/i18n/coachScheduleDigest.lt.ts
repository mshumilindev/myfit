export const scheduleDigestLt: typeof import('./coachScheduleDigest.en').scheduleDigestEn = {
  wdLabel: 'Savaitė trumpai',
  wdDone: 'Įvykę užsiėmimai',
  wdPlanned: 'Suplanuoti užsiėmimai',
  wdMoves: 'Laukia atsakymo',
  wdDecisions: 'Atviri sprendimai',
  wdHidden: (n) =>
    n === 1
      ? 'Neskaičiuojamas 1 užsiėmimas: šis klientas nesidalija suvestinėmis.'
      : `Neskaičiuojami užsiėmimai: ${n}. Šie klientai nesidalija suvestinėmis.`,
};
