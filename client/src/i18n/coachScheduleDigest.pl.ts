export const scheduleDigestPl: typeof import('./coachScheduleDigest.en').scheduleDigestEn = {
  wdLabel: 'Tydzień w skrócie',
  wdDone: 'Odbyte treningi',
  wdPlanned: 'Zaplanowane treningi',
  wdMoves: 'Czeka na odpowiedź',
  wdDecisions: 'Otwarte decyzje',
  wdHidden: (n) =>
    n === 1
      ? '1 trening nie jest liczony: ten klient nie udostępnia podsumowań.'
      : `Nieliczone treningi: ${n}. Ci klienci nie udostępniają podsumowań.`,
};
