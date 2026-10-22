/** Cycle strings (Lithuanian). See `cyc.en.ts`. */
import type { cycEn } from './cyc.en';

export const cycLt: typeof cycEn = {
  cycTitle: 'Ciklas',
  cycRowOff: 'Nenustatyta',
  cycRowPaused: 'Išjungta nėštumo metu',
  cycRowMenopause: 'Išjungta po menopauzės',
  cycRowLog: 'Tik žurnalas',
  cycRowDay: (day, phase) => `${day} diena · ${phase}`,

  cycPhMenses: 'Mėnesinės',
  cycPhEarly: 'Ciklo pradžia',
  cycPhMid: 'Ciklo vidurys',
  cycPhLate: 'Ciklo pabaiga',
  cycHintMenses: 'Savijauta būna skirtinga. Orientuokis į tai, kaip jautiesi.',
  cycHintEarly: 'Daugelis čia jaučia daugiau energijos, bet ne visi.',
  cycHintMid: 'Be taisyklių: žiūrėk į RPE ir miegą.',
  cycHintLate: 'Kai kuriems atsistatyti sunkiau. Tai nebūtinai apie tave.',

  cycSetupIntro:
    'Įvesk vieną kartą, kada ciklas paprastai prasideda ir kiek trunka. Toliau žurnalas veda save pats: nieko nereikia rašyti ranka.',
  cycMode: 'Režimas',
  cycModeRegular: 'Reguliarus',
  cycModeIrregular: 'Nereguliarus',
  cycModeLog: 'Tik žurnalas',
  cycModeFootRegular: 'Pastovus ciklas: vertiname fazę ir kitą pradžią.',
  cycModeFootIrregular: 'Besikeičiantis ciklas: platesni intervalai ir tik apytikslė fazė.',
  cycModeFootLog:
    'Be vertinimų, tik kraujavimo dienos pagal tavo datas. Tinka vartojant hormoninę kontracepciją.',
  cycUsually: 'Paprastai',
  cycLastStart: 'Paskutinis ciklas prasidėjo',
  cycLength: 'Ciklo trukmė',
  cycPeriod: 'Mėnesinių trukmė',
  cycShortest: 'Trumpiausias ciklas',
  cycLongest: 'Ilgiausias ciklas',
  cycUsuallyFoot: 'Tik tavo tipinės reikšmės. Nieko daugiau nesugalvojame.',
  cycDaysUnit: 'd.',
  cycOutOfNorm: 'Šios reikšmės nepatenka į įprastą ribą. Verta paminėti gydytojui.',
  cycSave: 'Išsaugoti',
  cycCancel: 'Atšaukti',
  cycPrivate: 'Privatu. Užšifruota įrenginyje ir debesyje. Niekam nerodoma.',

  cycApprox: 'Įvertis',
  cycLikely: 'Tikėtina',
  cycDayOf: (day, len) => `${day} diena iš ~${len}`,
  cycNextStart: (from, to) =>
    from === to ? `Kita pradžia: ${from}` : `Kita pradžia: ${from} – ${to} (80 % intervalas)`,
  cycLogHead: 'Tik žurnalas',
  cycLogLast: (date) => `Paskutinis ciklas prasidėjo ${date}`,
  cycLogNote: 'Be vertinimų, tik užfiksuotos dienos.',
  cycCalendar: 'Kalendorius',
  cycLegendLogged: 'Užfiksuotos mėnesinės',
  cycUpdateDate: 'Atnaujinti pradžios datą',
  cycUpdateTitle: 'Kada prasidėjo paskutinis ciklas?',
  cycUpdateSave: 'Išsaugoti datą',
  cycSettings: 'Nustatymai',
  cycStale: 'Grafikas pasenęs. Vertinimai išjungti, kol neatnaujinsi datos.',
  cycStaleBtn: 'Atnaujinti datą',

  cycStates: 'Būsenos',
  cycStatesFoot: 'Pažymėjus čia, būsena iškart pridedama prie lėtinių, o Ciklas išsijungia.',
  cycMarkPreg: 'Pažymėti nėštumą',
  cycMarkMeno: 'Pažymėti menopauzę',
  cycPregTitle: 'Pažymėti nėštumą',
  cycPregBody:
    'Nurodyk pradžios datą (arba apytikslę). Trimestras nustatomas pats, o būsena atsiras tarp lėtinių.',
  cycPregInfo: (week) => `Apie ${week} savaitę`,
  cycPregAdd: 'Pridėti būseną',
  cycMenoTitle: 'Pažymėti menopauzę?',
  cycMenoBody: 'Menopauzė bus pridėta prie lėtinių būsenų, o Ciklas išsijungs. Duomenys išliks.',
  cycMenoConfirm: 'Pažymėti',

  cycOffTitle: 'Ciklas išjungtas',
  cycOffPregnancy:
    'Tarp lėtinių yra aktyvus nėštumas. Duomenys išsaugoti; jam pasibaigus paklausime naujos pradžios datos.',
  cycOffMenopause: 'Tarp lėtinių pažymėta menopauzė. Duomenys išsaugoti.',
  cycPausedNeutral: 'Pristabdyta',
  cycOffNeutral: 'Ciklas kol kas pristabdytas. Jūsų duomenys išsaugoti.',
  cycOpenStates: 'Atidaryti būsenas',
  cycAfterPause: 'Pertrauka baigėsi. Nurodyk, kada prasidėjo ciklas, kad tęstum.',

  cycWhere: 'Kur rodyti',
  cycWhereFoot:
    'Kiekvieną galima išjungti. Niekas čia nekeičia plano, progresijos ar automatiškai sudarytų treniruočių.',
  cycSurfToday: 'Žymė Today ekrane',
  cycSurfCalendar: 'Spalva kalendoriuje',
  cycSurfSession: 'Pastaba treniruotėje',
  cycDelete: 'Ištrinti ciklo duomenis',
  cycDeleteTitle: 'Ištrinti ciklo duomenis?',
  cycDeleteBody:
    'Datos ir nustatymai bus pašalinti iš įrenginio ir debesies. To atšaukti negalima.',
  cycDeleteConfirm: 'Ištrinti',
  cycPatterns: 'Dėsningumai',
  cycPatternsSub: 'Tavo pastangos pagal fazes',
  cycPatIntro:
    'Tai tavo paties įvertintos pastangos, o ne bendra taisyklė. Kiekviena fazė lyginama su to paties ciklo vidurkiu.',
  cycPatRow: (diff, lo, hi) => `${diff} RPE (${lo} … ${hi})`,
  cycPatHigher: 'Paprastai didesnės nei tavo vidurkis',
  cycPatLower: 'Paprastai mažesnės nei tavo vidurkis',
  cycPatSame: 'Nesiskiria nuo tavo vidurkio',
  cycPatCycles: (n) => `${n} ciklų`,
  cycPatEmptyTitle: 'Dar per mažai duomenų',
  cycPatEmptyBody: (n) =>
    `Reikia bent 3 ciklų su įvertintomis serijomis dviejose ar daugiau fazių. Ciklų kol kas: ${n}. Jie imami iš tavo įvestų pradžios datų.`,
  cycPatFoot:
    'Suporuotas skirtumas pagal ciklus, 95 % intervalas (bootstrap). Neįvertintos serijos ir apšilimas neskaičiuojami.',
  cycSessionHigher: (diff) =>
    `Šioje fazėje tavo įvertintos serijos paprastai ${diff} RPE didesnės už vidurkį. Planas nesikeičia.`,
  cycSessionLower: (diff) =>
    `Šioje fazėje tavo įvertintos serijos paprastai ${diff} RPE mažesnės už vidurkį. Planas nesikeičia.`,
};
