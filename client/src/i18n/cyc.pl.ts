/** Cycle strings (Polish). See `cyc.en.ts`. */
import type { cycEn } from './cyc.en';

export const cycPl: typeof cycEn = {
  cycTitle: 'Cykl',
  cycRowOff: 'Nie skonfigurowano',
  cycRowPaused: 'Wyłączony w ciąży',
  cycRowMenopause: 'Wyłączony po menopauzie',
  cycRowLog: 'Tylko dziennik',
  cycRowDay: (day, phase) => `Dzień ${day} · ${phase}`,

  cycPhMenses: 'Miesiączka',
  cycPhEarly: 'Początek cyklu',
  cycPhMid: 'Środek cyklu',
  cycPhLate: 'Koniec cyklu',
  cycHintMenses: 'Samopoczucie bywa różne. Kieruj się tym, jak się czujesz.',
  cycHintEarly: 'Wiele osób ma tu więcej energii, ale nie wszyscy.',
  cycHintMid: 'Bez reguł: patrz na RPE i sen.',
  cycHintLate: 'Dla niektórych regeneracja bywa trudniejsza. To niekoniecznie o Tobie.',

  cycSetupIntro:
    'Wpisz raz, kiedy cykl zwykle się zaczyna i ile trwa. Potem dziennik prowadzi się sam: nic ręcznie.',
  cycMode: 'Tryb',
  cycModeRegular: 'Regularny',
  cycModeIrregular: 'Nieregularny',
  cycModeLog: 'Tylko dziennik',
  cycModeFootRegular: 'Stały cykl: szacujemy fazę i następny początek.',
  cycModeFootIrregular: 'Cykl, który się zmienia: szersze zakresy i tylko przybliżona faza.',
  cycModeFootLog:
    'Bez szacunków, tylko dni krwawienia z Twoich dat. Dobre przy antykoncepcji hormonalnej.',
  cycUsually: 'Zwykle',
  cycLastStart: 'Ostatni cykl zaczął się',
  cycLength: 'Długość cyklu',
  cycPeriod: 'Długość miesiączki',
  cycShortest: 'Najkrótszy cykl',
  cycLongest: 'Najdłuższy cykl',
  cycUsuallyFoot: 'Tylko Twoje typowe wartości. Niczego poza nimi nie zgadujemy.',
  cycDaysUnit: 'dni',
  cycOutOfNorm: 'Te wartości wykraczają poza typowy zakres. Warto wspomnieć o tym lekarzowi.',
  cycSave: 'Zapisz',
  cycCancel: 'Anuluj',
  cycPrivate: 'Prywatne. Zaszyfrowane na urządzeniu i w chmurze. Nikomu niewidoczne.',

  cycApprox: 'Szacunek',
  cycLikely: 'Prawdopodobnie',
  cycDayOf: (day, len) => `Dzień ${day} z ~${len}`,
  cycNextStart: (from, to) =>
    from === to ? `Następny początek: ${from}` : `Następny początek: ${from} – ${to} (zakres 80%)`,
  cycLogHead: 'Tylko dziennik',
  cycLogLast: (date) => `Ostatni cykl zaczął się ${date}`,
  cycLogNote: 'Bez szacunków, tylko zapisane dni.',
  cycCalendar: 'Kalendarz',
  cycLegendLogged: 'Zapisane miesiączki',
  cycUpdateDate: 'Zmień datę początku',
  cycUpdateTitle: 'Kiedy zaczął się ostatni cykl?',
  cycUpdateSave: 'Zapisz datę',
  cycSettings: 'Ustawienia',
  cycStale: 'Harmonogram jest nieaktualny. Szacunki są wyłączone, dopóki nie zmienisz daty.',
  cycStaleBtn: 'Zmień datę',

  cycStates: 'Stany',
  cycStatesFoot: 'Oznaczenie tutaj od razu dodaje stan do Przewlekłych, a Cykl się wyłącza.',
  cycMarkPreg: 'Oznacz ciążę',
  cycMarkMeno: 'Oznacz menopauzę',
  cycPregTitle: 'Oznacz ciążę',
  cycPregBody:
    'Podaj datę początku (lub przybliżoną). Trymestr ustali się sam, a stan pojawi się w Przewlekłych.',
  cycPregInfo: (week) => `Około ${week}. tygodnia`,
  cycPregAdd: 'Dodaj stan',
  cycMenoTitle: 'Oznaczyć menopauzę?',
  cycMenoBody: 'Menopauza trafi do Przewlekłych, a Cykl się wyłączy. Dane zostaną.',
  cycMenoConfirm: 'Oznacz',

  cycOffTitle: 'Cykl wyłączony',
  cycOffPregnancy:
    'W Przewlekłych jest aktywna ciąża. Dane zostają; po jej zakończeniu zapytamy o nową datę początku.',
  cycOffMenopause: 'W Przewlekłych oznaczono menopauzę. Dane zostają.',
  cycPausedNeutral: 'Wstrzymano',
  cycOffNeutral: 'Cykl jest na razie wstrzymany. Twoje dane są zachowane.',
  cycOpenStates: 'Otwórz stany',
  cycAfterPause: 'Przerwa się skończyła. Podaj, kiedy zaczął się cykl, aby kontynuować.',

  cycWhere: 'Gdzie pokazywać',
  cycWhereFoot:
    'Każde można wyłączyć. Nic tutaj nie zmienia planu, progresji ani automatycznych treningów.',
  cycSurfToday: 'Znacznik na Today',
  cycSurfCalendar: 'Kolor w kalendarzu',
  cycSurfSession: 'Notatka w treningu',
  cycDelete: 'Usuń dane cyklu',
  cycDeleteTitle: 'Usunąć dane cyklu?',
  cycDeleteBody: 'Daty i ustawienia znikną z urządzenia i chmury. Tego nie można cofnąć.',
  cycDeleteConfirm: 'Usuń',
  cycPatterns: 'Prawidłowości',
  cycPatternsSub: 'Twój wysiłek w fazach',
  cycPatIntro:
    'To Twój własny oceniony wysiłek, a nie ogólna reguła. Każda faza jest porównywana ze średnią tego samego cyklu.',
  cycPatRow: (diff, lo, hi) => `${diff} RPE (${lo} … ${hi})`,
  cycPatHigher: 'Zwykle wyżej niż Twoja średnia',
  cycPatLower: 'Zwykle niżej niż Twoja średnia',
  cycPatSame: 'Nie do odróżnienia od Twojej średniej',
  cycPatCycles: (n) => `${n} cykli`,
  cycPatEmptyTitle: 'Za mało danych',
  cycPatEmptyBody: (n) =>
    `Potrzeba co najmniej 3 cykli z ocenionymi seriami w dwóch lub więcej fazach. Cykli na razie: ${n}. Biorą się z podanych przez Ciebie dat początku.`,
  cycPatFoot:
    'Różnica sparowana w cyklach, przedział 95% (bootstrap). Serie bez oceny i rozgrzewka nie są brane pod uwagę.',
  cycSessionHigher: (diff) =>
    `W tej fazie Twoje ocenione serie zwykle mają RPE o ${diff} wyższe niż średnia. Plan się nie zmienia.`,
  cycSessionLower: (diff) =>
    `W tej fazie Twoje ocenione serie zwykle mają RPE o ${diff} niższe niż średnia. Plan się nie zmienia.`,
};
