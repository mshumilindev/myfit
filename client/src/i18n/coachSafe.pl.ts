export const safePl: typeof import('./coachSafe.en').safeEn = {
  // Backend notices
  offTitle: 'Coach nie jest skonfigurowany',
  offBody:
    'Ta wersja nie jest połączona z serwerem Coach, więc nie pokazujemy klientów. Poproś administratora o jego włączenie.',
  offBack: 'Wróć do moich treningów',
  // My trainer: states
  retry: 'Spróbuj ponownie',
  bkFailTitle: 'Nie udało się uruchomić Coacha',
  bkFailBody: 'Twoje dane są bezpieczne. Sprawdź połączenie i spróbuj ponownie.',
  // Why Coach could not load (real backend): offline / not deployed / denied / timeout / unknown
  pbOfflineTitle: 'Brak połączenia',
  pbOfflineBody:
    'Twoje dane są bezpieczne na tym urządzeniu. Połącz się ponownie i spróbuj jeszcze raz.',
  pbNotDeployedTitle: 'Usługa Coach nie jest jeszcze dostępna w tym projekcie',
  pbNotDeployedBody:
    'Twoje dane są bezpieczne. Zaplecze Coacha nie zostało włączone dla tego projektu, więc nie ma czego wczytać.',
  pbDeniedTitle: 'Coach jest niedostępny dla tego konta',
  pbDeniedBody:
    'Serwer odmówił dostępu. Wyloguj się i zaloguj ponownie lub zapytaj administratora.',
  pbTimeoutTitle: 'Coach odpowiada zbyt długo',
  pbTimeoutBody: 'Twoje dane są bezpieczne. Usługa nie odpowiedziała na czas. Spróbuj ponownie.',
  pbUnknownTitle: 'Nie udało się wczytać Coacha',
  pbUnknownBody:
    'Twoje dane są bezpieczne. Coś poszło nie tak po naszej stronie. Spróbuj ponownie.',
  pbDevHint:
    'Dev: funkcje, reguły i indeksy Coacha prawdopodobnie nie są wdrożone w tym projekcie Firebase. Zob. docs/COACH-BACKEND.md (lista wdrożeniowa).',
  mtFailTitle: 'Nie udało się wczytać trenera',
  mtFailBody: 'Twoje dane są bezpieczne. Sprawdź połączenie i spróbuj ponownie.',
  mtNoneTitle: 'Nie masz jeszcze trenera',
  mtNoneBody:
    'Gdy trener Cię zaprosi, link otworzy się tutaj, a Ty wybierzesz, czym się dzielisz. Bez Twojej zgody nic nie jest udostępniane.',
  mtNoneCta: 'Wróć do Dziś',
  // Security code (Part C.2 no. 5)
  scTitle: 'Kod bezpieczeństwa',
  scMenu: 'Kod bezpieczeństwa',
  scIntroTrainer: (a) =>
    `Ten kod należy do klucza Twojego szyfrowanego czatu. Odczytaj go na głos osobiście lub przez telefon; jeśli zgadza się z tym, co widzi klient (${a}), nikt nie jest pomiędzy Wami.`,
  scIntroClient: (a) =>
    `Porównaj ten kod z tym, który widzi ${a}, osobiście lub przez telefon. Jeśli się zgadzają, nikt nie przeczyta Waszych wiadomości po drodze.`,
  scGroupsAria: (a) => `Kod bezpieczeństwa: ${a}`,
  scCopy: 'Kopiuj kod',
  scCopied: 'Skopiowano',
  scVerify: 'Kody się zgadzają',
  scUnverify: 'Oznacz jako niesprawdzony',
  scVerified: 'Sprawdzono',
  scNotVerified: 'Jeszcze niesprawdzony',
  scClose: 'Zamknij',
  scLoading: 'Wczytywanie kodu',
  scNoKey:
    'Kodu bezpieczeństwa jeszcze nie ma. Pojawi się, gdy szyfrowany czat zostanie skonfigurowany po obu stronach.',
  scChangedTitle: (a) => `Kod bezpieczeństwa (${a}) się zmienił`,
  scChangedBody: (a) =>
    `Wiadomości pozostają szyfrowane: to urządzenie zapakowało klucz czatu nowym kluczem. Jeśli zmiana jest niespodziewana, porównaj nowy kod z ${a}.`,
  scChangedReview: 'Zobacz kod',
  scChangedToast: (a) => `Kod bezpieczeństwa (${a}) się zmienił`,
  scChangedReviewSub: 'Zmieniony. Zobacz nowy kod',
  // Re-authentication and idle lock
  raTitle: 'Potwierdź, że to Ty',
  raBodyExport: 'Eksport kopiuje dane klientów poza aplikację. Wpisz hasło, aby kontynuować.',
  raBodyEnd:
    'Zakończenie współpracy wstrzymuje udostępnianie w obie strony. Wpisz hasło, aby kontynuować.',
  raBodyRevoke: 'Wycofanie zaproszenia wyłącza link dla wszystkich. Wpisz hasło, aby kontynuować.',
  raBodyDelete: 'Usunięcia konta nie można cofnąć. Wpisz hasło, aby usunąć je teraz.',
  raBodyMyExport:
    'Kopia zawiera Twoje dane osobowe, w tym dane o zdrowiu. Wpisz hasło, aby kontynuować.',
  raPassword: 'Hasło',
  raIdentifier: 'Nazwa użytkownika lub e-mail',
  raConfirm: 'Potwierdź',
  raCancel: 'Anuluj',
  raWrong: 'To hasło jest nieprawidłowe.',
  raLocked: 'Za dużo prób. Spróbuj za 15 minut.',
  raOffline: 'Brak połączenia. Sprawdź sieć i spróbuj ponownie.',
  raError: 'Nie udało się sprawdzić hasła. Spróbuj ponownie.',
  // Roster export and invite withdrawal
  exScopeRoster: 'lista klientów',
  invWithdrawFor: (a) => `Wycofaj zaproszenie dla ${a}`,
  invWithdrawTitle: (a) => `Wycofać zaproszenie dla ${a}?`,
  invWithdrawBody:
    'Nic jeszcze nie zostało udostępnione. Możesz zaprosić ponownie w dowolnym momencie.',
  invWithdrawEffect: 'Link przestanie działać dla wszystkich.',
  invWithdrawConfirm: 'Wycofaj zaproszenie',
  invResendFor: (a) => `Wyślij nowe zaproszenie dla ${a}`,
  invResendDone: (a) => `Nowe zaproszenie dla ${a} jest gotowe. Stary link już nie działa.`,
  invCopyLink: 'Kopiuj link',
  invResendFailed:
    'Nie udało się wysłać nowego zaproszenia. Sprawdź połączenie i spróbuj ponownie.',
  invWithdrawFailed: 'Nie udało się wycofać zaproszenia. Sprawdź połączenie i spróbuj ponownie.',
  // End coaching (trainer side)
  ecMenu: (a) => `Zakończ współpracę z ${a}`,
  ecTitle: (a) => `Zakończyć współpracę z ${a}?`,
  ecBody: 'Udostępnianie zostanie wstrzymane w obie strony. Możesz zaprosić ponownie później.',
  ecEffectSee: (a) => `Przestajesz widzieć dane: ${a}.`,
  ecEffectKeeps: (a) => `${a} zachowuje czat i program.`,
  ecEffectNotes: 'Twoje notatki i decyzje zostają u Ciebie.',
  ecConfirm: 'Zakończ współpracę',
  ecFailed: 'Nie udało się zakończyć współpracy. Sprawdź połączenie i spróbuj ponownie.',
  // Share requests, decision sharing
  askMsg: (what) => `Prośba o udostępnienie: ${what}`,
  askCardKind: 'Prośba o udostępnienie',
  askCardMine: (what) => `Prosisz o wgląd: ${what}.`,
  askCardTheirs: (what) => `Trener prosi o wgląd: ${what}.`,
  askCardOpen: 'Otwórz ustawienia udostępniania',
  askFailed: 'Nie udało się wysłać prośby. Sprawdź połączenie i spróbuj ponownie.',
  undo: 'Cofnij',
  undoCountdown: 'Cofnięcie możliwe przez 8 sekund',
  dsUnsharedToast: (a) => `Wstrzymano udostępnianie: ${a}`,
  dsFailed: 'Nie udało się zmienić udostępniania. Sprawdź połączenie i spróbuj ponownie.',
  // Quiet hours (Q-17)
  qhTitle: 'Godziny ciszy',
  qhSub: (from, to) =>
    `Bez dźwięku dla wiadomości od trenera między ${from} a ${to}. Nadal liczą się jako nieprzeczytane.`,
  qhFrom: 'Od',
  qhTo: 'Do',
  // Notification switches (SPO-237)
  pnRequests: 'Prośby',
  pnReminders: 'Przypomnienia',
  pnTeam: 'Zespół',
  pnSub:
    'Wyłącz rodzaj, aby nie dostawać jego push. Wiadomość zostaje w Spotterze. Godziny ciszy nie wstrzymują próśb.',
};
