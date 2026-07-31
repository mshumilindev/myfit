import type { Strings } from './en';

/** Polish. Plural helper: 1 zmiana / 2 zmiany / 5 zmian. */
const zmiany = (n: number): string => {
  if (n === 1) return 'zmiana';
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'zmiany';
  return 'zmian';
};
const serie = (n: number): string => {
  if (n === 1) return 'seria';
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'serie';
  return 'serii';
};

export const pl: Strings = {
  locale: 'Polski',

  appName: 'My Fit',
  authTagline: 'Wszystko, co dźwigasz, w jednym miejscu.',
  emailOrUsername: 'Email lub nazwa użytkownika',
  password: 'Hasło',
  signIn: 'Zaloguj się',
  signingIn: 'Logowanie…',
  newHereCreate: 'Nowy tutaj? Załóż konto',
  haveAccountSignIn: 'Masz już konto? Zaloguj się',
  wrongCredentials: 'Błędna nazwa lub hasło',
  tooManyAttempts: 'Zbyt wiele nieudanych prób. Spróbuj za 15 minut.',
  serverUnreachable:
    'Brak połączenia z serwerem. Pierwsze logowanie wymaga internetu — potem zapis offline działa.',
  retry: 'Ponów',
  createYourAccount: 'Załóż swoje konto',
  signupNote: 'Twój dziennik jest prywatny dla twojego konta. Za darmo, póki My Fit jest w becie.',
  username: 'Nazwa użytkownika',
  email: 'Email',
  passwordMin: 'Hasło (min. 6 znaków)',
  createAccount: 'Załóż konto',
  creatingAccount: 'Zakładanie…',
  emailIncomplete: 'Ten email wygląda na niepełny',
  passwordTooShort: 'Minimum 6 znaków',
  usernameTooShort: 'Minimum 2 znaki',

  services: 'Usługi',
  signOut: 'Wyloguj',
  training: 'Trening',
  trainingSub: 'Treningi, serie, ciężary, siłownie',
  nThisWeek: (n) => `${n} w tym tygodniu`,
  nutrition: 'Odżywianie',
  aiBodyScan: 'Skan sylwetki AI',
  soon: 'Wkrótce',
  language: 'Język',
  signOutTitle: 'Wylogować?',
  signOutQueueBody: (n) =>
    `W kolejce ${n === 1 ? 'jest jeszcze 1 zmiana' : `są jeszcze ${n} ${zmiany(n)}`}. Wylogowanie usuwa lokalną kolejkę — najpierw zsynchronizuj, jeśli chcesz je zachować.`,
  signOutCleanBody: 'Dziennik zostaje na serwerze i wróci przy następnym logowaniu.',
  stay: 'Zostań',

  synced: 'Zsynchronizowano',
  syncing: 'Synchronizacja',
  offline: 'Offline',
  failed: 'Błąd',
  offlineQueued: (n) => `Brak połączenia. ${n} ${zmiany(n)} w kolejce — zsynchronizują się same.`,
  offlineQueuedLong: (n) =>
    `Offline · ${n} ${zmiany(n)} w kolejce. Nic nie ginie — odtworzą się po kolei.`,
  sendingQueued: 'Wysyłam zmiany z kolejki',
  servedFromCache: 'Wszystko poniżej pochodzi z lokalnej pamięci.',
  offlineLastSync: (ago) => `Offline · ostatnia synchronizacja ${ago}`,
  minAgo: (n) => `${n} min temu`,
  worksOffline: (n) => `Działa offline · ${n} w kolejce`,
  queued: 'W kolejce',
  changesSynced: (n) => `Zsynchronizowano zmian: ${n}`,

  today: 'Dziś',
  progress: 'Postępy',
  gyms: 'Siłownie',
  apps: 'Usługi',
  nothingLoggedYet: 'Jeszcze nic nie zapisano.',
  midSession: 'Trening trwa.',
  startFirstSession: 'Zacznij pierwszy trening',
  startEmptySession: 'Zacznij pusty trening',
  noHistoryYet: 'Brak historii',
  noHistoryBody:
    'Zapisz trening, a tu pojawią się twoje tygodnie. Szablony pokazują się po drugim — to po prostu zachowane treningi.',
  addGymHint: 'Dodaj swoją siłownię, by niezapisane wizyty przypominały o sobie.',
  add: 'Dodaj',
  logIt: 'Zapisz',
  dismiss: 'Odrzuć',
  unloggedVisit: (dur, gym, date) => `${dur} w ${gym} ${date} — nic nie zapisano.`,
  sessionInProgress: 'Trening w toku',
  recent: 'Ostatnie',
  templates: 'Szablony',
  nSaved: (n) => `Zapisano: ${n}`,
  repeat: (name) => `Powtórz ${name}`,
  autoClosed: 'Auto-zamknięty',
  weekDayLetters: ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'],

  syncFailedBody: (i, n, reason) => `Synchronizacja padła na zmianie ${i} z ${n} — ${reason}.`,
  discardChange: 'Odrzuć zmianę',

  inSession: 'Trening',
  inSessionAt: (gym) => `Trening · ${gym}`,
  finish: 'Zakończ',
  reopen: 'Wznów',
  noExercisesYet: 'Brak ćwiczeń',
  noExercisesBody:
    'Dodaj pierwsze — ostatnie ćwiczenia i cała historia podpowiadają się podczas pisania.',
  addExercise: 'Dodaj ćwiczenie',
  orLoadTemplate: 'albo wczytaj szablon',
  matches: 'Trafienia',
  createExercise: (q) => `Utwórz „${q}”`,
  lastLift: (v) => `ostatnio ${v}`,
  sets: 'serie',
  moved: 'przeniesiono',
  exercises: 'ćwiczenia',
  repsCol: 'Powt.',
  kgCol: 'Kg',
  warmup: 'rozgrzewka',
  working: 'robocza',
  record: 'rekord',
  log: 'Zapisz',
  prev: (v) => `poprz. ${v}`,
  ghostHint: 'Wypełnione z ostatniego razu · dotknij liczby, by ją poprawić',
  rest: 'Przerwa',
  skip: 'Pomiń',
  newRecordToast: (name, v) => `Nowy rekord · ${name} ${v}`,
  setN: (n, ex) => `Seria ${n} · ${ex}`,
  loggedAt: (t) => `zapisano ${t}`,
  reps: 'Powtórzenia',
  weightKg: 'Ciężar, kg',
  warmupSet: 'Seria rozgrzewkowa',
  deleteSet: 'Usuń serię',
  cancel: 'Anuluj',
  save: 'Zapisz',
  setDeleted: (v) => `Usunięto serię · ${v}`,
  undo: 'Cofnij',
  renameHint: 'Zmiana nazwy dotyczy tylko tego treningu — historia zachowuje starą.',
  exerciseMenuTitle: (name, n) => `${name} · ${n} ${serie(n)}`,
  rename: 'Zmień nazwę',
  duplicateWithSets: 'Duplikuj z seriami',
  openHistory: 'Otwórz historię',
  clearAllSets: 'Wyczyść wszystkie serie',
  deleteExercise: 'Usuń ćwiczenie',
  deleteExerciseTitle: (name) => `Usunąć „${name}”?`,
  deleteExerciseBody: (setsDesc) =>
    `${setsDesc} znikną razem z nim. Dodane przez pomyłkę? Usuwanie jest natychmiastowe, z 5-sekundowym cofnięciem.`,
  nLoggedSets: (n, list) => `${n} ${serie(n)} — ${list}`,
  keep: 'Zostaw',
  delete: 'Usuń',
  exerciseDeleted: (name, n) => `Usunięto „${name}” · ${n} ${serie(n)}`,
  closedAutomatically: 'Zamknięto automatycznie',
  autoCloseNotice: (t) =>
    `Otwarty przez 8 godzin, więc zamknął się o ${t} i może być niepełny. Wszystko zapisane zostaje — dodaj brakujące, zapisze się z pierwotną datą.`,
  nSetsTag: (n) => `${n} ${serie(n)}`,
  finishSessionTitle: 'Zakończyć trening?',
  finishEmptyWarning: (name, sets, vol, date) =>
    `„${name}” nie ma serii i zostanie pominięte. Reszta — ${sets} ${serie(sets)}, ${vol} — zapisze się na ${date}.`,
  finishCleanBody: (sets, vol, date) => `${sets} ${serie(sets)}, ${vol} — zapisano na ${date}.`,
  keepGoing: 'Kontynuuj',
  sessionSaved: 'Trening zapisany',
  sessionDone: 'Zrobione.',
  duration: 'Czas',
  setsStat: 'Serie',
  movedStat: 'Przeniesiono',
  newRecord: 'Nowy rekord',
  prevBest: (v, rm) => `Poprzedni rekord ${v} · szacowane 1RM do ${rm} kg`,
  comparedToLast: 'W porównaniu z ostatnim treningiem',
  sessionVolume: 'Objętość treningu',
  editSession: 'Edytuj',
  done: 'Gotowe',

  addToSession: 'Dodaj ćwiczenie do tego treningu',
  deleteWorkout: 'Usuń trening',
  deleteWorkoutTitle: 'Usunąć ten trening?',
  deleteWorkoutBody: (desc) =>
    `${desc}. Zniknie ze wszystkich urządzeń przy następnej synchronizacji — bez możliwości cofnięcia.`,
  autoCloseNoticePast:
    'Auto-zamknięty po 8 godzinach — może być niepełny. Wszystko dodane tutaj zapisze się z pierwotną datą.',
  nSessionsSince: (n, since) => `Treningów: ${n} · od ${since}`,
  oneSession: '1 trening',
  recordKg: 'Rekord, kg',
  est1rm: 'Szac. 1RM',
  lastTopSet: 'Ostatnia top seria',
  topSet12w: 'Top seria · 12 tygodni',
  recordSuffix: (v) => `${v} · rekord`,
  lastSessions: 'Ostatnie treningi',
  dateCol: 'Data',
  topSetCol: 'Top seria',
  volumeCol: 'Objętość',
  notEnoughData: 'Za mało, by narysować linię',
  notEnoughDataBody: 'Trzy treningi i pojawi się trend. Jeden punkt to nie trend.',

  volumeThisWeek: 'Objętość w tym tygodniu',
  estimated1rm: 'Szacowane 1RM',
  records: 'Rekordy',
  twoMoreSessions: 'Jeszcze dwa treningi',
  progressLocked: (n) =>
    `Objętość, rekordy i szacunki 1RM mają sens po trzech zapisanych treningach. Masz ${n === 1 ? 'jeden' : n}.`,
  progressUnlocksAt: 'Postępy odblokują się przy',
  wksAgo: (n) => `${n} tyg`,

  gymsIntro:
    'Dodaj siłownię, stojąc w niej. Otwórz tam apkę później, a wizyta się zapisze — niezapisana godzina pojawi się na „Dziś”.',
  gymName: 'Nazwa siłowni',
  imHere: 'Jestem tu',
  locating: 'Lokalizuję',
  noGymsYet: 'Brak siłowni',
  noGymsBody:
    'Najpierw nazwij, potem stuknij „Jestem tu” — przycisk jest nieaktywny, póki nie ma nazwy.',
  gymsFootnote:
    'Przeglądarki nie dają lokalizacji w tle. Wizyty zapisują się tylko przy otwartej aplikacji.',
  readingPosition: 'Odczytuję pozycję…',
  locatingNote:
    'Dokładność rośnie przez kilka sekund — zapis czeka na najlepszy fix lub 8 s, co nastąpi pierwsze.',
  locationBlocked: 'Lokalizacja zablokowana',
  locationBlockedBody:
    'Safari → aA → Ustawienia witryny → Lokalizacja → Zezwól. Siłownie i przypomnienia o wizytach są wyłączone do tego czasu.',
  howToFix: 'Jak naprawić',
  tryAgain: 'Spróbuj ponownie',
  locationBlockedFootnote: 'Reszta trackera działa jak dotąd — to wyłącza tylko siłownie.',
  gpsCoarse: (m) =>
    `Lokalizacja wróciła z dokładnością ±${m} m — zbyt zgrubnie, by przypiąć siłownię. Wejdź do środka i spróbuj znów, albo zapisz i poszerz promień.`,
  saveAnyway: 'Zapisz mimo to',
  gymAdded: (m) => `Dodano siłownię · dokładność ±${m} m`,
  inside: 'W środku',
  radiusM: (m) => `promień ${m} m`,
  visitsLast7: 'Wizyty · ostatnie 7 dni',
  nVisits: (n) => `Wizyt: ${n}`,
  radius: 'Promień',
  radiusHint: 'Szerzej łapie więcej wizyt, ale i kawiarnię obok. 150 m pasuje większości siłowni.',
  deleteGymTitle: (name) => `Usunąć „${name}”?`,
  deleteGymBody: (n) =>
    `Zniknie z nim ${n} zapisanych wizyt, a przypomnienia dla tego miejsca ustaną. Treningi zostają nietknięte.`,

  updateReady: 'Nowa wersja gotowa — przeładuj, by zaktualizować',
  reload: 'Przeładuj',
  error: 'Błąd',
};
