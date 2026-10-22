/** Cycle strings (Estonian). See `cyc.en.ts`. */
import type { cycEn } from './cyc.en';

export const cycEt: typeof cycEn = {
  cycTitle: 'Tsükkel',
  cycRowOff: 'Seadistamata',
  cycRowPaused: 'Raseduse ajal välja lülitatud',
  cycRowMenopause: 'Pärast menopausi välja lülitatud',
  cycRowLog: 'Ainult logi',
  cycRowDay: (day, phase) => `${day}. päev · ${phase}`,

  cycPhMenses: 'Menstruatsioon',
  cycPhEarly: 'Tsükli algus',
  cycPhMid: 'Tsükli keskpaik',
  cycPhLate: 'Tsükli lõpp',
  cycHintMenses: 'Enesetunne on erinev. Lähtu sellest, kuidas end tunned.',
  cycHintEarly: 'Paljudel on siin rohkem energiat, aga mitte kõigil.',
  cycHintMid: 'Ilma reegliteta: vaata RPE-d ja und.',
  cycHintLate: 'Mõnele on taastumine raskem. See ei pruugi olla sinu pärast.',

  cycSetupIntro:
    'Sisesta üks kord, millal tsükkel tavaliselt algab ja kui kaua see kestab. Edasi peab logi ennast ise: käsitsi pole midagi vaja.',
  cycMode: 'Režiim',
  cycModeRegular: 'Regulaarne',
  cycModeIrregular: 'Ebaregulaarne',
  cycModeLog: 'Ainult logi',
  cycModeFootRegular: 'Stabiilne tsükkel: hindame faasi ja järgmist algust.',
  cycModeFootIrregular: 'Muutuv tsükkel: laiemad vahemikud ja ainult ligikaudne faas.',
  cycModeFootLog:
    'Ilma hinnanguteta, ainult veritsuspäevad sinu kuupäevade järgi. Sobib hormonaalse rasestumisvastase vahendi korral.',
  cycUsually: 'Tavaliselt',
  cycLastStart: 'Viimane tsükkel algas',
  cycLength: 'Tsükli pikkus',
  cycPeriod: 'Menstruatsiooni pikkus',
  cycShortest: 'Lühim tsükkel',
  cycLongest: 'Pikim tsükkel',
  cycUsuallyFoot: 'Ainult sinu tüüpilised väärtused. Midagi muud me välja ei mõtle.',
  cycDaysUnit: 'p',
  cycOutOfNorm: 'Need väärtused jäävad tavapärasest vahemikust välja. Seda tasub arstile mainida.',
  cycSave: 'Salvesta',
  cycCancel: 'Tühista',
  cycPrivate: 'Privaatne. Krüpteeritud seadmes ja pilves. Kellelegi ei jagata.',

  cycApprox: 'Hinnang',
  cycLikely: 'Tõenäoliselt',
  cycDayOf: (day, len) => `${day}. päev ~${len}-st`,
  cycNextStart: (from, to) =>
    from === to ? `Järgmine algus: ${from}` : `Järgmine algus: ${from} – ${to} (80% vahemik)`,
  cycLogHead: 'Ainult logi',
  cycLogLast: (date) => `Viimane tsükkel algas ${date}`,
  cycLogNote: 'Ilma hinnanguteta, ainult salvestatud päevad.',
  cycCalendar: 'Kalender',
  cycLegendLogged: 'Salvestatud menstruatsioon',
  cycUpdateDate: 'Uuenda alguskuupäeva',
  cycUpdateTitle: 'Millal viimane tsükkel algas?',
  cycUpdateSave: 'Salvesta kuupäev',
  cycSettings: 'Seaded',
  cycStale: 'Ajakava on aegunud. Hinnangud on välja lülitatud, kuni uuendad kuupäeva.',
  cycStaleBtn: 'Uuenda kuupäeva',

  cycStates: 'Seisundid',
  cycStatesFoot: 'Siin märkimine lisab seisundi kohe krooniliste hulka ja Tsükkel lülitub välja.',
  cycMarkPreg: 'Märgi rasedus',
  cycMarkMeno: 'Märgi menopaus',
  cycPregTitle: 'Märgi rasedus',
  cycPregBody:
    'Sisesta alguskuupäev (või ligikaudne). Trimester selgub ise ja seisund ilmub kroonilistesse.',
  cycPregInfo: (week) => `Umbes ${week}. nädal`,
  cycPregAdd: 'Lisa seisund',
  cycMenoTitle: 'Märgi menopaus?',
  cycMenoBody:
    'Menopaus lisatakse krooniliste hulka ja Tsükkel lülitub välja. Andmed jäävad alles.',
  cycMenoConfirm: 'Märgi',

  cycOffTitle: 'Tsükkel on välja lülitatud',
  cycOffPregnancy:
    'Kroonilistes on aktiivne rasedus. Andmed jäävad alles; kui see lõpeb, küsime uut alguskuupäeva.',
  cycOffMenopause: 'Kroonilistes on märgitud menopaus. Andmed jäävad alles.',
  cycPausedNeutral: 'Peatatud',
  cycOffNeutral: 'Tsükkel on praegu peatatud. Sinu andmed on alles.',
  cycOpenStates: 'Ava seisundid',
  cycAfterPause: 'Paus on läbi. Sisesta, millal tsükkel algas, et jätkata.',

  cycWhere: 'Kus näidata',
  cycWhereFoot:
    'Iga neist saab välja lülitada. Siin ei muutu plaan, progressioon ega automaatselt koostatud treeningud.',
  cycSurfToday: 'Märk Today vaates',
  cycSurfCalendar: 'Värv kalendris',
  cycSurfSession: 'Märkus treeningus',
  cycDelete: 'Kustuta tsükli andmed',
  cycDeleteTitle: 'Kustutada tsükli andmed?',
  cycDeleteBody: 'Kuupäevad ja seaded eemaldatakse seadmest ja pilvest. Seda ei saa tagasi võtta.',
  cycDeleteConfirm: 'Kustuta',
  cycPatterns: 'Mustrid',
  cycPatternsSub: 'Sinu pingutus faaside kaupa',
  cycPatIntro:
    'See on sinu enda hinnatud pingutus, mitte üldreegel. Iga faasi võrreldakse sama tsükli keskmisega.',
  cycPatRow: (diff, lo, hi) => `${diff} RPE (${lo} … ${hi})`,
  cycPatHigher: 'Tavaliselt kõrgem kui sinu keskmine',
  cycPatLower: 'Tavaliselt madalam kui sinu keskmine',
  cycPatSame: 'Keskmisest eristamatu',
  cycPatCycles: (n) => `${n} tsüklit`,
  cycPatEmptyTitle: 'Andmeid on veel vähe',
  cycPatEmptyBody: (n) =>
    `Vaja on vähemalt 3 tsüklit hinnatud seeriatega vähemalt kahes faasis. Tsükleid siiani: ${n}. Need tulevad sinu sisestatud alguskuupäevadest.`,
  cycPatFoot:
    'Paaris erinevus tsüklite kaupa, 95% vahemik (bootstrap). Hindamata seeriaid ja soojendust ei arvestata.',
  cycSessionHigher: (diff) =>
    `Selles faasis on sinu hinnatud seeriad tavaliselt ${diff} RPE võrra keskmisest kõrgemad. Plaan ei muutu.`,
  cycSessionLower: (diff) =>
    `Selles faasis on sinu hinnatud seeriad tavaliselt ${diff} RPE võrra keskmisest madalamad. Plaan ei muutu.`,
};
