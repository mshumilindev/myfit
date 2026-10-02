/**
 * Supplements strings (English). Kept in its own file and spread into `en` so the many
 * catalog names do not crowd the main dictionary. Every key starts with `sup`.
 */
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export const supEn = {
  supTitle: 'Supplements',
  supRowEmpty: 'What you take, to adjust your numbers',
  supOnbSub: 'What you take',

  // Hub (A2)
  supHubUse: 'What I take',
  supHubSchedule: 'Schedule',
  supHubScheduleNone: 'Daily or on training days',
  supHubScheduleVal: (daily: number, training: number): string =>
    [daily > 0 ? `${daily} daily` : '', training > 0 ? `${training} on training days` : '']
      .filter(Boolean)
      .join(' · '),
  supHubAsk: 'Ask me on Today',
  supHubAskSub: 'One question a day about what you took',
  supHubFoot: 'Private. Only used to adjust your numbers.',
  supItemsTail: (n: number): string => `${n} ${plural(n, 'item', 'items')}`,
  supMore: (n: number): string => `${n} more`,
  supCount: (n: number): string => `${n} ${plural(n, 'supplement', 'supplements')}`,

  // Group list (A3)
  supListIntro:
    'Pick the supplements you take. Open a group to set dose, timing and schedule. Nothing is logged by day.',
  supListSummarySub: (n: number, daily: number): string =>
    `${n} ${plural(n, 'supplement', 'supplements')} · ${daily} daily`,
  supListGroups: 'Groups',
  supListFoot:
    'Doses are typical servings from the catalog. Training days follow your training plan automatically.',
  supEvidenceRow: 'Evidence and sources',
  supEvidenceRowSub: 'Informational · how effects are estimated',

  // Catalog text
  supGroup: {
    performance: 'Performance',
    protein: 'Protein and aminos',
    recovery: 'Recovery and sleep',
    health: 'Health basics',
  },
  supGroupBlurb: {
    performance: 'Creatine, caffeine, pre-workout, nitrates…',
    protein: 'Whey, casein, plant protein, EAA, collagen…',
    recovery: 'Magnesium, melatonin, omega-3, tart cherry…',
    health: 'Vitamin D, multivitamin, zinc, iron…',
  },
  supItem: {
    creatine: 'Creatine monohydrate',
    caffeine: 'Caffeine',
    preWorkout: 'Pre-workout blend',
    betaAlanine: 'Beta-alanine',
    citrulline: 'Citrulline',
    nitrate: 'Nitrates (beetroot)',
    bicarbonate: 'Sodium bicarbonate',
    whey: 'Whey protein',
    casein: 'Casein',
    plantProtein: 'Plant protein',
    eaa: 'Essential amino acids (EAA)',
    bcaa: 'BCAA',
    glutamine: 'Glutamine',
    hmb: 'HMB',
    collagen: 'Collagen',
    magnesium: 'Magnesium',
    melatonin: 'Melatonin',
    glycine: 'Glycine',
    ashwagandha: 'Ashwagandha',
    omega3: 'Omega-3',
    tartCherry: 'Tart cherry',
    curcumin: 'Curcumin',
    vitaminD: 'Vitamin D',
    multivitamin: 'Multivitamin',
    zinc: 'Zinc',
    iron: 'Iron',
    vitaminC: 'Vitamin C',
    vitaminE: 'Vitamin E',
    probiotics: 'Probiotics',
    vitaminB12: 'Vitamin B12',
    calcium: 'Calcium',
  },
  supItemShort: {
    creatine: 'Creatine',
    caffeine: 'Caffeine',
    preWorkout: 'Pre-workout',
    betaAlanine: 'Beta-alanine',
    citrulline: 'Citrulline',
    nitrate: 'Nitrates',
    bicarbonate: 'Bicarbonate',
    whey: 'Whey',
    casein: 'Casein',
    plantProtein: 'Plant protein',
    eaa: 'EAA',
    bcaa: 'BCAA',
    glutamine: 'Glutamine',
    hmb: 'HMB',
    collagen: 'Collagen',
    magnesium: 'Magnesium',
    melatonin: 'Melatonin',
    glycine: 'Glycine',
    ashwagandha: 'Ashwagandha',
    omega3: 'Omega-3',
    tartCherry: 'Tart cherry',
    curcumin: 'Curcumin',
    vitaminD: 'Vitamin D',
    multivitamin: 'Multivitamin',
    zinc: 'Zinc',
    iron: 'Iron',
    vitaminC: 'Vitamin C',
    vitaminE: 'Vitamin E',
    probiotics: 'Probiotics',
    vitaminB12: 'Vitamin B12',
    calcium: 'Calcium',
  },
  supItemBlurb: {
    creatine: 'Strength and power in short, hard efforts',
    caffeine: 'Alertness and a little more output when you train',
    preWorkout: 'A mix, usually with caffeine; check the label',
    betaAlanine: 'Hard efforts of one to four minutes',
    citrulline: 'Used for blood flow and endurance in repeated sets',
    nitrate: 'Endurance efforts; a beetroot shot',
    bicarbonate: 'Short, very hard efforts',
    whey: 'A convenient way to reach your protein target',
    casein: 'Slow protein, often taken in the evening',
    plantProtein: 'Pea, rice or soy blends',
    eaa: 'The amino acids you cannot make yourself',
    bcaa: 'Three of the essential amino acids',
    glutamine: 'Popular for recovery; little evidence for training',
    hmb: 'A leucine metabolite; weak evidence in trained people',
    collagen: 'Tendons and joints; not a complete protein',
    magnesium: 'Cramps and sleep; weak evidence',
    melatonin: 'Falling asleep a little sooner',
    glycine: 'Sleep quality; early evidence',
    ashwagandha: 'Stress and sleep; early or mixed results',
    omega3: 'Fish oil; soreness and general health',
    tartCherry: 'Soreness after hard sessions; early evidence',
    curcumin: 'Soreness and inflammation; early evidence',
    vitaminD: 'Useful if you are low; ask for a blood test',
    multivitamin: 'A safety net for a limited diet',
    zinc: 'Only helps if your diet is short of it',
    iron: 'Only if a blood test shows you are low',
    vitaminC: 'High doses can blunt training adaptation',
    vitaminE: 'High doses can blunt training adaptation',
    probiotics: 'Gut health; results depend on the strain',
    vitaminB12: 'Mainly for vegans and vegetarians',
    calcium: 'Only if your diet is short of it',
  },
  supTiming: {
    anytime: 'Any time',
    morning: 'Morning',
    preWorkout: 'Pre-workout',
    withMeal: 'With a meal',
    postWorkout: 'Post-workout',
    evening: 'Evening',
  },
  supSchedule: { daily: 'Daily', trainingDays: 'Training days' },
  supEvidence: { strong: 'Strong', moderate: 'Moderate', weak: 'Weak', none: 'None' },
  /** A dose with its unit: "5 g", "1 scoop", "2 scoops". */
  supDose: {
    g: (n: string): string => `${n} g`,
    mg: (n: string): string => `${n} mg`,
    µg: (n: string): string => `${n} µg`,
    ml: (n: string): string => `${n} ml`,
    scoop: (n: string): string => `${n} ${n === '1' ? 'scoop' : 'scoops'}`,
    serving: (n: string): string => `${n} ${n === '1' ? 'serving' : 'servings'}`,
  },
  /** The bare unit on the stepper. */
  supUnit: { g: 'g', mg: 'mg', µg: 'µg', ml: 'ml', scoop: 'scoops', serving: 'servings' },
  supMin: 'min',
  supKg: 'kg',
  supPerKg: 'per kg',

  // Group sheet (A4)
  supSheetSchedule: 'Schedule',
  supSheetScheduleHelp: 'Training days follow your training plan automatically.',
  supSheetItem: 'Supplement',
  supSaved: 'saved',
  supServing: 'Serving',
  supExact: 'Exact amount',
  supTimingLabel: 'Timing',
  supTypical: 'Typical serving',
  supEvidenceLabel: 'Evidence',
  supInNumbers: 'In your numbers',
  supNoEffect: 'Tracked, no estimated effect',
  supNoEffectHere: 'No estimated effect with this timing',
  supCaffeineIn: 'Caffeine in this serving',
  supFx: {
    creatineStrength: 'Strength, after about 12 weeks',
    creatineBodyweightKg: 'Body weight, mostly water',
    caffeineRpe: 'Effort on training days',
    caffeineSleepMin: 'Sleep need',
    proteinGrams: 'Counts toward your protein',
  },
  supProteinNote:
    'These grams count toward your daily protein target. Food logging is separate: a shake you also log as food is counted twice.',
  supRemove: 'Remove this supplement',
  supRemoveAsk: 'Remove this supplement?',
  supRemoveBody: (name: string): string =>
    `${name} will no longer count in your numbers. Its history is not kept.`,

  // Quick start (E2)
  supQuickTitle: 'What do you take regularly?',
  supQuickSub:
    'Pick all that apply. We fill in typical doses and timing. You can fine-tune them later.',
  supQuickAria: 'Common supplements',
  supQuickProtein: 'Protein',
  supQuickCaffeine: 'Caffeine or pre-workout',
  supQuickSaved: 'Saved',
  supQuickSave: (n: number): string =>
    n > 0 ? `Save ${n} ${plural(n, 'supplement', 'supplements')}` : 'Save',
  supQuickMore: 'Fine-tune and add more',

  // Use in calculations (S3)
  supCalcTitle: 'Use in calculations',
  supCalcMaster: 'Use supplements in my numbers',
  supCalcMasterSub: 'Strength, sleep, effort, protein, trends',
  supCalcMasterFoot: 'Switch off to keep your supplements saved but out of every number.',
  supCalcSurfaces: 'Based on research',
  supCalcSurfacesFoot:
    'Effects are small, vary between people and come from published research. Tags show how strong the research is.',
  supSf: {
    strength: { label: 'Strength expectation', sub: 'Creatine: a range, shown on Progress' },
    sleep: { label: 'Sleep', sub: 'Late caffeine can add to your sleep need' },
    rpe: {
      label: 'Effort (RPE) note',
      sub: 'Caffeine before training: effort can feel a little lower',
    },
    protein: { label: 'Protein target', sub: 'Protein powders count toward your daily protein' },
    trends: { label: 'Trends', sub: 'Context on charts, such as creatine water weight' },
    afterWorkoutHints: {
      label: 'After a workout',
      sub: 'Hints about what you take around training',
    },
  },
  supCalcSources: 'Sources',
  supCalcApprox: 'approx.',
  supDisclaimer:
    'Supplement effects are small, vary between people, and come from studies, not guarantees. This app does not change your training load because of a supplement. Not medical advice. Ask a doctor if you have a condition or take medication.',

  // Evidence and sources sheet
  supEvTitle: 'Evidence and sources',
  supEvIntro: 'Each supplement carries a tag that says how strong the research behind it is.',
  supEvLegend: {
    strong: 'Many good studies agree.',
    moderate: 'Some good studies, or results that are mixed.',
    weak: 'Early, small or conflicting studies.',
    none: 'No effect is estimated by the app.',
  },

  // Warnings: the names of the supplements come first.
  supWarnHead: 'Safety',
  supWarn: {
    kidney: (n: string): string => `${n}: if you have a kidney condition, ask a doctor first.`,
    hypertension: (n: string): string =>
      `${n}: can raise blood pressure. Ask a doctor if yours is high.`,
    anticoagulants: (n: string): string =>
      `${n}: may add to blood thinners. Ask a doctor if you take any.`,
    wada: (n: string): string =>
      `${n}: blends can contain substances banned in competition. Check the label if you are tested.`,
    pregnancy: (n: string): string =>
      `${n}: ask a doctor first in pregnancy or while breastfeeding.`,
    minors: (n: string): string => `${n}: not recommended under 18.`,
    antioxidantBlunt: (n: string): string => `${n}: high doses can blunt the gains from training.`,
    ashwagandha: (n: string): string =>
      `${n}: linked to liver problems in rare cases and can affect the thyroid. Ask a doctor if you have a condition or take medication.`,
    deficiencyOnly: (n: string): string =>
      `${n}: only useful if you are low. Ask for a blood test before taking it for long.`,
    giUpset: (n: string): string => `${n}: can upset the stomach. Start with a small dose.`,
    caffeineDailyLimit: (n: string): string =>
      `Caffeine from ${n} adds up to more than 400 mg on a training day, above the usual daily limit.`,
    caffeineSingleDose: (n: string): string =>
      `${n}: more than 3 mg of caffeine per kg of body weight in one dose.`,
    caffeineLate: (n: string): string =>
      `${n}: taken late in the day, caffeine can cost sleep. Aim to stop 8 to 9 hours before bed.`,
  },

  // Privacy and sharing
  supPrivSeeEffects: '“Strength +0–8 %, sleep need +10 min.” No supplements or doses.',
  supPrivSeeFull: 'Names, doses and timing of your supplements, and the effects.',
  supPrivPreviewHead: 'Your coach would see now',
  supPrivPreviewNone: 'Nothing yet. Add a supplement that has an effect.',
  supPrivPreviewNever: 'Which days you took them is never shared.',
  supPrivPreviewTotals: (caf: number, prot: number): string =>
    `On a training day: caffeine ${caf} mg, protein ${prot} g.`,
  supPrivDelete: 'Delete supplement data',
  supPrivDeleteAsk: 'Delete all supplement data?',
  supPrivDeleteBody:
    'Your supplements, doses, check-ins and switches will be removed from this device and your account. This cannot be undone.',
};
