export const safeEt: typeof import('./coachSafe.en').safeEn = {
  // Backend notices
  offTitle: 'Coach pole seadistatud',
  offBody:
    'See versioon pole Coachi serveriga ühendatud, seega kliente ei näidata. Palu administraatoril see sisse lülitada.',
  offBack: 'Tagasi minu treeningute juurde',
  // My trainer: states
  retry: 'Proovi uuesti',
  bkFailTitle: 'Coachi käivitamine ebaõnnestus',
  bkFailBody: 'Sinu andmed on turvas. Kontrolli ühendust ja proovi uuesti.',
  // Why Coach could not load (real backend): offline / not deployed / denied / timeout / unknown
  pbOfflineTitle: 'Ühendus puudub',
  pbOfflineBody: 'Sinu andmed on selles seadmes turvas. Loo ühendus uuesti ja proovi veel kord.',
  pbNotDeployedTitle: 'Coachi teenus pole selles projektis veel saadaval',
  pbNotDeployedBody:
    'Sinu andmed on turvas. Coachi taustateenus pole selle projekti jaoks sisse lülitatud, seega pole midagi laadida.',
  pbDeniedTitle: 'Coach pole selle konto jaoks saadaval',
  pbDeniedBody:
    'Server keeldus ligipääsust. Logi välja ja uuesti sisse või küsi administraatorilt.',
  pbTimeoutTitle: 'Coach vastab liiga kaua',
  pbTimeoutBody: 'Sinu andmed on turvas. Teenus ei vastanud õigel ajal. Proovi uuesti.',
  pbUnknownTitle: 'Coachi laadimine ebaõnnestus',
  pbUnknownBody: 'Sinu andmed on turvas. Meie poolel läks midagi valesti. Proovi uuesti.',
  mtFailTitle: 'Treeneri laadimine ebaõnnestus',
  mtFailBody: 'Sinu andmed on turvas. Kontrolli ühendust ja proovi uuesti.',
  mtNoneTitle: 'Treenerit veel pole',
  mtNoneBody:
    'Kui treener sind kutsub, avaneb kutsulink siin ja sa valid, mida jagada. Ilma sinu nõusolekuta ei jagata midagi.',
  mtNoneCta: 'Tagasi tänase juurde',
  // Security code (Part C.2 no. 5)
  scTitle: 'Turvakood',
  scMenu: 'Turvakood',
  scIntroTrainer: (a) =>
    `See kood kuulub sinu krüpteeritud vestluse võtmele. Loe see ette isiklikult või telefonis; kui see ühtib sellega, mida klient (${a}) näeb, ei ole teie vahel kedagi.`,
  scIntroClient: (a) =>
    `Võrdle seda koodi sellega, mida ${a} näeb, isiklikult või telefonis. Kui need ühtivad, ei saa keegi vahepeal su sõnumeid lugeda.`,
  scGroupsAria: (a) => `Turvakood: ${a}`,
  scCopy: 'Kopeeri kood',
  scCopied: 'Kopeeritud',
  scVerify: 'Koodid ühtivad',
  scUnverify: 'Märgi kontrollimata',
  scVerified: 'Kontrollitud',
  scNotVerified: 'Veel kontrollimata',
  scClose: 'Sulge',
  scLoading: 'Koodi laadimine',
  scNoKey:
    'Turvakoodi veel pole. See ilmub, kui krüpteeritud vestlus on mõlemal poolel seadistatud.',
  scChangedTitle: (a) => `${a} turvakood muutus`,
  scChangedBody: (a) =>
    `Sõnumid jäävad krüpteerituks: see seade pakkis vestluse võtme uue võtmega. Kui muutus on ootamatu, võrdle uut koodi kasutajaga ${a}.`,
  scChangedReview: 'Vaata koodi',
  scChangedToast: (a) => `${a} turvakood muutus`,
  scChangedReviewSub: 'Muutus. Vaata uut koodi',
  // Re-authentication and idle lock
  raTitle: 'Kinnita, et see oled sina',
  raBodyExport: 'Eksport kopeerib kliendi andmed rakendusest välja. Jätkamiseks sisesta parool.',
  raBodyEnd: 'Suhte lõpetamine peatab jagamise mõlemas suunas. Jätkamiseks sisesta parool.',
  raBodyRevoke: 'Kutse tagasivõtmine lülitab lingi kõigile välja. Jätkamiseks sisesta parool.',
  raBodyDelete: 'Deleting your account cannot be undone. Enter your password to delete it now.',
  raBodyMyExport:
    'Your copy contains your personal data, including health data. Enter your password to continue.',
  raPassword: 'Parool',
  raIdentifier: 'Kasutajanimi või e-post',
  raConfirm: 'Kinnita',
  raCancel: 'Tühista',
  raWrong: 'See parool ei ole õige.',
  raLocked: 'Liiga palju katseid. Proovi 15 minuti pärast.',
  raOffline: 'Ühendus puudub. Kontrolli võrku ja proovi uuesti.',
  raError: 'Parooli kontrollimine ebaõnnestus. Proovi uuesti.',
  // Roster export and invite withdrawal
  exScopeRoster: 'klientide nimekiri',
  invWithdrawFor: (a) => `Võta kutse tagasi: ${a}`,
  invWithdrawTitle: (a) => `Kas võtta kutse tagasi: ${a}?`,
  invWithdrawBody: 'Midagi pole veel jagatud. Võid igal ajal uuesti kutsuda.',
  invWithdrawEffect: 'Link lakkab kõigile töötamast.',
  invWithdrawConfirm: 'Võta kutse tagasi',
  invResendFor: (a) => `Saada uus kutse: ${a}`,
  invResendDone: (a) => `Uus kutse (${a}) on valmis. Vana link enam ei tööta.`,
  invCopyLink: 'Kopeeri link',
  invResendFailed: 'Uue kutse saatmine ebaõnnestus. Kontrolli ühendust ja proovi uuesti.',
  invWithdrawFailed: 'Kutse tagasivõtmine ebaõnnestus. Kontrolli ühendust ja proovi uuesti.',
  // End coaching (trainer side)
  ecMenu: (a) => `Lõpeta koostöö: ${a}`,
  ecTitle: (a) => `Kas lõpetada koostöö: ${a}?`,
  ecBody: 'Jagamine peatub mõlemas suunas. Hiljem saad uuesti kutsuda.',
  ecEffectSee: (a) => `Sa ei näe enam andmeid: ${a}.`,
  ecEffectKeeps: (a) => `${a} jätab vestluse ja programmi alles.`,
  ecEffectNotes: 'Sinu märkmed ja otsused jäävad sulle.',
  ecConfirm: 'Lõpeta koostöö',
  ecFailed: 'Koostöö lõpetamine ebaõnnestus. Kontrolli ühendust ja proovi uuesti.',
  // Share requests, decision sharing
  askMsg: (what) => `Jagamistaotlus: ${what}`,
  askCardKind: 'Jagamistaotlus',
  askCardMine: (what) => `Palusid vaatamiseks: ${what}.`,
  askCardTheirs: (what) => `Treener palub vaatamiseks: ${what}.`,
  askCardOpen: 'Ava jagamise seaded',
  askFailed: 'Taotluse saatmine ebaõnnestus. Kontrolli ühendust ja proovi uuesti.',
  undo: 'Võta tagasi',
  undoCountdown: 'Tagasivõtmine on võimalik 8 sekundit',
  dsUnsharedToast: (a) => `Jagamine lõpetatud: ${a}`,
  dsFailed: 'Jagamise muutmine ebaõnnestus. Kontrolli ühendust ja proovi uuesti.',
  // Quiet hours (Q-17)
  qhTitle: 'Vaikne aeg',
  qhSub: (from, to) =>
    `Treeneri sõnumid ilma helita ajavahemikus ${from}–${to}. Need jäävad ikka lugemata.`,
  qhFrom: 'Alates',
  qhTo: 'Kuni',
  // Notification switches (SPO-237)
  pnRequests: 'Taotlused',
  pnReminders: 'Meeldetuletused',
  pnTeam: 'Meeskond',
  pnSub:
    'Lülita liik välja, et selle push ei tuleks. Teade jääb Spotterisse. Vaikne aeg taotlusi ei peata.',
};
