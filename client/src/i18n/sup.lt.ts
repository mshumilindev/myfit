/** Supplements strings (Lithuanian). See `sup.en.ts`. */
import type { supEn } from './sup.en';

const p3 = (n: number, one: string, few: string, many: string): string => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m100 !== 12 && (m100 < 11 || m100 > 19)) return few;
  return many;
};
/** "1 kaušelis", "2 kaušeliai", "10 kaušelių", "1.5 kaušelio": a fraction takes the singular genitive. */
const counted = (n: string, one: string, few: string, many: string, frac: string): string => {
  const v = Number(n);
  return `${n} ${Number.isInteger(v) ? p3(v, one, few, many) : frac}`;
};

export const supLt: typeof supEn = {
  supTitle: 'Papildai',
  supRowEmpty: 'Ką vartoji, kad skaičiai būtų tikslesni',
  supOnbSub: 'Ką vartoji',

  supHubUse: 'Ką vartoju',
  supHubSchedule: 'Tvarkaraštis',
  supHubScheduleNone: 'Kasdien arba treniruočių dienomis',
  supHubScheduleVal: (daily, training) =>
    [daily > 0 ? `${daily} kasdien` : '', training > 0 ? `${training} treniruočių dienomis` : '']
      .filter(Boolean)
      .join(' · '),
  supHubAsk: 'Klausti skiltyje Šiandien',
  supHubAskSub: 'Vienas klausimas per dieną apie vartotus papildus',
  supHubFoot: 'Privatu. Naudojama tik tavo skaičiams tikslinti.',
  supItemsTail: (n) => `${n} ${p3(n, 'pozicija', 'pozicijos', 'pozicijų')}`,
  supMore: (n) => `dar ${n}`,
  supCount: (n) => `${n} ${p3(n, 'papildas', 'papildai', 'papildų')}`,

  supListIntro:
    'Pasirink vartojamus papildus. Atidaryk grupę, kad nustatytum dozę, laiką ir tvarkaraštį. Niekas nėra registruojama pagal dienas.',
  supListSummarySub: (n, daily) =>
    `${n} ${p3(n, 'papildas', 'papildai', 'papildų')} · ${daily} kasdien`,
  supListGroups: 'Grupės',
  supListFoot:
    'Dozės – tipinės porcijos iš katalogo. Treniruočių dienos automatiškai atitinka tavo treniruočių planą.',
  supEvidenceRow: 'Įrodymai ir šaltiniai',
  supEvidenceRowSub: 'Informacija · kaip vertinami poveikiai',

  supGroup: {
    performance: 'Rezultatai',
    protein: 'Baltymai ir aminorūgštys',
    recovery: 'Atsigavimas ir miegas',
    health: 'Sveikatos pagrindai',
  },
  supGroupBlurb: {
    performance: 'Kreatinas, kofeinas, prieštreniruotiniai, nitratai…',
    protein: 'Išrūgų, kazeino, augaliniai baltymai, EAA, kolagenas…',
    recovery: 'Magnis, melatoninas, omega-3, vyšnios…',
    health: 'Vitaminas D, multivitaminai, cinkas, geležis…',
  },
  supItem: {
    creatine: 'Kreatino monohidratas',
    caffeine: 'Kofeinas',
    preWorkout: 'Prieštreniruotinis mišinys',
    betaAlanine: 'Beta-alaninas',
    citrulline: 'Citrulinas',
    nitrate: 'Nitratai (burokėliai)',
    bicarbonate: 'Natrio bikarbonatas (soda)',
    whey: 'Išrūgų baltymai',
    casein: 'Kazeinas',
    plantProtein: 'Augaliniai baltymai',
    eaa: 'Nepakeičiamosios aminorūgštys (EAA)',
    bcaa: 'BCAA',
    glutamine: 'Glutaminas',
    hmb: 'HMB',
    collagen: 'Kolagenas',
    magnesium: 'Magnis',
    melatonin: 'Melatoninas',
    glycine: 'Glicinas',
    ashwagandha: 'Ašvagandha',
    omega3: 'Omega-3',
    tartCherry: 'Rūgščiosios vyšnios (sultys)',
    curcumin: 'Kurkuminas',
    vitaminD: 'Vitaminas D',
    multivitamin: 'Multivitaminai',
    zinc: 'Cinkas',
    iron: 'Geležis',
    vitaminC: 'Vitaminas C',
    vitaminE: 'Vitaminas E',
    probiotics: 'Probiotikai',
    vitaminB12: 'Vitaminas B12',
    calcium: 'Kalcis',
  },
  supItemShort: {
    creatine: 'Kreatinas',
    caffeine: 'Kofeinas',
    preWorkout: 'Prieštreniruotinis',
    betaAlanine: 'Beta-alaninas',
    citrulline: 'Citrulinas',
    nitrate: 'Nitratai',
    bicarbonate: 'Soda',
    whey: 'Išrūgų',
    casein: 'Kazeinas',
    plantProtein: 'Augaliniai baltymai',
    eaa: 'EAA',
    bcaa: 'BCAA',
    glutamine: 'Glutaminas',
    hmb: 'HMB',
    collagen: 'Kolagenas',
    magnesium: 'Magnis',
    melatonin: 'Melatoninas',
    glycine: 'Glicinas',
    ashwagandha: 'Ašvagandha',
    omega3: 'Omega-3',
    tartCherry: 'Vyšnios',
    curcumin: 'Kurkuminas',
    vitaminD: 'Vitaminas D',
    multivitamin: 'Multivitaminai',
    zinc: 'Cinkas',
    iron: 'Geležis',
    vitaminC: 'Vitaminas C',
    vitaminE: 'Vitaminas E',
    probiotics: 'Probiotikai',
    vitaminB12: 'Vitaminas B12',
    calcium: 'Kalcis',
  },
  supItemBlurb: {
    creatine: 'Jėga ir galia trumpose, sunkiose pastangose',
    caffeine: 'Budrumas ir šiek tiek daugiau jėgų treniruotėje',
    preWorkout: 'Mišinys, dažniausiai su kofeinu; patikrink etiketę',
    betaAlanine: 'Sunkios pastangos nuo vienos iki keturių minučių',
    citrulline: 'Kraujotakai ir ištvermei kartotinėse serijose',
    nitrate: 'Ištvermės pastangoms; burokėlių šotas',
    bicarbonate: 'Trumpos, labai sunkios pastangos',
    whey: 'Patogus būdas pasiekti baltymų normą',
    casein: 'Lėtai įsisavinami baltymai, dažnai vakare',
    plantProtein: 'Žirnių, ryžių ar sojų mišiniai',
    eaa: 'Aminorūgštys, kurių organizmas pats negamina',
    bcaa: 'Trys iš nepakeičiamųjų aminorūgščių',
    glutamine: 'Populiarus atsigavimui; įrodymų treniruotėms mažai',
    hmb: 'Leucino metabolitas; silpni įrodymai treniruotiems žmonėms',
    collagen: 'Sausgyslės ir sąnariai; ne pilnavertis baltymas',
    magnesium: 'Mėšlungis ir miegas; silpni įrodymai',
    melatonin: 'Šiek tiek greičiau užmigti',
    glycine: 'Miego kokybė; ankstyvi įrodymai',
    ashwagandha: 'Stresas ir miegas; ankstyvi ar nevienareikšmiai rezultatai',
    omega3: 'Žuvų taukai; raumenų skausmas ir bendra sveikata',
    tartCherry: 'Raumenų skausmas po sunkių treniruočių; ankstyvi įrodymai',
    curcumin: 'Raumenų skausmas ir uždegimas; ankstyvi įrodymai',
    vitaminD: 'Naudingas, jei jo trūksta; pasidaryk kraujo tyrimą',
    multivitamin: 'Atsarginis variantas, kai mityba ribota',
    zinc: 'Padeda tik jei mityboje jo trūksta',
    iron: 'Tik jei kraujo tyrimas rodo trūkumą',
    vitaminC: 'Didelės dozės gali slopinti prisitaikymą prie treniruočių',
    vitaminE: 'Didelės dozės gali slopinti prisitaikymą prie treniruočių',
    probiotics: 'Žarnyno sveikata; priklauso nuo štamo',
    vitaminB12: 'Daugiausia veganams ir vegetarams',
    calcium: 'Tik jei mityboje jo trūksta',
  },
  supTiming: {
    anytime: 'Bet kada',
    morning: 'Ryte',
    preWorkout: 'Prieš treniruotę',
    withMeal: 'Su maistu',
    postWorkout: 'Po treniruotės',
    evening: 'Vakare',
  },
  supSchedule: { daily: 'Kasdien', trainingDays: 'Treniruočių dienomis' },
  supEvidence: { strong: 'Stiprūs', moderate: 'Vidutiniai', weak: 'Silpni', none: 'Nėra' },
  supDose: {
    g: (n) => `${n} g`,
    mg: (n) => `${n} mg`,
    µg: (n) => `${n} µg`,
    ml: (n) => `${n} ml`,
    scoop: (n) => counted(n, 'kaušelis', 'kaušeliai', 'kaušelių', 'kaušelio'),
    serving: (n) => counted(n, 'porcija', 'porcijos', 'porcijų', 'porcijos'),
  },
  supUnit: { g: 'g', mg: 'mg', µg: 'µg', ml: 'ml', scoop: 'kaušelių', serving: 'porcijų' },
  supMin: 'min.',
  supKg: 'kg',
  supPerKg: 'kg svorio',

  supSheetSchedule: 'Tvarkaraštis',
  supSheetScheduleHelp: 'Treniruočių dienos automatiškai atitinka tavo treniruočių planą.',
  supSheetItem: 'Papildas',
  supSaved: 'išsaugota',
  supServing: 'Porcija',
  supExact: 'Tikslus kiekis',
  supTimingLabel: 'Laikas',
  supTypical: 'Tipinė porcija',
  supEvidenceLabel: 'Įrodymai',
  supInNumbers: 'Tavo skaičiuose',
  supNoEffect: 'Tik registruojama, poveikis nevertinamas',
  supNoEffectHere: 'Su šiuo laiku poveikis nevertinamas',
  supCaffeineIn: 'Kofeino porcijoje',
  supFx: {
    creatineStrength: 'Jėga, maždaug po 12 savaičių',
    creatineBodyweightKg: 'Kūno svoris, daugiausia vanduo',
    caffeineRpe: 'Pastangos treniruočių dienomis',
    caffeineSleepMin: 'Miego poreikis',
    proteinGrams: 'Įskaitoma į baltymus',
  },
  supProteinNote:
    'Šie gramai įskaitomi į tavo dienos baltymų normą. Maisto žurnalas atskiras: kokteilis, užrašytas ir kaip maistas, bus suskaičiuotas du kartus.',
  supRemove: 'Pašalinti šį papildą',
  supRemoveAsk: 'Pašalinti šį papildą?',
  supRemoveBody: (name) => `${name} nebebus įskaitomas tavo skaičiuose. Istorija nesaugoma.`,

  supQuickTitle: 'Ką vartoji reguliariai?',
  supQuickSub:
    'Pažymėk viską, kas tinka. Įrašysime tipines dozes ir laiką. Vėliau galėsi jas pakeisti.',
  supQuickAria: 'Dažni papildai',
  supQuickProtein: 'Baltymai',
  supQuickCaffeine: 'Kofeinas arba prieštreniruotinis',
  supQuickSaved: 'Išsaugota',
  supQuickSave: (n) =>
    n > 0 ? `Išsaugoti: ${n} ${p3(n, 'papildas', 'papildai', 'papildų')}` : 'Išsaugoti',
  supQuickMore: 'Tikslinti ir pridėti daugiau',

  supCalcTitle: 'Skaičiavimuose',
  supCalcMaster: 'Naudoti papildus mano skaičiuose',
  supCalcMasterSub: 'Jėga, miegas, pastangos, baltymai, tendencijos',
  supCalcMasterFoot: 'Išjunk, kad papildai liktų išsaugoti, bet neįtakotų jokių skaičių.',
  supCalcSurfaces: 'Pagrįsta tyrimais',
  supCalcSurfacesFoot:
    'Poveikiai nedideli, žmonėms skiriasi ir remiasi paskelbtais tyrimais. Žymos rodo, kokie stiprūs įrodymai.',
  supSf: {
    strength: { label: 'Tikėtina jėga', sub: 'Kreatinas: intervalas, rodomas skiltyje Progresas' },
    sleep: { label: 'Miegas', sub: 'Vėlai vartotas kofeinas gali padidinti miego poreikį' },
    rpe: {
      label: 'Pastangų (RPE) pastaba',
      sub: 'Kofeinas prieš treniruotę: pastangos gali atrodyti šiek tiek lengvesnės',
    },
    protein: { label: 'Baltymų norma', sub: 'Baltymų milteliai įskaitomi į dienos baltymus' },
    trends: { label: 'Tendencijos', sub: 'Kontekstas grafikuose, pvz., kreatino vanduo' },
    afterWorkoutHints: {
      label: 'Po treniruotės',
      sub: 'Užuominos apie tai, ką vartoji aplink treniruotes',
    },
  },
  supCalcSources: 'Šaltiniai',
  supCalcApprox: 'apytiksl.',
  supDisclaimer:
    'Papildų poveikis nedidelis, žmonėms skiriasi ir remiasi tyrimais, o ne garantijomis. Programa nekeičia tavo treniruočių krūvio dėl papildo. Tai nėra medicininis patarimas. Jei sergi ar vartoji vaistus, paklausk gydytojo.',

  supEvTitle: 'Įrodymai ir šaltiniai',
  supEvIntro: 'Kiekvienas papildas turi žymą, rodančią, kokie stiprūs už jo stovintys tyrimai.',
  supEvLegend: {
    strong: 'Daug kokybiškų tyrimų sutampa.',
    moderate: 'Keli kokybiški tyrimai arba nevienodi rezultatai.',
    weak: 'Ankstyvi, maži ar prieštaringi tyrimai.',
    none: 'Programa jokio poveikio nevertina.',
  },

  supWarnHead: 'Saugumas',
  supWarn: {
    kidney: (n) => `${n}: jei sergi inkstų liga, pirma paklausk gydytojo.`,
    hypertension: (n) => `${n}: gali padidinti kraujospūdį. Paklausk gydytojo, jei jis aukštas.`,
    anticoagulants: (n) =>
      `${n}: gali sustiprinti kraują skystinančių vaistų poveikį. Paklausk gydytojo, jei jų vartoji.`,
    wada: (n) =>
      `${n}: mišiniuose gali būti varžybose draudžiamų medžiagų. Patikrink etiketę, jei tave tikrina dėl dopingo.`,
    pregnancy: (n) => `${n}: nėštumo ar žindymo metu pirma paklausk gydytojo.`,
    minors: (n) => `${n}: nerekomenduojama iki 18 metų.`,
    antioxidantBlunt: (n) => `${n}: didelės dozės gali sumažinti treniruočių naudą.`,
    ashwagandha: (n) =>
      `${n}: retais atvejais siejama su kepenų problemomis ir gali veikti skydliaukę. Jei sergi ar vartoji vaistus, paklausk gydytojo.`,
    deficiencyOnly: (n) =>
      `${n}: naudinga tik jei jo trūksta. Prieš vartodamas ilgai, pasidaryk kraujo tyrimą.`,
    giUpset: (n) => `${n}: gali dirginti skrandį. Pradėk nuo mažos dozės.`,
    caffeineDailyLimit: (n) =>
      `Kofeino iš ${n} kartu daugiau nei 400 mg treniruotės dieną, tai viršija įprastą dienos ribą.`,
    caffeineSingleDose: (n) =>
      `${n}: daugiau nei 3 mg kofeino vienam kūno svorio kg per vieną kartą.`,
    caffeineLate: (n) =>
      `${n}: vėlai suvartotas kofeinas gali sutrumpinti miegą. Baik vartoti likus 8–9 val. iki miego.`,
  },

  supPrivSeeEffects: '„Jėga +0–8 %, miego poreikis +10 min.“ Be papildų ir dozių.',
  supPrivSeeFull: 'Tavo papildų pavadinimai, dozės ir laikas bei poveikiai.',
  supPrivPreviewHead: 'Treneris dabar matytų',
  supPrivPreviewNone: 'Kol kas nieko. Pridėk papildą, turintį poveikį.',
  supPrivPreviewNever: 'Kuriomis dienomis juos vartojai, niekada nesidalijama.',
  supPrivPreviewTotals: (caf, prot) => `Treniruotės dieną: kofeino ${caf} mg, baltymų ${prot} g.`,
  supPrivDelete: 'Ištrinti papildų duomenis',
  supPrivDeleteAsk: 'Ištrinti visus papildų duomenis?',
  supPrivDeleteBody:
    'Tavo papildai, dozės, atsakymai ir jungikliai bus pašalinti iš šio įrenginio ir tavo paskyros. Šito atšaukti negalima.',
};
