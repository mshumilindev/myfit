/** Coach Today + Decision strings (Estonian). See `coachToday.en.ts`. */
import type { TodayStrings } from './coachToday.en';
import { plural } from './coachPlural';

const P = (n: number, one: string, other: string) => plural('et', n, { one, other });

export const todayEt: TodayStrings = {
  queueTitle: 'Päevakava',
  queueLoading: 'Laadimine',
  needDecision: (n) => P(n, '{n} vajab otsust', '{n} vajavad otsust'),
  requestsToAnswer: (n) => P(n, '{n} taotlus ootab vastust', '{n} taotlust ootab vastust'),
  byPriority: 'Tähtsuse järgi',
  byStage: 'Etapi järgi',
  viewLabel: 'Vaade',
  allSignals: 'Kõik signaalid',
  allDecisions: 'Kõik otsused',
  liveCount: (n) => `${n} otse`,

  sectionRequests: 'Ümberplaneerimise taotlused',
  sectionNeeds: 'Vajab otsust',
  sectionWatch: 'Hoia silma peal',
  moreInDigest: (n) => `Veel ${n} kokkuvõttes`,
  hideDigest: 'Peida kokkuvõtte read',
  digestNote: 'Kokkuvõte on hommikune ülevaade kõigest, mida siin ei näidata.',

  stageSignal: 'Signaal',
  stageEvidence: 'Tõendid',
  stageDecided: 'Otsustatud',
  stageMeasuring: 'Mõõdetakse',
  stageResult: 'Tulemus',
  stageBoard: 'Etappide tahvel, kerige rohkema nägemiseks',
  stageFold: (l: string, folded: boolean) => (folded ? `Näita: ${l}` : `Peida: ${l}`),
  stageEmpty: 'Siin on tühi',
  stageOpen: (name, stage) => `${name}, ${stage}`,
  boardSummary: (improved, total, pct, measuring, kg, days) =>
    `${improved} otsust ${total}-st parandas tulemust (${pct}%), ${measuring} on veel mõõtmisel. „Paranes“ tähendab, et harjutus tõusis vähemalt ${kg} kg hinnangulist 1KM-i või klient jõudis ${days} päeva jooksul plaanile tagasi.`,
  close: 'Sulge',
  drawerTitle: 'Otsus',

  urgent: 'Kiire',
  watch: 'Tähelepanu',
  good: 'Hea',
  decided: 'Otsustatud',
  waiting: 'Ootel',
  measuring: 'Mõõdetakse',
  improved: 'Paranes',
  noChange: 'Selget muutust pole',
  declined: 'Halvenes',
  confidence: (l): string =>
    l === 'high' ? 'Usaldus kõrge' : l === 'medium' ? 'Usaldus keskmine' : 'Usaldus madal',
  tagNew: 'Uus',

  askMove: (name) => `${name} palub treeningut nihutada`,
  waitingFor: (name) => `Ootame vastust: ${name}`,
  askedMove: (manager, name) => `${manager} palub kliendil ${name} treeningut nihutada`,
  needsAnswer: 'Ootab sinu vastust',
  moveFrom: 'Alates',
  moveTo: 'Uus aeg',
  accept: 'Nõustu',
  decline: 'Keeldu',
  proposeAnother: 'Paku muud aega',
  cancelRequest: 'Tühista taotlus',
  acceptFor: (name) => `Nõustu nihkega: ${name}`,
  declineFor: (name) => `Keeldu nihkest: ${name}`,
  proposeFor: (name) => `Paku muud aega: ${name}`,
  cancelFor: (name) => `Tühista taotlus: ${name}`,
  requestAccepted: (name) => `Nõus. ${name} saab uue aja vestluses.`,
  requestDeclined: (name) => `Keeldutud. ${name} saab teate vestluses.`,
  requestCancelled: (name) => `Taotlus (${name}) tühistatud.`,
  requestFailed: 'Vastust ei õnnestunud saata. Taotlus jääb nimekirja, proovi uuesti.',

  messageTo: (name) => `Kirjuta: ${name}`,
  seeEvidence: 'Tõendid ja valikud',
  otherOptions: (n) => P(n, '{n} muu valik', '{n} muud valikut'),
  moreOptions: 'Valikud',
  programWeek: (program, week) => `${program} · ${week}. nädal`,
  heroLabel: (what) => `${what}, hinnang. 1KM`,
  heroSets: (what) => `${what}, seeriaid nädalas`,
  heroDays: 'Päevi viimasest treeningust',
  heroNoChange: (weeks) => P(weeks, 'muutuseta {n} nädal', 'muutuseta {n} nädalat'),
  heroSetsVs: (chronic) => `tavaliselt ${chronic}`,
  effectLine: (text, days) =>
    days == null ? text : `${text} Kontrollime uuesti ${days} päeva pärast.`,

  allClearTitle: 'Otsuseid ei ole ootel',
  allClearBody: (requests, measuring, days) => {
    const parts: string[] = [];
    if (requests > 0)
      parts.push(
        P(
          requests,
          'Üks taotlus ootab ülal sinu vastust.',
          `${requests} taotlust ootab ülal sinu vastust.`,
        ),
      );
    if (measuring > 0)
      parts.push(
        P(
          measuring,
          `${measuring} otsus on veel mõõtmisel, tulemus ${days} päeva jooksul.`,
          `${measuring} otsust on veel mõõtmisel, tulemus ${days} päeva jooksul.`,
        ),
      );
    return parts.length ? parts.join(' ') : 'Täna ei vaja miski sind. Ülejäänu on kokkuvõttes.';
  },
  seeBoard: 'Ava tahvel',
  nothingTitle: 'Täna ei vaja miski sind',
  nothingBody: 'Ülejäänu on kokkuvõttes.',
  updatedAt: (t) => `Uuendatud ${t}`,
  staleRefreshing: (t) => `Uuendatud ${t}, värskendan`,
  offlineNote: 'Ühendus puudub. Muudatused sünkroonitakse, kui ühendus taastub.',
  offlineUpdated: (t) =>
    `Ühendus puudub. Näitan andmeid kellaajast ${t}. Muudatused sünkroonitakse, kui ühendus taastub.`,
  unsynced: (n) => P(n, '{n} muudatus ootab sünkroonimist', '{n} muudatust ootab sünkroonimist'),
  retry: 'Proovi uuesti',
  errorTitle: 'Vaadet „Päevakava“ ei õnnestunud laadida',
  errorBody:
    'Kontrolli ühendust ja proovi uuesti. Midagi ei kadunud: sinu muudatused on salvestatud sellel seadmel.',
  tryAgain: 'Proovi uuesti',
  forbiddenTitle: 'Treeneri andmetele ligipääsu pole',
  forbiddenBody: 'Sinu konto ei saa veel kliendi andmeid lugeda. Küsi administraatorilt.',
  vaultLockedTitle: 'Sinu andmed on lukus',
  vaultLockedBody: 'Ava hoidla ja proovi uuesti.',
  notFoundTitle: 'Seda signaali enam pole',
  notFoundBody:
    'See on otsustatud, edasi lükatud või kõrvale jäetud. Vaates „Päevakava“ on see, mis on praegu lahti.',
  backToAgenda: 'Tagasi vaatesse „Päevakava“',
  weekBriefsTitle: 'Kliente on vähe, seega järjekorda pole',
  weekBriefsBody: 'Alla 8 kliendi korral näitab nädalavaade igaüht ühel real.',

  backLabel: 'Päevakava',
  decChoose: 'Vali, mida teha',
  decNext: 'Mis edasi saab',
  decSuggested: 'Soovitatud',
  decChosen: 'Valitud',
  decRecord: 'Salvesta otsus',
  decWait: 'Oota nädal',
  decDismiss: 'Jäta signaal kõrvale',
  decWhy: 'Miks kõrvale jätad?',
  decPickOne: 'Vali üks.',
  decReasonNotUseful: 'Pole kasulik',
  decReasonHandled: 'Juba lahendatud',
  decReasonWrong: 'Valed andmed',
  decDismissConfirm: 'Jäta põhjusega kõrvale',
  decPickReason: 'Vali põhjus, et kõrvale jätta.',
  decOptionsLabel: 'Valikud',
  nextProgram: 'Programm',
  nextResult: 'Tulemuse kontroll',
  nextSees: (name) => `${name} näeb`,
  nextSeesBody: 'Programmi uut versiooni rakenduses.',
  nextNothingChanges: 'Programmis midagi ei muutu.',
  nextMessage: (name) => `Sõnum: ${name}`,
  nextMessageSent: (name) => `Sõnum saadetud: ${name}`,
  nextMessageNote: 'Saadetakse koos otsusega. Saad seda enne muuta.',
  nextMessageEdit: 'Muuda sõnumit',
  nextMessageDone: 'Valmis',
  nextNoChat: (name) => `${name} kasutab ainult programmi: vestlust pole, sõnumit ei saadeta.`,
  messageField: (name) => `Sõnum: ${name}`,
  resultStep: (days, kg) =>
    `${days} päeva pärast. Paranemiseks loetakse ainult siis, kui hinnanguline 1KM muutub ${kg} kg või rohkem.`,
  resultStepRhythm: (days) =>
    `${days} päeva pärast. Paranemiseks loetakse, kui treeninguid nädalas lisandub vähemalt 1.`,
  resultStepSpike: (days) =>
    `${days} päeva pärast. Paranemiseks loetakse, kui nädala seeriad on tagasi tavapärases vahemikus.`,
  waitStep: (date) => `Toome selle tagasi ${date}, kui tõendid varem ei tugevne.`,
  recordedTitle: (option, name) =>
    name ? `Salvestatud: ${option}. ${name} sai sõnumi.` : `Salvestatud: ${option}.`,
  recordedSub: (days, date) =>
    days == null || date == null
      ? 'Mõõta pole midagi.'
      : `Kontrollime tulemust ${days} päeva pärast (${date}).`,
  recordedAria: 'Otsus salvestatud',
  undoText: 'Otsus salvestatud',
  undoLabel: 'Võta tagasi',
  undoAria: 'Võta selle otsuse salvestamine tagasi',
  snoozedTitle: 'Ootame nädala',
  snoozedBody: (date) => `Toome selle tagasi ${date}.`,
  dismissedTitle: 'Signaal kõrvale jäetud',
  dismissedBody: 'See jääb 30 päevaks peidetuks, kui tõendid ei tugevne.',
  dismissedWrongData: 'Märgitud valeks andmeks. Kontrolli kliendi andmeid profiilis.',
  acknowledge: 'Selge',
  recording: 'Salvestan',
  openProfile: (name) => `Profiil: ${name}`,
  noOptionsTitle: 'Programmis pole midagi muuta',
  noOptionsBody: 'See on teadmiseks. Võid nädala oodata või kõrvale jätta.',

  evTitle: 'Tõendid',
  evDate: 'Kuupäev',
  evSets: 'Seeriad (kg × kordust)',
  evWeek: 'Nädal',
  evValue: 'Hinnang. 1KM',
  evValueSets: 'Seeriad',
  evValueSessions: 'Treeningud',
  evTable: 'Tõendite tabel',
  evChartAria: (what, from, to, unit) => `${what}: ${from} kuni ${to} ${unit}`,
  evChartUnit: 'Hinnanguline 1KM, kg',
  evChartUnitSets: 'Seeriaid nädalas',
  evChartUnitSessions: 'Treeninguid nädalas',
  evWeeksAgo: (n) => P(n, '{n} nädal tagasi', '{n} nädalat tagasi'),
  evThisWeek: 'See nädal',
  evNoData: 'Treeninguid on veel vähe (vaja 3)',
  evNeedsFull: 'Seeriate kaupa tõendid vajavad taset „Täielik“',
  evLocked: (name, what) => `${name} ei jaga: ${what}.`,
  evAsk: 'Palu jagada',
  evAskFor: (what) => `Palu jagada: ${what}`,
  evSimilar: (n, total) => `${n}-s sinu ${total}-st sarnasest otsusest see aitas.`,
  evShares: (name, list) => `${name} jagab: ${list}. Lugemised logitakse ja ${name} näeb neid.`,
  evSharesNothing: (name) =>
    `${name} ei jaga veel midagi. Lugemised logitakse ja ${name} näeb neid.`,
  evMachine: (from, to) => `Hinnang. 1KM ${from} kuni ${to} kg pärast muutust`,
  evFactChange: (a, b) => `${a} → ${b}`,
  cat: {
    totals: 'treeningute kokkuvõtteid',
    sets: 'seeriaid ja raskusi',
    body: 'kehakaalu',
    sleep: 'und',
    injury: 'vigastusi',
    nutrition: 'toitumist',
    checkins: 'check-in vastuseid',
  },

  sigStallTitle: (ex, weeks) => `${ex}: edasiminekut pole ${P(weeks, '{n} nädal', '{n} nädalat')}`,
  sigStallBody: (e1rm, weeks) =>
    `Hinnanguline 1KM on püsinud ${e1rm} kg juures ${P(weeks, '{n} nädal', '{n} nädalat')} püsiva mahu juures. Sama harjutus, sama varustus.`,
  sigStallLine: (ex, e1rm, weeks) =>
    `${ex}, hinnang. 1KM ${e1rm} kg · muutuseta ${P(weeks, '{n} nädal', '{n} nädalat')}`,
  sigMachineTitle: 'Näeb välja nagu seisak, aga see on teine masin',
  sigMachineBody: (ex, from, to) =>
    `${ex}: hinnanguline 1KM muutus masina vahetusel ${from}-st ${to} kg-ni. Väärtused pole võrreldavad, seega see pole seisak.`,
  sigMachineLine: (ex, to) => `${ex} · hinnang. 1KM ${to} kg uuel masinal`,
  sigRhythmIdleTitle: (days) => `Treeningut pole olnud ${P(days, '{n} päev', '{n} päeva')}`,
  sigRhythmLowTitle: 'Alla poole planeeritud treeningutest',
  sigRhythmBody: (low, idle) =>
    idle != null && idle > 7
      ? `Viimasest treeningust on ${P(idle, '{n} päev', '{n} päeva')}, kuigi sel nädalal on treeninguid planeeritud.`
      : `Alla poole planeeritud treeningutest tehti kummalgi viimasel ${low} nädalal.`,
  sigRhythmLine: (idle) =>
    idle != null
      ? `Viimane treening ${P(idle, '{n} päev', '{n} päeva')} tagasi`
      : 'Plaanist allpool 2 nädalat',
  sigSpikeTitle: (muscle, pct) => `${muscle}: maht +${pct}% nädalaga`,
  sigSpikeBody: (muscle, sets, chronic) =>
    `${sets} seeriat nädalas (${muscle}), viimase 4 nädala tavapärane ${chronic}.`,
  sigSpikeLine: (muscle, sets, pct) => `${muscle}, ${sets} seeriat · +${pct}%`,
  sigReadyTitle: (ex) => `On aeg lisada raskust: ${ex}`,
  sigReadyBody: (n, rpe) =>
    `Viimased ${n} treeningut olid RPE ${rpe} või madalamad, kõik kordused tehtud.`,
  sigReadyLine: (ex, rpe) => `${ex} · RPE ${rpe} või madalam`,
  sigPrTitle: (ex, e1rm) => `Uus rekord: ${ex} ${e1rm} kg`,
  sigPrBody: (gain, prev) =>
    `Hinnanguline 1KM on ${gain} kg eelmisest parimast (${prev} kg) kõrgem.`,
  sigPrLine: (ex, gain) => `${ex} · +${gain} kg`,
  sigInjuryTitle: (ex) => `${ex} läheb piiranguga vastuollu`,
  sigInjuryBody: (restriction, n) =>
    restriction
      ? `Programmis on ${P(n, '{n} harjutus', '{n} harjutust')}, mida piirang välistab: ${restriction}.`
      : `Programmis on ${P(n, '{n} harjutus', '{n} harjutust')}, mida vigastus välistab.`,
  sigInjuryLine: (n) => `Vastuolu · ${P(n, '{n} harjutus', '{n} harjutust')}`,
  sigNoSetsTitle: 'Jagatud on vaid kokkuvõtted, seeriaid pole',
  sigNoSetsBody: 'Treeningud on nähtavad, seeriad ja raskused mitte. Midagi pole valesti.',
  sigNoSetsLine: (done) =>
    done == null ? 'Ainult kokkuvõtted' : `Treeninguid eelmisel nädalal: ${done}`,
  sigNoDataTitle: 'Treeninguid pole logitud',
  sigNoDataBody: 'Klient peab logi rakenduses, aga viimase 4 nädala jooksul pole ühtki treeningut.',
  sigNoDataLine: 'Midagi pole 4 nädalat',

  optVariation: 'Lisa variatsioon + 1 seeria',
  optDeload: 'Kergem nädal',
  optStep: 'Lisa 2,5 kg',
  optSwap: 'Vaheta harjutus',
  optLighter: 'Kaks kergemat nädalat',
  optWait: 'Oota nädal',
  optDismiss: 'Jäta signaal kõrvale',
  opSets: (ex, from, to) => `${ex}: ${from}-st ${to} seeriani.`,
  opAdd: (ex, sets, reps) => `Lisab ${sets} × ${reps}: ${ex}.`,
  opWeight: (ex, from, to) => `${ex}: ${from}-st ${to} kg-ni.`,
  opWeightUp: (ex, kg) => `${ex}: +${kg} kg.`,
  opDeload: (pct, weeks) => `${pct}% väiksem maht ${P(weeks, '{n} nädalaks', '{n} nädalaks')}.`,
  opSwap: (from, to) => `Vahetab ${from} harjutuse ${to} vastu.`,
  opAltSafe: 'piiranguga sobiva alternatiivi',
  opMessageDraft: (name, kind) => {
    switch (kind) {
      case 'stall':
        return `Tere, ${name}! Kiire küsimus: kuidas sa sel nädalal magad ja sööd? Selle harjutuse raskus pole kuu aega tõusnud. Muutsin programmi veidi.`;
      case 'spike':
        return `Tere, ${name}! Eelmine nädal oli tavapärasest palju raskem. Selle nädala tegin meelega kergemaks, nii et ära kiirusta.`;
      case 'rhythm':
        return `Tere, ${name}! Märkasin, et treeninguid on viimasel ajal vähem. Tegin järgmised kaks nädalat kergemaks. Kirjuta, mis segab.`;
      case 'injury':
        return `Tere, ${name}! Vahetasin välja harjutuse, mis sinu piiranguga ei sobi. Anna teada, kui midagi veel valutab.`;
      case 'ready':
        return `Tere, ${name}! Viimased treeningud olid kerged, seega lisasin veidi raskust. Anna teada, kuidas tundub.`;
      default:
        return `Tere, ${name}! Uuendasin sinu programmi. Anna teada, kuidas tundub.`;
    }
  },

  resultLine: (result, before, after) =>
    before != null && after != null
      ? `${result} · hinnang. 1KM ${before} kuni ${after} kg`
      : result,
  measuringDay: (day, total) => `Mõõdetakse: ${day}. päev ${total}-st`,
  waitUntil: (date) => `Tagasi ${date}`,
  decisionTitle: (ops) => ops,

  liveTitle: 'Praegu treenivad',
  liveSummary: (live, offline, finished) =>
    `${live} otse · ${offline} ühenduseta · ${finished} lõpetas`,
  liveNow: 'Otse',
  liveOffline: 'Ühenduseta',
  liveFinished: 'Lõpetanud',
  liveSinceLine: (time, gym) => `${gym} · alates ${time}`,
  liveLost: 'Ühendus katkes, ühendan uuesti',
  liveFinishedLine: (sets, tonnes, gym) => `${sets} seeriat · ${tonnes} t · ${gym}`,
  liveStatusNow: 'Treenib',
  liveStatusOffline: 'Ühenduseta, paus',
  liveStatusDone: 'Lõpetatud',
  liveLastSeen: (s) => `Viimati ${s} s tagasi`,
  liveNone: 'Praegu keegi ei treeni.',
  liveClosedAria: (n) => `${n} otse, ava nimekiri`,
  livePrivacy:
    'Sa näed, kes treenib ja kui kaua. Seeriad ja raskused jäävad kliendi juurde treeningu lõpuni.',
  liveMinutes: (m) =>
    m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`,
};
