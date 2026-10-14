/** Coach Today + Decision strings (Lithuanian). See `coachToday.en.ts`. */
import type { TodayStrings } from './coachToday.en';
import { plural } from './coachPlural';

const P = (n: number, one: string, few: string, many: string) =>
  plural('lt', n, { one, few, many, other: many });

export const todayLt: TodayStrings = {
  queueTitle: 'Darbotvarkė',
  queueLoading: 'Kraunama',
  needDecision: (n) => P(n, '{n} reikia sprendimo', '{n} reikia sprendimo', '{n} reikia sprendimo'),
  requestsToAnswer: (n) =>
    P(
      n,
      '{n} prašymas laukia atsakymo',
      '{n} prašymai laukia atsakymo',
      '{n} prašymų laukia atsakymo',
    ),
  byPriority: 'Pagal svarbą',
  byStage: 'Pagal etapą',
  viewLabel: 'Rodinys',
  allSignals: 'Visi signalai',
  allDecisions: 'Visi sprendimai',
  liveCount: (n) => `${n} gyvai`,

  sectionRequests: 'Perkėlimo prašymai',
  sectionNeeds: 'Reikia sprendimo',
  sectionWatch: 'Stebėkite',
  moreInDigest: (n) => `Dar ${n} santraukoje`,
  hideDigest: 'Slėpti santraukos elementus',
  digestNote: 'Santrauka yra ryto apžvalga visko, ko čia nematyti.',

  stageSignal: 'Signalas',
  stageEvidence: 'Įrodymai',
  stageDecided: 'Nuspręsta',
  stageMeasuring: 'Matuojama',
  stageResult: 'Rezultatas',
  stageBoard: 'Etapų lenta, slinkite, kad matytumėte daugiau',
  stageFold: (l: string, folded: boolean) => (folded ? `Rodyti: ${l}` : `Sutraukti: ${l}`),
  stageEmpty: 'Čia tuščia',
  stageOpen: (name, stage) => `${name}, ${stage}`,
  boardSummary: (improved, total, pct, measuring, kg, days) =>
    `${improved} iš ${total} sprendimų pagerino rezultatą (${pct}%), ${measuring} dar matuojama. „Pagerėjo“ reiškia, kad pratimas pakilo bent ${kg} kg skaičiuojamo 1PM arba klientas grįžo prie plano per ${days} d.`,
  close: 'Uždaryti',
  drawerTitle: 'Sprendimas',

  urgent: 'Skubu',
  watch: 'Dėmesio',
  good: 'Gerai',
  decided: 'Nuspręsta',
  waiting: 'Laukiama',
  measuring: 'Matuojama',
  improved: 'Pagerėjo',
  noChange: 'Aiškaus pokyčio nėra',
  declined: 'Pablogėjo',
  confidence: (l): string =>
    l === 'high'
      ? 'Pasitikėjimas aukštas'
      : l === 'medium'
        ? 'Pasitikėjimas vidutinis'
        : 'Pasitikėjimas žemas',
  tagNew: 'Naujas',

  askMove: (name) => `${name} prašo perkelti treniruotę`,
  waitingFor: (name) => `Laukiama atsakymo: ${name}`,
  needsAnswer: 'Laukia jūsų atsakymo',
  moveFrom: 'Iš',
  moveTo: 'Į',
  accept: 'Priimti',
  decline: 'Atmesti',
  proposeAnother: 'Siūlyti kitą laiką',
  cancelRequest: 'Atšaukti prašymą',
  acceptFor: (name) => `Priimti perkėlimą: ${name}`,
  declineFor: (name) => `Atmesti perkėlimą: ${name}`,
  proposeFor: (name) => `Siūlyti kitą laiką: ${name}`,
  cancelFor: (name) => `Atšaukti prašymą: ${name}`,
  requestAccepted: (name) => `Priimta. ${name} gauna naują laiką pokalbyje.`,
  requestDeclined: (name) => `Atmesta. ${name} gauna žinutę pokalbyje.`,
  requestCancelled: (name) => `Prašymas ${name} atšauktas.`,
  requestFailed: 'Nepavyko išsiųsti atsakymo. Prašymas lieka sąraše, bandykite dar kartą.',

  messageTo: (name) => `Rašyti: ${name}`,
  seeEvidence: 'Įrodymai ir pasirinkimai',
  otherOptions: (n) =>
    P(n, '{n} kitas pasirinkimas', '{n} kiti pasirinkimai', '{n} kitų pasirinkimų'),
  moreOptions: 'Pasirinkimai',
  programWeek: (program, week) => `${program} · ${week} sav.`,
  heroLabel: (what) => `${what}, skaič. 1PM`,
  heroSets: (what) => `${what}, serijų per savaitę`,
  heroDays: 'Dienų nuo paskutinės treniruotės',
  heroNoChange: (weeks) =>
    P(weeks, 'be pokyčių {n} savaitę', 'be pokyčių {n} savaites', 'be pokyčių {n} savaičių'),
  heroSetsVs: (chronic) => `įprastai ${chronic}`,
  effectLine: (text, days) =>
    days == null ? text : `${text} Patikrinsime dar kartą po ${days} d.`,

  allClearTitle: 'Sprendimų nelaukia',
  allClearBody: (requests, measuring, days) => {
    const parts: string[] = [];
    if (requests > 0)
      parts.push(
        P(
          requests,
          'Vienas prašymas aukščiau laukia jūsų atsakymo.',
          `${requests} prašymai aukščiau laukia jūsų atsakymo.`,
          `${requests} prašymų aukščiau laukia jūsų atsakymo.`,
        ),
      );
    if (measuring > 0)
      parts.push(
        P(
          measuring,
          `${measuring} sprendimas dar matuojamas, rezultatas per ${days} d.`,
          `${measuring} sprendimai dar matuojami, rezultatas per ${days} d.`,
          `${measuring} sprendimų dar matuojama, rezultatas per ${days} d.`,
        ),
      );
    return parts.length
      ? parts.join(' ')
      : 'Šiandien nieko nereikia daryti. Likusi dalis yra santraukoje.';
  },
  seeBoard: 'Rodyti lentą',
  nothingTitle: 'Šiandien nieko nereikia daryti',
  nothingBody: 'Likusi dalis yra santraukoje.',
  updatedAt: (t) => `Atnaujinta ${t}`,
  staleRefreshing: (t) => `Atnaujinta ${t}, atnaujinama`,
  offlineNote: 'Nėra ryšio. Pakeitimai bus sinchronizuoti grįžus ryšiui.',
  offlineUpdated: (t) =>
    `Nėra ryšio. Rodomi ${t} duomenys. Pakeitimai bus sinchronizuoti grįžus ryšiui.`,
  unsynced: (n) =>
    P(
      n,
      '{n} pakeitimas laukia sinchronizavimo',
      '{n} pakeitimai laukia sinchronizavimo',
      '{n} pakeitimų laukia sinchronizavimo',
    ),
  retry: 'Bandyti dar kartą',
  errorTitle: 'Nepavyko įkelti skilties „Darbotvarkė“',
  errorBody:
    'Patikrinkite ryšį ir bandykite dar kartą. Nieko neprarasta: jūsų pakeitimai išsaugoti šiame įrenginyje.',
  tryAgain: 'Bandyti dar kartą',
  forbiddenTitle: 'Nėra prieigos prie trenerio duomenų',
  forbiddenBody: 'Jūsų paskyra dar negali skaityti klientų duomenų. Kreipkitės į administratorių.',
  vaultLockedTitle: 'Jūsų duomenys užrakinti',
  vaultLockedBody: 'Atrakinkite saugyklą ir bandykite dar kartą.',
  notFoundTitle: 'Šio signalo nebėra',
  notFoundBody: 'Jis išspręstas, atidėtas arba atmestas. „Darbotvarkė“ rodo tai, kas atvira dabar.',
  backToAgenda: 'Atgal į „Darbotvarkę“',
  weekBriefsTitle: 'Klientų nedaug, todėl eilės nėra',
  weekBriefsBody: 'Kai klientų mažiau nei 8, ekrane „Savaitė“ kiekvienas rodomas viena eilute.',

  backLabel: 'Darbotvarkė',
  decChoose: 'Pasirinkite, ką daryti',
  decNext: 'Kas bus toliau',
  decSuggested: 'Siūloma',
  decChosen: 'Pasirinkta',
  decRecord: 'Įrašyti sprendimą',
  decWait: 'Palaukti savaitę',
  decDismiss: 'Atmesti signalą',
  decWhy: 'Kodėl atmetate?',
  decPickOne: 'Pasirinkite vieną.',
  decReasonNotUseful: 'Nenaudinga',
  decReasonHandled: 'Jau sutvarkyta',
  decReasonWrong: 'Neteisingi duomenys',
  decDismissConfirm: 'Atmesti su priežastimi',
  decPickReason: 'Pasirinkite priežastį, kad atmestumėte.',
  decOptionsLabel: 'Pasirinkimai',
  nextProgram: 'Programa',
  nextResult: 'Rezultato patikra',
  nextSees: (name) => `${name} mato`,
  nextSeesBody: 'Naują programos versiją programėlėje.',
  nextNothingChanges: 'Programoje nieko nesikeičia.',
  nextMessage: (name) => `Žinutė: ${name}`,
  nextMessageSent: (name) => `Žinutė išsiųsta: ${name}`,
  nextMessageNote: 'Siunčiama kartu su sprendimu. Galite ją pataisyti.',
  nextMessageEdit: 'Redaguoti žinutę',
  nextMessageDone: 'Atlikta',
  nextNoChat: (name) => `${name} naudoja tik programą: pokalbio nėra, žinutė nesiunčiama.`,
  messageField: (name) => `Žinutė: ${name}`,
  resultStep: (days, kg) =>
    `Po ${days} d. Pagerėjimu laikoma tik tada, jei skaičiuojamas 1PM pasikeičia ${kg} kg ar daugiau.`,
  resultStepRhythm: (days) =>
    `Po ${days} d. Pagerėjimu laikoma, jei treniruočių per savaitę padaugėja bent 1.`,
  resultStepSpike: (days) =>
    `Po ${days} d. Pagerėjimu laikoma, jei savaitės serijos grįžta į įprastą ribą.`,
  waitStep: (date) => `Grąžinsime ${date}, nebent įrodymai sustiprės anksčiau.`,
  recordedTitle: (option, name) =>
    name ? `Įrašyta: ${option}. ${name} gavo žinutę.` : `Įrašyta: ${option}.`,
  recordedSub: (days, date) =>
    days == null || date == null
      ? 'Nėra ką matuoti.'
      : `Rezultatą patikrinsime po ${days} d. (${date}).`,
  recordedAria: 'Sprendimas įrašytas',
  undoText: 'Sprendimas įrašytas',
  undoLabel: 'Atšaukti',
  undoAria: 'Atšaukti šio sprendimo įrašą',
  snoozedTitle: 'Laukiame savaitę',
  snoozedBody: (date) => `Grąžinsime ${date}.`,
  dismissedTitle: 'Signalas atmestas',
  dismissedBody: 'Jis paslėptas 30 dienų, nebent įrodymai sustiprės.',
  dismissedWrongData: 'Pažymėta kaip neteisingi duomenys. Patikrinkite kliento duomenis profilyje.',
  acknowledge: 'Supratau',
  recording: 'Įrašoma',
  openProfile: (name) => `Profilis: ${name}`,
  noOptionsTitle: 'Programoje nėra ką keisti',
  noOptionsBody: 'Tai tik žinia. Galite palaukti savaitę arba atmesti.',

  evTitle: 'Įrodymai',
  evDate: 'Data',
  evSets: 'Serijos (kg × kartai)',
  evWeek: 'Savaitė',
  evValue: 'Skaič. 1PM',
  evValueSets: 'Serijos',
  evValueSessions: 'Treniruotės',
  evTable: 'Įrodymų lentelė',
  evChartAria: (what, from, to, unit) => `${what}: nuo ${from} iki ${to} ${unit}`,
  evChartUnit: 'Skaičiuojamas 1PM, kg',
  evChartUnitSets: 'Serijų per savaitę',
  evChartUnitSessions: 'Treniruočių per savaitę',
  evWeeksAgo: (n) => P(n, 'prieš {n} savaitę', 'prieš {n} savaites', 'prieš {n} savaičių'),
  evThisWeek: 'Ši savaitė',
  evNoData: 'Treniruočių dar per mažai (reikia 3)',
  evNeedsFull: 'Įrodymai pagal serijas reikalauja lygio „Pilnas“',
  evLocked: (name, what) => `${name} nesidalija: ${what}.`,
  evAsk: 'Paprašyti pasidalyti',
  evAskFor: (what) => `Paprašyti pasidalyti: ${what}`,
  evSimilar: (n, total) => `${n} iš ${total} panašių jūsų sprendimų tai padėjo.`,
  evShares: (name, list) => `${name} dalijasi: ${list}. Skaitymai registruojami ir matomi ${name}.`,
  evSharesNothing: (name) =>
    `${name} dar niekuo nesidalija. Skaitymai registruojami ir matomi ${name}.`,
  evMachine: (from, to) => `Skaič. 1PM nuo ${from} iki ${to} kg po pakeitimo`,
  evFactChange: (a, b) => `${a} → ${b}`,
  cat: {
    totals: 'treniruočių sumas',
    sets: 'serijas ir svorius',
    body: 'kūno svorį',
    sleep: 'miegą',
    injury: 'traumas',
    nutrition: 'mitybą',
    checkins: 'apklausų atsakymus',
  },

  sigStallTitle: (ex, weeks) =>
    `${ex}: be progreso ${P(weeks, '{n} savaitę', '{n} savaites', '{n} savaičių')}`,
  sigStallBody: (e1rm, weeks) =>
    `Skaičiuojamas 1PM laikosi ties ${e1rm} kg ${P(weeks, '{n} savaitę', '{n} savaites', '{n} savaičių')} esant pastoviam krūviui. Tas pats pratimas, ta pati įranga.`,
  sigStallLine: (ex, e1rm, weeks) =>
    `${ex}, skaič. 1PM ${e1rm} kg · be pokyčių ${P(weeks, '{n} savaitę', '{n} savaites', '{n} savaičių')}`,
  sigMachineTitle: 'Panašu į stagnaciją, bet tai kitas treniruoklis',
  sigMachineBody: (ex, from, to) =>
    `${ex}: skaič. 1PM pasikeitė nuo ${from} iki ${to} kg pakeitus treniruoklį. Reikšmės nepalyginamos, todėl tai ne stagnacija.`,
  sigMachineLine: (ex, to) => `${ex} · skaič. 1PM ${to} kg naujame treniruoklyje`,
  sigRhythmIdleTitle: (days) =>
    `Treniruotės nebuvo ${P(days, '{n} dieną', '{n} dienas', '{n} dienų')}`,
  sigRhythmLowTitle: 'Mažiau nei pusė suplanuotų treniruočių',
  sigRhythmBody: (low, idle) =>
    idle != null && idle > 7
      ? `Paskutinė treniruotė buvo prieš ${P(idle, '{n} dieną', '{n} dienas', '{n} dienų')}, o šią savaitę treniruočių suplanuota.`
      : `Mažiau nei pusė suplanuotų treniruočių atlikta kiekvieną iš paskutinių ${low} savaičių.`,
  sigRhythmLine: (idle) =>
    idle != null
      ? `Paskutinė treniruotė prieš ${P(idle, '{n} dieną', '{n} dienas', '{n} dienų')}`
      : 'Žemiau plano 2 savaites',
  sigSpikeTitle: (muscle, pct) => `${muscle}: krūvis +${pct}% per savaitę`,
  sigSpikeBody: (muscle, sets, chronic) =>
    `${sets} serijų per savaitę: ${muscle}, o įprastai ${chronic} per paskutines 4 savaites.`,
  sigSpikeLine: (muscle, sets, pct) => `${muscle}, ${sets} serijų · +${pct}%`,
  sigReadyTitle: (ex) => `Laikas pridėti svorio: ${ex}`,
  sigReadyBody: (n, rpe) =>
    `Paskutinės ${n} treniruotės buvo su RPE ${rpe} ar mažiau ir visais pakartojimais.`,
  sigReadyLine: (ex, rpe) => `${ex} · RPE ${rpe} ar mažiau`,
  sigPrTitle: (ex, e1rm) => `Naujas rekordas: ${ex} ${e1rm} kg`,
  sigPrBody: (gain, prev) =>
    `Skaičiuojamas 1PM didesnis ${gain} kg už ankstesnį geriausią (${prev} kg).`,
  sigPrLine: (ex, gain) => `${ex} · +${gain} kg`,
  sigInjuryTitle: (ex) => `${ex} prieštarauja apribojimui`,
  sigInjuryBody: (restriction, n) =>
    restriction
      ? `Programoje ${P(n, '{n} pratimas', '{n} pratimai', '{n} pratimų')}, kurių apribojimas neleidžia: ${restriction}.`
      : `Programoje ${P(n, '{n} pratimas', '{n} pratimai', '{n} pratimų')}, kurių trauma neleidžia.`,
  sigInjuryLine: (n) => `Konfliktas · ${P(n, '{n} pratimas', '{n} pratimai', '{n} pratimų')}`,
  sigNoSetsTitle: 'Tik sumos, be serijų',
  sigNoSetsBody: 'Treniruotės matomos, serijos ir svoriai ne. Nieko blogo.',
  sigNoSetsLine: (done) => (done == null ? 'Tik sumos' : `Treniruočių praėjusią savaitę: ${done}`),
  sigNoDataTitle: 'Treniruočių neįrašyta',
  sigNoDataBody:
    'Klientas žurnalą veda programėlėje, bet per paskutines 4 savaites treniruočių nėra.',
  sigNoDataLine: 'Nieko per 4 savaites',

  optVariation: 'Pridėti variantą + 1 serija',
  optDeload: 'Lengvesnė savaitė',
  optStep: 'Pridėti 2,5 kg',
  optSwap: 'Pakeisti pratimą',
  optLighter: 'Dvi lengvesnės savaitės',
  optWait: 'Palaukti savaitę',
  optDismiss: 'Atmesti signalą',
  opSets: (ex, from, to) => `${ex}: nuo ${from} iki ${to} serijų.`,
  opAdd: (ex, sets, reps) => `Prideda ${sets} × ${reps}: ${ex}.`,
  opWeight: (ex, from, to) => `${ex}: nuo ${from} iki ${to} kg.`,
  opWeightUp: (ex, kg) => `${ex}: +${kg} kg.`,
  opDeload: (pct, weeks) =>
    `${pct}% mažesnis krūvis ${P(weeks, '{n} savaitę', '{n} savaites', '{n} savaičių')}.`,
  opSwap: (from, to) => `Pakeičia ${from} į ${to}.`,
  opAltSafe: 'apribojimui saugią alternatyvą',
  opMessageDraft: (name, kind) => {
    switch (kind) {
      case 'stall':
        return `Labas, ${name}! Trumpas klausimas: kaip miegi ir valgai šią savaitę? Svoris šiame pratime nekyla jau mėnesį. Šiek tiek pakeičiau programą.`;
      case 'spike':
        return `Labas, ${name}! Praėjusi savaitė buvo daug sunkesnė nei įprastai. Šią sąmoningai palengvinau, tad neskubėk.`;
      case 'rhythm':
        return `Labas, ${name}! Pastebėjau, kad pastaruoju metu treniruočių mažiau. Artimiausias dvi savaites palengvinau. Parašyk, kas trukdo.`;
      case 'injury':
        return `Labas, ${name}! Pakeičiau pratimą, kuris netinka tavo apribojimui. Parašyk, jei kas nors dar skauda.`;
      case 'ready':
        return `Labas, ${name}! Paskutinės treniruotės buvo lengvos, todėl pridėjau šiek tiek svorio. Parašyk, kaip jaučiasi.`;
      default:
        return `Labas, ${name}! Atnaujinau tavo programą. Parašyk, kaip jaučiasi.`;
    }
  },

  resultLine: (result, before, after) =>
    before != null && after != null
      ? `${result} · skaič. 1PM nuo ${before} iki ${after} kg`
      : result,
  measuringDay: (day, total) => `Matuojama: ${day} diena iš ${total}`,
  waitUntil: (date) => `Grąžinsime ${date}`,
  decisionTitle: (ops) => ops,

  liveTitle: 'Dabar treniruojasi',
  liveSummary: (live, offline, finished) =>
    `${live} gyvai · ${offline} be ryšio · ${finished} baigė`,
  liveNow: 'Gyvai',
  liveOffline: 'Be ryšio',
  liveFinished: 'Baigė',
  liveSinceLine: (time, gym) => `${gym} · nuo ${time}`,
  liveLost: 'Ryšys nutrūko, jungiamasi iš naujo',
  liveFinishedLine: (sets, tonnes, gym) => `${sets} serijų · ${tonnes} t · ${gym}`,
  liveStatusNow: 'Treniruojasi',
  liveStatusOffline: 'Be ryšio, pauzė',
  liveStatusDone: 'Baigta',
  liveLastSeen: (s) => `Paskutinį kartą prieš ${s} s`,
  liveNone: 'Šiuo metu niekas netreniruojasi.',
  liveClosedAria: (n) => `${n} gyvai, atidaryti sąrašą`,
  livePrivacy:
    'Matote, kas treniruojasi ir kiek laiko. Serijos ir svoriai lieka pas klientą iki treniruotės pabaigos.',
  liveMinutes: (m) =>
    m >= 60 ? `${Math.floor(m / 60)} val. ${String(m % 60).padStart(2, '0')} min` : `${m} min`,
};
