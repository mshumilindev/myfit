export const safeLt: typeof import('./coachSafe.en').safeEn = {
  // Backend notices
  offTitle: 'Coach nesukonfigūruotas',
  offBody:
    'Ši versija neprijungta prie Coach serverio, todėl klientai nerodomi. Paprašykite administratoriaus jį įjungti.',
  offBack: 'Atgal į mano treniruotes',
  // My trainer: states
  retry: 'Bandyti dar kartą',
  bkFailTitle: 'Nepavyko paleisti Coach',
  bkFailBody: 'Jūsų duomenys saugūs. Patikrinkite ryšį ir bandykite dar kartą.',
  // Why Coach could not load (real backend): offline / not deployed / denied / timeout / unknown
  pbOfflineTitle: 'Nėra ryšio',
  pbOfflineBody: 'Jūsų duomenys saugūs šiame įrenginyje. Atkurkite ryšį ir bandykite dar kartą.',
  pbNotDeployedTitle: 'Coach paslauga šiame projekte dar neprieinama',
  pbNotDeployedBody:
    'Jūsų duomenys saugūs. Coach serverio dalis šiam projektui dar neįjungta, todėl nėra ką įkelti.',
  pbDeniedTitle: 'Coach šiai paskyrai neprieinamas',
  pbDeniedBody:
    'Serveris atmetė prieigą. Atsijunkite ir prisijunkite iš naujo arba kreipkitės į administratorių.',
  pbTimeoutTitle: 'Coach atsako per ilgai',
  pbTimeoutBody: 'Jūsų duomenys saugūs. Paslauga neatsakė laiku. Bandykite dar kartą.',
  pbUnknownTitle: 'Nepavyko įkelti Coach',
  pbUnknownBody: 'Jūsų duomenys saugūs. Mūsų pusėje kažkas nutiko. Bandykite dar kartą.',
  pbDevHint:
    'Dev: Coach funkcijos, taisyklės ir indeksai tikriausiai neįdiegti šiame Firebase projekte. Žr. docs/COACH-BACKEND.md (diegimo sąrašas).',
  mtFailTitle: 'Nepavyko įkelti trenerio',
  mtFailBody: 'Jūsų duomenys saugūs. Patikrinkite ryšį ir bandykite dar kartą.',
  mtNoneTitle: 'Trenerio dar nėra',
  mtNoneBody:
    'Kai treneris jus pakvies, nuoroda atsidarys čia ir jūs pasirinksite, kuo dalytis. Be jūsų sutikimo niekas nesidalijama.',
  mtNoneCta: 'Atgal į Šiandien',
  // Security code (Part C.2 no. 5)
  scTitle: 'Saugos kodas',
  scMenu: 'Saugos kodas',
  scIntroTrainer: (a) =>
    `Šis kodas priklauso jūsų šifruoto pokalbio raktui. Perskaitykite jį garsiai gyvai ar telefonu; jei jis sutampa su tuo, ką mato klientas (${a}), tarp jūsų niekas nesikiša.`,
  scIntroClient: (a) =>
    `Palyginkite šį kodą su tuo, kurį mato ${a}, gyvai ar telefonu. Jei jie sutampa, niekas negali perskaityti jūsų žinučių pakeliui.`,
  scGroupsAria: (a) => `Saugos kodas: ${a}`,
  scCopy: 'Kopijuoti kodą',
  scCopied: 'Nukopijuota',
  scVerify: 'Kodai sutampa',
  scUnverify: 'Pažymėti kaip nepatikrintą',
  scVerified: 'Patikrinta',
  scNotVerified: 'Dar nepatikrinta',
  scClose: 'Uždaryti',
  scLoading: 'Kodas įkeliamas',
  scNoKey:
    'Saugos kodo dar nėra. Jis atsiras, kai šifruotas pokalbis bus nustatytas abiejose pusėse.',
  scChangedTitle: (a) => `${a} saugos kodas pasikeitė`,
  scChangedBody: (a) =>
    `Žinutės lieka šifruotos: šis įrenginys apgaubė pokalbio raktą nauju raktu. Jei pokytis netikėtas, palyginkite naują kodą su ${a}.`,
  scChangedReview: 'Peržiūrėti kodą',
  scChangedToast: (a) => `${a} saugos kodas pasikeitė`,
  scChangedReviewSub: 'Pasikeitė. Peržiūrėkite naują kodą',
  // Re-authentication and idle lock
  raTitle: 'Patvirtinkite, kad tai jūs',
  raBodyExport:
    'Eksportuojant klientų duomenys perkeliami už programėlės ribų. Įveskite slaptažodį, kad tęstumėte.',
  raBodyEnd:
    'Baigus bendradarbiavimą, dalijimasis sustoja abiem kryptimis. Įveskite slaptažodį, kad tęstumėte.',
  raBodyRevoke:
    'Atšaukus kvietimą, nuoroda išjungiama visiems. Įveskite slaptažodį, kad tęstumėte.',
  raBodyDelete: 'Deleting your account cannot be undone. Enter your password to delete it now.',
  raBodyMyExport:
    'Your copy contains your personal data, including health data. Enter your password to continue.',
  raPassword: 'Slaptažodis',
  raIdentifier: 'Vartotojo vardas arba el. paštas',
  raConfirm: 'Patvirtinti',
  raCancel: 'Atšaukti',
  raWrong: 'Slaptažodis neteisingas.',
  raLocked: 'Per daug bandymų. Bandykite po 15 minučių.',
  raOffline: 'Nėra ryšio. Patikrinkite tinklą ir bandykite dar kartą.',
  raError: 'Nepavyko patikrinti slaptažodžio. Bandykite dar kartą.',
  // Roster export and invite withdrawal
  exScopeRoster: 'klientų sąrašas',
  invWithdrawFor: (a) => `Atšaukti kvietimą: ${a}`,
  invWithdrawTitle: (a) => `Atšaukti kvietimą: ${a}?`,
  invWithdrawBody: 'Dar niekas nebuvo bendrinta. Pakviesti iš naujo galite bet kada.',
  invWithdrawEffect: 'Nuoroda nustos veikti visiems.',
  invWithdrawConfirm: 'Atšaukti kvietimą',
  invResendFor: (a) => `Siųsti naują kvietimą: ${a}`,
  invResendDone: (a) => `Naujas kvietimas ${a} paruoštas. Senoji nuoroda nebeveikia.`,
  invCopyLink: 'Kopijuoti nuorodą',
  invResendFailed: 'Nepavyko išsiųsti naujo kvietimo. Patikrinkite ryšį ir bandykite dar kartą.',
  invWithdrawFailed: 'Nepavyko atšaukti kvietimo. Patikrinkite ryšį ir bandykite dar kartą.',
  // End coaching (trainer side)
  ecMenu: (a) => `Baigti bendradarbiavimą su ${a}`,
  ecTitle: (a) => `Baigti bendradarbiavimą su ${a}?`,
  ecBody: 'Dalijimasis sustos abiem kryptimis. Vėliau galėsite pakviesti iš naujo.',
  ecEffectSee: (a) => `Nebematote duomenų: ${a}.`,
  ecEffectKeeps: (a) => `${a} pasilieka pokalbį ir programą.`,
  ecEffectNotes: 'Jūsų užrašai ir sprendimai lieka pas jus.',
  ecConfirm: 'Baigti bendradarbiavimą',
  ecFailed: 'Nepavyko baigti bendradarbiavimo. Patikrinkite ryšį ir bandykite dar kartą.',
  // Share requests, decision sharing
  askMsg: (what) => `Prašymas bendrinti: ${what}`,
  askCardKind: 'Prašymas bendrinti',
  askCardMine: (what) => `Prašėte parodyti: ${what}.`,
  askCardTheirs: (what) => `Treneris prašo parodyti: ${what}.`,
  askCardOpen: 'Atidaryti bendrinimo nustatymus',
  askFailed: 'Nepavyko išsiųsti prašymo. Patikrinkite ryšį ir bandykite dar kartą.',
  undo: 'Atšaukti',
  undoCountdown: 'Atšaukti galima 8 sekundes',
  dsUnsharedToast: (a) => `Bendrinimas sustabdytas: ${a}`,
  dsFailed: 'Nepavyko pakeisti bendrinimo. Patikrinkite ryšį ir bandykite dar kartą.',
  // Quiet hours (Q-17)
  qhTitle: 'Tylos valandos',
  qhSub: (from, to) =>
    `Trenerio žinutės be garso nuo ${from} iki ${to}. Jos vis tiek lieka neperskaitytos.`,
  qhFrom: 'Nuo',
  qhTo: 'Iki',
  // Notification switches (SPO-237)
  pnRequests: 'Prašymai',
  pnReminders: 'Priminimai',
  pnTeam: 'Komanda',
  pnSub:
    'Išjunkite rūšį, kad negautumėte jos push. Žinutė lieka Spotter. Tylos valandos nelaiko prašymų.',
};
