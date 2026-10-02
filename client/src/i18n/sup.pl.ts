/** Supplements strings (Polish). See `sup.en.ts`. */
import type { supEn } from './sup.en';

const p3 = (n: number, one: string, few: string, many: string): string => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (n === 1) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
/** "1 miarka", "2 miarki", "5 miarek", "1.5 miarki": a fraction takes the genitive singular. */
const counted = (n: string, one: string, few: string, many: string, frac: string): string => {
  const v = Number(n);
  return `${n} ${Number.isInteger(v) ? p3(v, one, few, many) : frac}`;
};

export const supPl: typeof supEn = {
  supTitle: 'Suplementy',
  supRowEmpty: 'Co przyjmujesz, żeby doprecyzować liczby',
  supOnbSub: 'Co przyjmujesz',

  supHubUse: 'Co przyjmuję',
  supHubSchedule: 'Harmonogram',
  supHubScheduleNone: 'Codziennie lub w dni treningowe',
  supHubScheduleVal: (daily, training) =>
    [daily > 0 ? `${daily} codziennie` : '', training > 0 ? `${training} w dni treningowe` : '']
      .filter(Boolean)
      .join(' · '),
  supHubAsk: 'Pytaj na ekranie Dziś',
  supHubAskSub: 'Jedno pytanie dziennie o przyjęte suplementy',
  supHubFoot: 'Prywatne. Służy tylko do korygowania Twoich liczb.',
  supItemsTail: (n) => `${n} ${p3(n, 'pozycja', 'pozycje', 'pozycji')}`,
  supMore: (n) => `jeszcze ${n}`,
  supCount: (n) => `${n} ${p3(n, 'suplement', 'suplementy', 'suplementów')}`,

  supListIntro:
    'Wybierz suplementy, które przyjmujesz. Otwórz grupę, aby ustawić dawkę, porę i harmonogram. Nic nie jest zapisywane dzień po dniu.',
  supListSummarySub: (n, daily) =>
    `${n} ${p3(n, 'suplement', 'suplementy', 'suplementów')} · ${daily} codziennie`,
  supListGroups: 'Grupy',
  supListFoot:
    'Dawki to typowe porcje z katalogu. Dni treningowe wynikają automatycznie z Twojego planu treningowego.',
  supEvidenceRow: 'Dowody i źródła',
  supEvidenceRowSub: 'Informacyjnie · jak szacujemy efekty',

  supGroup: {
    performance: 'Wydolność',
    protein: 'Białko i aminokwasy',
    recovery: 'Regeneracja i sen',
    health: 'Podstawy zdrowia',
  },
  supGroupBlurb: {
    performance: 'Kreatyna, kofeina, przedtreningówki, azotany…',
    protein: 'Serwatka, kazeina, białko roślinne, EAA, kolagen…',
    recovery: 'Magnez, melatonina, omega-3, wiśnia…',
    health: 'Witamina D, multiwitamina, cynk, żelazo…',
  },
  supItem: {
    creatine: 'Kreatyna monohydrat',
    caffeine: 'Kofeina',
    preWorkout: 'Przedtreningówka',
    betaAlanine: 'Beta-alanina',
    citrulline: 'Cytrulina',
    nitrate: 'Azotany (burak)',
    bicarbonate: 'Wodorowęglan sodu',
    whey: 'Białko serwatkowe',
    casein: 'Kazeina',
    plantProtein: 'Białko roślinne',
    eaa: 'Aminokwasy egzogenne (EAA)',
    bcaa: 'BCAA',
    glutamine: 'Glutamina',
    hmb: 'HMB',
    collagen: 'Kolagen',
    magnesium: 'Magnez',
    melatonin: 'Melatonina',
    glycine: 'Glicyna',
    ashwagandha: 'Ashwagandha',
    omega3: 'Omega-3',
    tartCherry: 'Wiśnia (sok z wiśni Montmorency)',
    curcumin: 'Kurkumina',
    vitaminD: 'Witamina D',
    multivitamin: 'Multiwitamina',
    zinc: 'Cynk',
    iron: 'Żelazo',
    vitaminC: 'Witamina C',
    vitaminE: 'Witamina E',
    probiotics: 'Probiotyki',
    vitaminB12: 'Witamina B12',
    calcium: 'Wapń',
  },
  supItemShort: {
    creatine: 'Kreatyna',
    caffeine: 'Kofeina',
    preWorkout: 'Przedtreningówka',
    betaAlanine: 'Beta-alanina',
    citrulline: 'Cytrulina',
    nitrate: 'Azotany',
    bicarbonate: 'Soda',
    whey: 'Serwatka',
    casein: 'Kazeina',
    plantProtein: 'Białko roślinne',
    eaa: 'EAA',
    bcaa: 'BCAA',
    glutamine: 'Glutamina',
    hmb: 'HMB',
    collagen: 'Kolagen',
    magnesium: 'Magnez',
    melatonin: 'Melatonina',
    glycine: 'Glicyna',
    ashwagandha: 'Ashwagandha',
    omega3: 'Omega-3',
    tartCherry: 'Wiśnia',
    curcumin: 'Kurkumina',
    vitaminD: 'Witamina D',
    multivitamin: 'Multiwitamina',
    zinc: 'Cynk',
    iron: 'Żelazo',
    vitaminC: 'Witamina C',
    vitaminE: 'Witamina E',
    probiotics: 'Probiotyki',
    vitaminB12: 'Witamina B12',
    calcium: 'Wapń',
  },
  supItemBlurb: {
    creatine: 'Siła i moc w krótkich, ciężkich wysiłkach',
    caffeine: 'Czujność i trochę więcej mocy na treningu',
    preWorkout: 'Mieszanka, zwykle z kofeiną; sprawdź etykietę',
    betaAlanine: 'Ciężkie wysiłki trwające od jednej do czterech minut',
    citrulline: 'Na ukrwienie i wytrzymałość w powtarzanych seriach',
    nitrate: 'Wysiłki wytrzymałościowe; shot z buraka',
    bicarbonate: 'Krótkie, bardzo ciężkie wysiłki',
    whey: 'Wygodny sposób na osiągnięcie dziennego celu białka',
    casein: 'Wolno wchłaniane białko, często wieczorem',
    plantProtein: 'Mieszanki z grochu, ryżu lub soi',
    eaa: 'Aminokwasy, których organizm nie wytwarza sam',
    bcaa: 'Trzy z aminokwasów egzogennych',
    glutamine: 'Popularna w regeneracji; mało dowodów dla treningu',
    hmb: 'Metabolit leucyny; słabe dowody u wytrenowanych',
    collagen: 'Ścięgna i stawy; nie jest pełnowartościowym białkiem',
    magnesium: 'Skurcze i sen; słabe dowody',
    melatonin: 'Odrobinę szybsze zasypianie',
    glycine: 'Jakość snu; wczesne dowody',
    ashwagandha: 'Stres i sen; wyniki wstępne lub niejednoznaczne',
    omega3: 'Tran; zakwasy i ogólne zdrowie',
    tartCherry: 'Zakwasy po ciężkich treningach; wczesne dowody',
    curcumin: 'Zakwasy i stan zapalny; wczesne dowody',
    vitaminD: 'Przydatna, gdy masz niedobór; zrób badanie krwi',
    multivitamin: 'Zabezpieczenie przy ograniczonej diecie',
    zinc: 'Pomaga tylko przy niedoborze w diecie',
    iron: 'Tylko gdy badanie krwi wykazuje niedobór',
    vitaminC: 'Duże dawki mogą osłabiać adaptację do treningu',
    vitaminE: 'Duże dawki mogą osłabiać adaptację do treningu',
    probiotics: 'Zdrowie jelit; zależy od szczepu',
    vitaminB12: 'Głównie dla wegan i wegetarian',
    calcium: 'Tylko gdy dieta jest uboga w wapń',
  },
  supTiming: {
    anytime: 'Dowolnie',
    morning: 'Rano',
    preWorkout: 'Przed treningiem',
    withMeal: 'Z posiłkiem',
    postWorkout: 'Po treningu',
    evening: 'Wieczorem',
  },
  supSchedule: { daily: 'Codziennie', trainingDays: 'Dni treningowe' },
  supEvidence: { strong: 'Mocne', moderate: 'Umiarkowane', weak: 'Słabe', none: 'Brak' },
  supDose: {
    g: (n) => `${n} g`,
    mg: (n) => `${n} mg`,
    µg: (n) => `${n} µg`,
    ml: (n) => `${n} ml`,
    scoop: (n) => counted(n, 'miarka', 'miarki', 'miarek', 'miarki'),
    serving: (n) => counted(n, 'porcja', 'porcje', 'porcji', 'porcji'),
  },
  supUnit: { g: 'g', mg: 'mg', µg: 'µg', ml: 'ml', scoop: 'miarek', serving: 'porcji' },
  supMin: 'min',
  supKg: 'kg',
  supPerKg: 'na kg',

  supSheetSchedule: 'Harmonogram',
  supSheetScheduleHelp: 'Dni treningowe wynikają automatycznie z Twojego planu treningowego.',
  supSheetItem: 'Suplement',
  supSaved: 'zapisano',
  supServing: 'Porcja',
  supExact: 'Dokładna ilość',
  supTimingLabel: 'Pora',
  supTypical: 'Typowa porcja',
  supEvidenceLabel: 'Dowody',
  supInNumbers: 'W Twoich liczbach',
  supNoEffect: 'Tylko zapisywany, bez szacowanego efektu',
  supNoEffectHere: 'Przy tej porze nie szacujemy efektu',
  supCaffeineIn: 'Kofeina w porcji',
  supFx: {
    creatineStrength: 'Siła, po około 12 tygodniach',
    creatineBodyweightKg: 'Masa ciała, głównie woda',
    caffeineRpe: 'Wysiłek w dni treningowe',
    caffeineSleepMin: 'Zapotrzebowanie na sen',
    proteinGrams: 'Liczy się do białka',
  },
  supProteinNote:
    'Te gramy liczą się do dziennego celu białka. Dziennik jedzenia jest osobny: koktajl zapisany także jako jedzenie zostanie policzony dwa razy.',
  supRemove: 'Usuń ten suplement',
  supRemoveAsk: 'Usunąć ten suplement?',
  supRemoveBody: (name) =>
    `${name} przestanie się liczyć w Twoich liczbach. Historia nie jest przechowywana.`,

  supQuickTitle: 'Co przyjmujesz regularnie?',
  supQuickSub:
    'Zaznacz wszystko, co pasuje. Uzupełnimy typowe dawki i porę. Później możesz je dopracować.',
  supQuickAria: 'Popularne suplementy',
  supQuickProtein: 'Białko',
  supQuickCaffeine: 'Kofeina lub przedtreningówka',
  supQuickSaved: 'Zapisano',
  supQuickSave: (n) =>
    n > 0 ? `Zapisz: ${n} ${p3(n, 'suplement', 'suplementy', 'suplementów')}` : 'Zapisz',
  supQuickMore: 'Dopracuj i dodaj więcej',

  supCalcTitle: 'Użycie w obliczeniach',
  supCalcMaster: 'Uwzględniaj suplementy w moich liczbach',
  supCalcMasterSub: 'Siła, sen, wysiłek, białko, trendy',
  supCalcMasterFoot: 'Wyłącz, aby suplementy zostały zapisane, ale nie wpływały na żadne liczby.',
  supCalcSurfaces: 'Na podstawie badań',
  supCalcSurfacesFoot:
    'Efekty są małe, różnią się między ludźmi i pochodzą z opublikowanych badań. Znaczniki pokazują, jak mocne są dowody.',
  supSf: {
    strength: { label: 'Oczekiwana siła', sub: 'Kreatyna: zakres, widoczny w Postępach' },
    sleep: { label: 'Sen', sub: 'Kofeina późną porą może zwiększyć zapotrzebowanie na sen' },
    rpe: {
      label: 'Uwaga o wysiłku (RPE)',
      sub: 'Kofeina przed treningiem: wysiłek może być odczuwany nieco lżej',
    },
    protein: { label: 'Cel białka', sub: 'Odżywki białkowe liczą się do dziennego białka' },
    trends: { label: 'Trendy', sub: 'Kontekst na wykresach, np. woda po kreatynie' },
    afterWorkoutHints: {
      label: 'Po treningu',
      sub: 'Wskazówki o tym, co przyjmujesz wokół treningu',
    },
  },
  supCalcSources: 'Źródła',
  supCalcApprox: 'ok.',
  supDisclaimer:
    'Efekty suplementów są małe, różnią się między ludźmi i wynikają z badań, a nie z gwarancji. Aplikacja nie zmienia obciążenia treningowego z powodu suplementu. To nie jest porada medyczna. Jeśli masz schorzenie lub przyjmujesz leki, zapytaj lekarza.',

  supEvTitle: 'Dowody i źródła',
  supEvIntro: 'Każdy suplement ma znacznik pokazujący, jak mocne są stojące za nim badania.',
  supEvLegend: {
    strong: 'Wiele dobrych badań jest zgodnych.',
    moderate: 'Kilka dobrych badań lub wyniki niejednoznaczne.',
    weak: 'Wczesne, małe lub sprzeczne badania.',
    none: 'Aplikacja nie szacuje żadnego efektu.',
  },

  supWarnHead: 'Bezpieczeństwo',
  supWarn: {
    kidney: (n) => `${n}: jeśli masz chorobę nerek, najpierw zapytaj lekarza.`,
    hypertension: (n) => `${n}: może podnosić ciśnienie. Zapytaj lekarza, jeśli masz wysokie.`,
    anticoagulants: (n) =>
      `${n}: może nasilać działanie leków przeciwzakrzepowych. Zapytaj lekarza, jeśli je przyjmujesz.`,
    wada: (n) =>
      `${n}: mieszanki mogą zawierać substancje zakazane w zawodach. Sprawdź etykietę, jeśli podlegasz kontroli antydopingowej.`,
    pregnancy: (n) => `${n}: w ciąży lub podczas karmienia piersią najpierw zapytaj lekarza.`,
    minors: (n) => `${n}: niezalecane poniżej 18. roku życia.`,
    antioxidantBlunt: (n) => `${n}: duże dawki mogą osłabiać efekty treningu.`,
    ashwagandha: (n) =>
      `${n}: w rzadkich przypadkach wiązana z problemami z wątrobą i może wpływać na tarczycę. Jeśli masz schorzenie lub przyjmujesz leki, zapytaj lekarza.`,
    deficiencyOnly: (n) =>
      `${n}: przydatna tylko przy niedoborze. Przed długim stosowaniem zrób badanie krwi.`,
    giUpset: (n) => `${n}: może podrażniać żołądek. Zacznij od małej dawki.`,
    caffeineDailyLimit: (n) =>
      `Kofeina z ${n} daje razem ponad 400 mg w dzień treningowy, czyli więcej niż zwykły dzienny limit.`,
    caffeineSingleDose: (n) => `${n}: ponad 3 mg kofeiny na kg masy ciała w jednej dawce.`,
    caffeineLate: (n) =>
      `${n}: przyjęta późno kofeina może skrócić sen. Przestań 8 do 9 godzin przed snem.`,
  },

  supPrivSeeEffects: '„Siła +0–8 %, zapotrzebowanie na sen +10 min.” Bez suplementów i dawek.',
  supPrivSeeFull: 'Nazwy, dawki i pora przyjmowania suplementów oraz ich efekty.',
  supPrivPreviewHead: 'Trener widziałby teraz',
  supPrivPreviewNone: 'Na razie nic. Dodaj suplement, który ma efekt.',
  supPrivPreviewNever: 'To, w które dni były przyjmowane, nigdy nie jest udostępniane.',
  supPrivPreviewTotals: (caf, prot) => `W dzień treningowy: kofeina ${caf} mg, białko ${prot} g.`,
  supPrivDelete: 'Usuń dane o suplementach',
  supPrivDeleteAsk: 'Usunąć wszystkie dane o suplementach?',
  supPrivDeleteBody:
    'Twoje suplementy, dawki, odpowiedzi i przełączniki zostaną usunięte z tego urządzenia i Twojego konta. Tej operacji nie można cofnąć.',
};
