export const scheduleDigestUk: typeof import('./coachScheduleDigest.en').scheduleDigestEn = {
  wdLabel: 'Тиждень коротко',
  wdDone: 'Проведено занять',
  wdPlanned: 'Заплановано занять',
  wdMoves: 'Чекають на відповідь',
  wdDecisions: 'Відкриті рішення',
  wdHidden: (n) =>
    n === 1
      ? '1 заняття не враховано: цей клієнт не ділиться підсумками.'
      : `Занять не враховано: ${n}. Ці клієнти не діляться підсумками.`,
};
