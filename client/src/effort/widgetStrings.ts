import type { LocaleId } from '../i18n';

/** Words of the Effort trend widget (Today). RPE / RIR's own words live in its chunk, not in the core i18n (add-on boundary). */
const en = {
  effortK: 'Effort · RPE',
  noRpe: 'No effort data yet',
  noRpeSub: 'Rate a few sets (RPE) to see the trend',
  zone: (x: string) => `zone ${x}`,
  inZone: 'in zone',
  belowZone: 'below zone',
  aboveZone: 'above zone',
  adviceLow: 'Room to push a little harder',
  adviceHigh: 'Running hot — consider an easier week',
  adviceZone: 'Right in the zone — keep it up',
  avgRpe: (x: string) => `Avg RPE ${x}`,
  avgRpeUnit: 'avg RPE',
  lastNSessions: (n: number) => `last ${n} sessions`,
  effortLast: (n: number) => `Effort · last ${n} sessions`,
  inZoneN: (a: number, b: number) => `${a}/${b} in zone`,
  progress: 'Progress',
  avg: 'avg',
};

export type EffortWidgetStrings = typeof en;

const uk: EffortWidgetStrings = {
  effortK: 'Зусилля · RPE',
  noRpe: 'Даних про зусилля ще немає',
  noRpeSub: 'Оціни кілька підходів (RPE), щоб бачити тренд',
  zone: (x) => `зона ${x}`,
  inZone: 'у зоні',
  belowZone: 'нижче зони',
  aboveZone: 'вище зони',
  adviceLow: 'Є запас трохи піднажати',
  adviceHigh: 'Забагато — подумай про легший тиждень',
  adviceZone: 'Саме в зоні — так тримати',
  avgRpe: (x) => `Сер. RPE ${x}`,
  avgRpeUnit: 'сер. RPE',
  lastNSessions: (n) => `останні ${n} сесій`,
  effortLast: (n) => `Зусилля · останні ${n} сесій`,
  inZoneN: (a, b) => `${a}/${b} у зоні`,
  progress: 'Прогрес',
  avg: 'сер.',
};

const pl: EffortWidgetStrings = {
  effortK: 'Wysiłek · RPE',
  noRpe: 'Brak danych o wysiłku',
  noRpeSub: 'Oceń kilka serii (RPE), by zobaczyć trend',
  zone: (x) => `strefa ${x}`,
  inZone: 'w strefie',
  belowZone: 'poniżej strefy',
  aboveZone: 'powyżej strefy',
  adviceLow: 'Jest zapas, by docisnąć',
  adviceHigh: 'Za gorąco — rozważ lżejszy tydzień',
  adviceZone: 'Idealnie w strefie — tak trzymaj',
  avgRpe: (x) => `Śr. RPE ${x}`,
  avgRpeUnit: 'śr. RPE',
  lastNSessions: (n) => `ostatnie ${n} sesji`,
  effortLast: (n) => `Wysiłek · ostatnie ${n} sesji`,
  inZoneN: (a, b) => `${a}/${b} w strefie`,
  progress: 'Postępy',
  avg: 'śr.',
};

const et: EffortWidgetStrings = {
  effortK: 'Pingutus · RPE',
  noRpe: 'Pingutuse andmeid veel pole',
  noRpeSub: 'Hinda paari seeriat (RPE), et trendi näha',
  zone: (x) => `tsoon ${x}`,
  inZone: 'tsoonis',
  belowZone: 'alla tsooni',
  aboveZone: 'üle tsooni',
  adviceLow: 'Ruumi veidi rohkem pingutada',
  adviceHigh: 'Liiga kõvasti — kaalu kergemat nädalat',
  adviceZone: 'Täpselt tsoonis — jätka samamoodi',
  avgRpe: (x) => `Kesk. RPE ${x}`,
  avgRpeUnit: 'kesk. RPE',
  lastNSessions: (n) => `viimased ${n} trenni`,
  effortLast: (n) => `Pingutus · viimased ${n} trenni`,
  inZoneN: (a, b) => `${a}/${b} tsoonis`,
  progress: 'Areng',
  avg: 'kesk.',
};

const lt: EffortWidgetStrings = {
  effortK: 'Pastangos · RPE',
  noRpe: 'Pastangų duomenų dar nėra',
  noRpeSub: 'Įvertink kelias serijas (RPE), kad matytum tendenciją',
  zone: (x) => `zona ${x}`,
  inZone: 'zonoje',
  belowZone: 'žemiau zonos',
  aboveZone: 'virš zonos',
  adviceLow: 'Yra rezervo paspausti',
  adviceHigh: 'Per karšta — apsvarstyk lengvesnę savaitę',
  adviceZone: 'Tiksliai zonoje — taip ir toliau',
  avgRpe: (x) => `Vid. RPE ${x}`,
  avgRpeUnit: 'vid. RPE',
  lastNSessions: (n) => `paskutinės ${n} treniruotės`,
  effortLast: (n) => `Pastangos · paskutinės ${n}`,
  inZoneN: (a, b) => `${a}/${b} zonoje`,
  progress: 'Progresas',
  avg: 'vid.',
};

const DICT: Record<LocaleId, EffortWidgetStrings> = { en, uk, pl, et, lt };

export function ews(locale: LocaleId): EffortWidgetStrings {
  return DICT[locale];
}
