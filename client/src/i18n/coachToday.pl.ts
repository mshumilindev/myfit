/** Coach Today + Decision strings (Polish). See `coachToday.en.ts`. */
import type { TodayStrings } from './coachToday.en';
import { plural } from './coachPlural';

const P = (n: number, one: string, few: string, many: string) =>
  plural('pl', n, { one, few, many, other: many });

export const todayPl: TodayStrings = {
  queueTitle: 'Agenda',
  queueLoading: 'Ładowanie',
  needDecision: (n) => P(n, '{n} wymaga decyzji', '{n} wymagają decyzji', '{n} wymaga decyzji'),
  requestsToAnswer: (n) =>
    P(
      n,
      '{n} prośba czeka na odpowiedź',
      '{n} prośby czekają na odpowiedź',
      '{n} próśb czeka na odpowiedź',
    ),
  byPriority: 'Wg priorytetu',
  byStage: 'Wg etapu',
  viewLabel: 'Widok',
  allSignals: 'Wszystkie sygnały',
  allDecisions: 'Wszystkie decyzje',
  liveCount: (n) => `${n} na żywo`,

  sectionRequests: 'Prośby o przeniesienie',
  sectionNeeds: 'Wymaga decyzji',
  sectionWatch: 'Miej na oku',
  moreInDigest: (n) => `Jeszcze ${n} w podsumowaniu`,
  hideDigest: 'Ukryj pozycje podsumowania',
  digestNote: 'Podsumowanie to poranny przegląd wszystkiego, czego tu nie widać.',

  stageSignal: 'Sygnał',
  stageEvidence: 'Dowody',
  stageDecided: 'Zdecydowane',
  stageMeasuring: 'Pomiar',
  stageResult: 'Wynik',
  stageBoard: 'Tablica etapów, przewiń, aby zobaczyć więcej',
  stageFold: (l: string, folded: boolean) => (folded ? `Pokaż: ${l}` : `Zwiń: ${l}`),
  stageEmpty: 'Pusto',
  stageOpen: (name, stage) => `${name}, ${stage}`,
  boardSummary: (improved, total, pct, measuring, kg, days) =>
    `${improved} z ${total} decyzji przyniosło poprawę (${pct}%), ${measuring} jest jeszcze mierzone. „Poprawa” oznacza wzrost ćwiczenia o co najmniej ${kg} kg szacowanego 1RM lub powrót klienta do planu w ciągu ${days} dni.`,
  close: 'Zamknij',
  drawerTitle: 'Decyzja',

  urgent: 'Pilne',
  watch: 'Uwaga',
  good: 'Dobrze',
  decided: 'Zdecydowane',
  waiting: 'Czekamy',
  measuring: 'Pomiar',
  improved: 'Poprawa',
  noChange: 'Bez wyraźnej zmiany',
  declined: 'Pogorszenie',
  confidence: (l): string =>
    l === 'high' ? 'Pewność wysoka' : l === 'medium' ? 'Pewność średnia' : 'Pewność niska',
  tagNew: 'Nowe',

  askMove: (name) => `${name} prosi o przeniesienie sesji`,
  waitingFor: (name) => `Czekamy na odpowiedź: ${name}`,
  askedMove: (manager, name) => `${manager} prosi klienta ${name} o przeniesienie treningu`,
  needsAnswer: 'Czeka na Twoją odpowiedź',
  moveFrom: 'Z',
  moveTo: 'Na',
  accept: 'Akceptuj',
  decline: 'Odrzuć',
  proposeAnother: 'Zaproponuj inny termin',
  cancelRequest: 'Anuluj prośbę',
  acceptFor: (name) => `Akceptuj przeniesienie dla ${name}`,
  declineFor: (name) => `Odrzuć przeniesienie dla ${name}`,
  proposeFor: (name) => `Zaproponuj inny termin: ${name}`,
  cancelFor: (name) => `Anuluj prośbę do ${name}`,
  requestAccepted: (name) => `Zaakceptowano. ${name} dostaje nowy termin na czacie.`,
  requestDeclined: (name) => `Odrzucono. ${name} dostaje wiadomość na czacie.`,
  requestCancelled: (name) => `Prośba do ${name} anulowana.`,
  requestFailed: 'Nie udało się wysłać odpowiedzi. Prośba zostaje na liście, spróbuj ponownie.',

  messageTo: (name) => `Napisz do ${name}`,
  seeEvidence: 'Dowody i opcje',
  otherOptions: (n) => P(n, '{n} inna opcja', '{n} inne opcje', '{n} innych opcji'),
  moreOptions: 'Opcje',
  programWeek: (program, week) => `${program} · tydzień ${week}`,
  heroLabel: (what) => `${what}, szac. 1RM`,
  heroSets: (what) => `${what}, serii tygodniowo`,
  heroDays: 'Dni od ostatniej sesji',
  heroNoChange: (weeks) =>
    P(weeks, 'bez zmian od {n} tygodnia', 'bez zmian od {n} tygodni', 'bez zmian od {n} tygodni'),
  heroSetsVs: (chronic) => `zwykle ${chronic}`,
  effectLine: (text, days) => (days == null ? text : `${text} Sprawdzimy ponownie za ${days} dni.`),

  allClearTitle: 'Brak decyzji do podjęcia',
  allClearBody: (requests, measuring, days) => {
    const parts: string[] = [];
    if (requests > 0)
      parts.push(
        P(
          requests,
          'Jedna prośba czeka wyżej na Twoją odpowiedź.',
          `${requests} prośby czekają wyżej na Twoją odpowiedź.`,
          `${requests} próśb czeka wyżej na Twoją odpowiedź.`,
        ),
      );
    if (measuring > 0)
      parts.push(
        P(
          measuring,
          `${measuring} decyzja jest jeszcze mierzona, wynik w ciągu ${days} dni.`,
          `${measuring} decyzje są jeszcze mierzone, wynik w ciągu ${days} dni.`,
          `${measuring} decyzji jest jeszcze mierzonych, wynik w ciągu ${days} dni.`,
        ),
      );
    return parts.length ? parts.join(' ') : 'Dziś nic Cię nie wymaga. Reszta jest w podsumowaniu.';
  },
  seeBoard: 'Pokaż tablicę',
  nothingTitle: 'Dziś nic Cię nie wymaga',
  nothingBody: 'Reszta jest w podsumowaniu.',
  updatedAt: (t) => `Zaktualizowano ${t}`,
  staleRefreshing: (t) => `Zaktualizowano ${t}, odświeżamy`,
  offlineNote: 'Brak sieci. Zmiany zsynchronizują się po powrocie.',
  offlineUpdated: (t) => `Brak sieci. Dane z ${t}. Zmiany zsynchronizują się po powrocie.`,
  unsynced: (n) =>
    P(
      n,
      '{n} zmiana czeka na synchronizację',
      '{n} zmiany czekają na synchronizację',
      '{n} zmian czeka na synchronizację',
    ),
  retry: 'Ponów',
  errorTitle: 'Nie udało się wczytać widoku Agenda',
  errorBody:
    'Sprawdź połączenie i spróbuj ponownie. Nic nie zginęło: Twoje zmiany są zapisane na tym urządzeniu.',
  tryAgain: 'Spróbuj ponownie',
  forbiddenTitle: 'Brak dostępu do danych trenera',
  forbiddenBody: 'Twoje konto nie może jeszcze czytać danych klientów. Zapytaj administratora.',
  vaultLockedTitle: 'Twoje dane są zablokowane',
  vaultLockedBody: 'Odblokuj skarbiec i spróbuj ponownie.',
  notFoundTitle: 'Tego sygnału już nie ma',
  notFoundBody:
    'Został rozstrzygnięty, odłożony lub odrzucony. Widok Agenda pokazuje to, co jest otwarte.',
  backToAgenda: 'Wróć do widoku Agenda',
  weekBriefsTitle: 'Masz mało klientów, więc nie ma kolejki',
  weekBriefsBody: 'Przy mniej niż 8 klientach ekran Tydzień pokazuje każdego w jednym wierszu.',

  backLabel: 'Agenda',
  decChoose: 'Wybierz, co zrobić',
  decNext: 'Co dalej',
  decSuggested: 'Sugerowane',
  decChosen: 'Wybrane',
  decRecord: 'Zapisz decyzję',
  decWait: 'Poczekaj tydzień',
  decDismiss: 'Odrzuć sygnał',
  decWhy: 'Dlaczego odrzucasz?',
  decPickOne: 'Wybierz jedno.',
  decReasonNotUseful: 'Nieprzydatne',
  decReasonHandled: 'Już załatwione',
  decReasonWrong: 'Błędne dane',
  decDismissConfirm: 'Odrzuć z powodem',
  decPickReason: 'Wybierz powód, aby odrzucić.',
  decOptionsLabel: 'Opcje',
  nextProgram: 'Program',
  nextResult: 'Sprawdzenie wyniku',
  nextSees: (name) => `${name} widzi`,
  nextSeesBody: 'Nową wersję programu w aplikacji.',
  nextNothingChanges: 'W programie nic się nie zmienia.',
  nextMessage: (name) => `Wiadomość do ${name}`,
  nextMessageSent: (name) => `Wiadomość wysłana do ${name}`,
  nextMessageNote: 'Wysyłana razem z decyzją. Możesz ją wcześniej poprawić.',
  nextMessageEdit: 'Edytuj wiadomość',
  nextMessageDone: 'Gotowe',
  nextNoChat: (name) =>
    `${name} korzysta tylko z programu: bez czatu, więc wiadomość nie jest wysyłana.`,
  messageField: (name) => `Wiadomość do ${name}`,
  resultStep: (days, kg) =>
    `Za ${days} dni. Poprawa tylko wtedy, gdy szacowane 1RM zmieni się o ${kg} kg lub więcej.`,
  resultStepRhythm: (days) =>
    `Za ${days} dni. Poprawa, jeśli liczba sesji tygodniowo wzrośnie o co najmniej 1.`,
  resultStepSpike: (days) =>
    `Za ${days} dni. Poprawa, jeśli tygodniowe serie wrócą do zwykłego zakresu.`,
  waitStep: (date) => `Wrócimy do tego ${date}, chyba że dowody wzmocnią się wcześniej.`,
  recordedTitle: (option, name) =>
    name ? `Zapisano: ${option}. Wiadomość trafiła do ${name}.` : `Zapisano: ${option}.`,
  recordedSub: (days, date) =>
    days == null || date == null
      ? 'Nie ma czego mierzyć.'
      : `Sprawdzimy wynik za ${days} dni (${date}).`,
  recordedAria: 'Decyzja zapisana',
  undoText: 'Decyzja zapisana',
  undoLabel: 'Cofnij',
  undoAria: 'Cofnij zapis tej decyzji',
  snoozedTitle: 'Czekamy tydzień',
  snoozedBody: (date) => `Wrócimy do tego ${date}.`,
  dismissedTitle: 'Sygnał odrzucony',
  dismissedBody: 'Pozostaje ukryty przez 30 dni, chyba że dowody się wzmocnią.',
  dismissedWrongData: 'Oznaczono jako błędne dane. Sprawdź dane klienta w profilu.',
  acknowledge: 'Rozumiem',
  recording: 'Zapisywanie',
  openProfile: (name) => `Profil: ${name}`,
  noOptionsTitle: 'Nic do zmiany w programie',
  noOptionsBody: 'To tylko informacja. Możesz poczekać tydzień albo odrzucić.',

  evTitle: 'Dowody',
  evDate: 'Data',
  evSets: 'Serie (kg × powt.)',
  evWeek: 'Tydzień',
  evValue: 'Szac. 1RM',
  evValueSets: 'Serie',
  evValueSessions: 'Sesje',
  evTable: 'Tabela dowodów',
  evChartAria: (what, from, to, unit) => `${what}: od ${from} do ${to} ${unit}`,
  evChartUnit: 'Szacowane 1RM, kg',
  evChartUnitSets: 'Serii tygodniowo',
  evChartUnitSessions: 'Sesji tygodniowo',
  evWeeksAgo: (n) => P(n, '{n} tydzień temu', '{n} tygodnie temu', '{n} tygodni temu'),
  evThisWeek: 'Ten tydzień',
  evNoData: 'Za mało sesji (potrzeba 3)',
  evNeedsFull: 'Dowody serii po serii wymagają poziomu Pełny',
  evLocked: (name, what) => `${name} nie udostępnia: ${what}.`,
  evAsk: 'Poproś o udostępnienie',
  evAskFor: (what) => `Poproś o udostępnienie: ${what}`,
  evSimilar: (n, total) => `W ${n} z ${total} Twoich podobnych decyzji to pomogło.`,
  evShares: (name, list) =>
    `${name} udostępnia: ${list}. Odczyty są rejestrowane i widoczne dla ${name}.`,
  evSharesNothing: (name) =>
    `${name} jeszcze niczego nie udostępnia. Odczyty są rejestrowane i widoczne dla ${name}.`,
  evMachine: (from, to) => `Szac. 1RM od ${from} do ${to} kg po zmianie`,
  evFactChange: (a, b) => `${a} → ${b}`,
  cat: {
    totals: 'podsumowania treningów',
    sets: 'serie i ciężary',
    body: 'masę ciała',
    sleep: 'sen',
    injury: 'urazy',
    nutrition: 'odżywianie',
    checkins: 'odpowiedzi z check-inów',
  },

  sigStallTitle: (ex, weeks) =>
    `${ex}: bez postępu od ${P(weeks, '{n} tygodnia', '{n} tygodni', '{n} tygodni')}`,
  sigStallBody: (e1rm, weeks) =>
    `Szacowane 1RM stoi na ${e1rm} kg od ${P(weeks, '{n} tygodnia', '{n} tygodni', '{n} tygodni')} przy stałej objętości. To samo ćwiczenie, ten sam sprzęt.`,
  sigStallLine: (ex, e1rm, weeks) =>
    `${ex}, szac. 1RM ${e1rm} kg · bez zmian od ${P(weeks, '{n} tygodnia', '{n} tygodni', '{n} tygodni')}`,
  sigMachineTitle: 'Wygląda na zastój, ale to inna maszyna',
  sigMachineBody: (ex, from, to) =>
    `${ex}: szac. 1RM zmieniło się z ${from} na ${to} kg po zmianie maszyny. Wartości nie są porównywalne, więc to nie zastój.`,
  sigMachineLine: (ex, to) => `${ex} · szac. 1RM ${to} kg na nowej maszynie`,
  sigRhythmIdleTitle: (days) => `Brak sesji od ${P(days, '{n} dnia', '{n} dni', '{n} dni')}`,
  sigRhythmLowTitle: 'Mniej niż połowa zaplanowanych sesji',
  sigRhythmBody: (low, idle) =>
    idle != null && idle > 7
      ? `Ostatnia sesja była ${P(idle, '{n} dzień', '{n} dni', '{n} dni')} temu, a w tym tygodniu są zaplanowane sesje.`
      : `Mniej niż połowa zaplanowanych sesji w każdym z ostatnich ${low} tygodni.`,
  sigRhythmLine: (idle) =>
    idle != null
      ? `Ostatnia sesja ${P(idle, '{n} dzień', '{n} dni', '{n} dni')} temu`
      : 'Poniżej planu 2 tygodnie',
  sigSpikeTitle: (muscle, pct) => `${muscle}: objętość +${pct}% w tydzień`,
  sigSpikeBody: (muscle, sets, chronic) =>
    `${sets} serii tygodniowo na ${muscle}, a zwykle ${chronic} w ostatnich 4 tygodniach.`,
  sigSpikeLine: (muscle, sets, pct) => `${muscle}, ${sets} serii · +${pct}%`,
  sigReadyTitle: (ex) => `Czas dodać ciężar: ${ex}`,
  sigReadyBody: (n, rpe) =>
    `Ostatnie ${n} sesje były z RPE ${rpe} lub niższym i wszystkimi powtórzeniami.`,
  sigReadyLine: (ex, rpe) => `${ex} · RPE ${rpe} lub niższe`,
  sigPrTitle: (ex, e1rm) => `Nowy rekord: ${ex} ${e1rm} kg`,
  sigPrBody: (gain, prev) =>
    `Szacowane 1RM wyższe o ${gain} kg od poprzedniego najlepszego (${prev} kg).`,
  sigPrLine: (ex, gain) => `${ex} · +${gain} kg`,
  sigInjuryTitle: (ex) => `${ex} koliduje z ograniczeniem`,
  sigInjuryBody: (restriction, n) =>
    restriction
      ? `W programie ${P(n, '{n} ćwiczenie', '{n} ćwiczenia', '{n} ćwiczeń')} wykluczone przez ograniczenie: ${restriction}.`
      : `W programie ${P(n, '{n} ćwiczenie', '{n} ćwiczenia', '{n} ćwiczeń')} wykluczone przez uraz.`,
  sigInjuryLine: (n) => `Konflikt · ${P(n, '{n} ćwiczenie', '{n} ćwiczenia', '{n} ćwiczeń')}`,
  sigNoSetsTitle: 'Tylko sumy, bez serii',
  sigNoSetsBody: 'Sesje są widoczne, serie i ciężary nie. Nic złego się nie dzieje.',
  sigNoSetsLine: (done) => (done == null ? 'Tylko sumy' : `Sesje w zeszłym tygodniu: ${done}`),
  sigNoDataTitle: 'Brak zapisanych sesji',
  sigNoDataBody:
    'Klient prowadzi dziennik w aplikacji, ale w ostatnich 4 tygodniach nie ma żadnej sesji.',
  sigNoDataLine: 'Nic od 4 tygodni',

  optVariation: 'Dodaj wariant + 1 serię',
  optDeload: 'Tydzień odciążenia',
  optStep: 'Dodaj 2,5 kg',
  optSwap: 'Zamień ćwiczenie',
  optLighter: 'Dwa lżejsze tygodnie',
  optWait: 'Poczekaj tydzień',
  optDismiss: 'Odrzuć sygnał',
  opSets: (ex, from, to) => `${ex}: z ${from} na ${to} serii.`,
  opAdd: (ex, sets, reps) => `Dodaje ${sets} × ${reps}: ${ex}.`,
  opWeight: (ex, from, to) => `${ex}: z ${from} na ${to} kg.`,
  opWeightUp: (ex, kg) => `${ex}: +${kg} kg.`,
  opDeload: (pct, weeks) =>
    `Objętość niższa o ${pct}% przez ${P(weeks, '{n} tydzień', '{n} tygodnie', '{n} tygodni')}.`,
  opSwap: (from, to) => `Zamienia ${from} na ${to}.`,
  opAltSafe: 'bezpieczną alternatywę',
  opMessageDraft: (name, kind) => {
    switch (kind) {
      case 'stall':
        return `Cześć ${name}, szybkie pytanie: jak śpisz i jesz w tym tygodniu? Ciężar w tym ćwiczeniu nie rośnie od miesiąca. Program lekko zmieniony.`;
      case 'spike':
        return `Cześć ${name}, zeszły tydzień był dużo cięższy niż zwykle. Ten tydzień celowo odciążony, więc nie przesadzaj.`;
      case 'rhythm':
        return `Cześć ${name}, widzę mniej sesji ostatnio. Najbliższe dwa tygodnie są lżejsze. Napisz, co przeszkadza.`;
      case 'injury':
        return `Cześć ${name}, ćwiczenie niepasujące do Twojego ograniczenia zostało zamienione. Daj znać, jeśli coś nadal boli.`;
      case 'ready':
        return `Cześć ${name}, ostatnie sesje były lekkie, więc ciężar został trochę zwiększony. Daj znać, jak się czujesz.`;
      default:
        return `Cześć ${name}, Twój program został zaktualizowany. Daj znać, jak się czujesz.`;
    }
  },

  resultLine: (result, before, after) =>
    before != null && after != null ? `${result} · szac. 1RM od ${before} do ${after} kg` : result,
  measuringDay: (day, total) => `Pomiar: dzień ${day} z ${total}`,
  waitUntil: (date) => `Wrócimy ${date}`,
  decisionTitle: (ops) => ops,

  liveTitle: 'Teraz trenują',
  liveSummary: (live, offline, finished) =>
    `${live} na żywo · ${offline} offline · ${finished} zakończyło`,
  liveNow: 'Na żywo',
  liveOffline: 'Offline',
  liveFinished: 'Zakończone',
  liveSinceLine: (time, gym) => `${gym} · od ${time}`,
  liveLost: 'Utracono połączenie, łączenie ponownie',
  liveFinishedLine: (sets, tonnes, gym) => `${sets} serii · ${tonnes} t · ${gym}`,
  liveStatusNow: 'Trenuje',
  liveStatusOffline: 'Offline, pauza',
  liveStatusDone: 'Zakończono',
  liveLastSeen: (s) => `Ostatnio ${s} s temu`,
  liveNone: 'Nikt teraz nie trenuje.',
  liveClosedAria: (n) => `${n} na żywo, otwórz listę`,
  livePrivacy:
    'Widzisz, kto trenuje i jak długo. Serie i ciężary zostają u klienta do końca sesji.',
  liveMinutes: (m) =>
    m >= 60 ? `${Math.floor(m / 60)} godz. ${String(m % 60).padStart(2, '0')} min` : `${m} min`,
};
