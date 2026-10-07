/** Cycle strings (English). Every key starts with `cyc`. Spread into `en`. */
export const cycEn = {
  cycTitle: 'Cycle',
  cycRowOff: 'Not set up',
  cycRowPaused: 'Off during pregnancy',
  cycRowMenopause: 'Off after menopause',
  cycRowLog: 'Log only',
  cycRowDay: (day: number, phase: string) => `Day ${day} · ${phase}`,

  cycPhMenses: 'Period',
  cycPhEarly: 'Early cycle',
  cycPhMid: 'Mid-cycle',
  cycPhLate: 'Late cycle',
  cycHintMenses: 'How you feel varies. Go by how you feel.',
  cycHintEarly: 'Many people have more energy here, but not everyone.',
  cycHintMid: 'No rules: go by your RPE and sleep.',
  cycHintLate: 'Recovery can feel harder for some. It is not necessarily about you.',

  cycSetupIntro:
    'Enter once when your cycle usually starts and how long it lasts. After that the log keeps itself: nothing to enter by hand.',
  cycMode: 'Mode',
  cycModeRegular: 'Regular',
  cycModeIrregular: 'Irregular',
  cycModeLog: 'Log only',
  cycModeFootRegular: 'A steady cycle: we estimate the phase and the next start.',
  cycModeFootIrregular: 'A cycle that varies: wider ranges and only a rough phase.',
  cycModeFootLog:
    'No estimates, only the bleeding days from your dates. Good with hormonal contraception.',
  cycUsually: 'Usually',
  cycLastStart: 'Last cycle started',
  cycLength: 'Cycle length',
  cycPeriod: 'Period length',
  cycShortest: 'Shortest cycle',
  cycLongest: 'Longest cycle',
  cycUsuallyFoot: 'Only your typical values. Nothing is made up beyond them.',
  cycDaysUnit: 'days',
  cycOutOfNorm: 'These values are outside the usual range. It is worth mentioning to a doctor.',
  cycSave: 'Save',
  cycCancel: 'Cancel',
  cycPrivate: 'Private. Encrypted on this device and in the cloud. Never shared with anyone.',

  cycApprox: 'Estimate',
  cycLikely: 'Likely',
  cycDayOf: (day: number, len: number) => `Day ${day} of ~${len}`,
  cycNextStart: (from: string, to: string) =>
    from === to ? `Next start: ${from}` : `Next start: ${from} – ${to} (80% range)`,
  cycLogHead: 'Log only',
  cycLogLast: (date: string) => `Last cycle started ${date}`,
  cycLogNote: 'No estimates, only the recorded days.',
  cycCalendar: 'Calendar',
  cycLegendLogged: 'Recorded period',
  cycUpdateDate: 'Update start date',
  cycUpdateTitle: 'When did the last cycle start?',
  cycUpdateSave: 'Save date',
  cycSettings: 'Settings',
  cycStale: 'The schedule is out of date. Estimates are off until you update the date.',
  cycStaleBtn: 'Update date',

  cycStates: 'Conditions',
  cycStatesFoot:
    'Marking one here adds it to your Chronic conditions right away, and the Cycle switches off.',
  cycMarkPreg: 'Mark pregnancy',
  cycMarkMeno: 'Mark menopause',
  cycPregTitle: 'Mark pregnancy',
  cycPregBody:
    'Enter the start date (or an approximate one). The trimester follows by itself, and the condition appears in your Chronic conditions.',
  cycPregInfo: (week: number) => `About week ${week}`,
  cycPregAdd: 'Add condition',
  cycMenoTitle: 'Mark menopause?',
  cycMenoBody:
    'Menopause will be added to your Chronic conditions and the Cycle will switch off. Your data stays.',
  cycMenoConfirm: 'Mark',

  cycOffTitle: 'Cycle is off',
  cycOffPregnancy:
    'There is an active pregnancy in your Chronic conditions. Your data is kept; when it ends we will ask for a new start date.',
  cycOffMenopause: 'Menopause is marked in your Chronic conditions. Your data is kept.',
  cycOpenStates: 'Open conditions',
  cycAfterPause: 'The pause is over. Enter when your cycle started to continue.',

  cycWhere: 'Where to show',
  cycWhereFoot:
    'Each one can be turned off. Nothing here changes your plan, progression or auto-built sessions.',
  cycSurfToday: 'Chip on Today',
  cycSurfCalendar: 'Calendar tint',
  cycSurfSession: 'Note in a session',
  cycDelete: 'Delete cycle data',
  cycDeleteTitle: 'Delete cycle data?',
  cycDeleteBody:
    'Your dates and settings are removed from this device and the cloud. This cannot be undone.',
  cycDeleteConfirm: 'Delete',
  cycPatterns: 'Patterns',
  cycPatternsSub: 'Your effort by phase',
  cycPatIntro:
    'This is your own rated effort, not a general rule. Each phase is compared with the average of the same cycle.',
  cycPatRow: (diff: string, lo: string, hi: string) => `${diff} RPE (${lo} to ${hi})`,
  cycPatHigher: 'Usually higher than your average',
  cycPatLower: 'Usually lower than your average',
  cycPatSame: 'Cannot tell apart from your average',
  cycPatCycles: (n: number) => `${n} cycles`,
  cycPatEmptyTitle: 'Not enough data yet',
  cycPatEmptyBody: (n: number) =>
    `Needs at least 3 cycles with rated sets in two or more phases. Cycles so far: ${n}. They come from the start dates you enter.`,
  cycPatFoot:
    'Paired difference per cycle, 95% interval (bootstrap). Unrated and warm-up sets are not used.',
  cycSessionHigher: (diff: string) =>
    `In this phase your rated sets usually run ${diff} RPE higher than your average. Your plan stays as it is.`,
  cycSessionLower: (diff: string) =>
    `In this phase your rated sets usually run ${diff} RPE lower than your average. Your plan stays as it is.`,
};
