/**
 * Atlase fraasiraamat — eesti keeles, kirjutatud eesti keeles (mitte tõlge).
 * Kolm temperamenti: 1 roheline — sinu jõusaalivend · 3 kollane — otse ja kuivalt ·
 * 5 punane — teeb su laiskuse maatasa (aga mitte kunagi su keha).
 *
 * Harjutuste ja lihaste nimed jäävad nimetavasse käändesse (need tulevad
 * vormindajast), seepärast on laused ehitatud nii, et nime ei pea käänama.
 */
import type { PhraseBook } from '../atlas/voice';

const pct = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;

export const ET: PhraseBook = {
  intro: {
    1: [
      (f) =>
        f.sessions
          ? `Tervist, vend! Atlas siin. Vaatasin su ${f.sessions} trenni üle — nüüdsest olen igal trennil sinuga. Lähme!`
          : 'Tervist, vend! Atlas siin. Pane esimene trenn kirja ja edasi olen igal trennil sinuga.',
    ],
    3: [
      (f) =>
        f.sessions
          ? `Atlas. Lugesin su ${f.sessions} trenni läbi. Edaspidi ütlen iga trenni kohta otse, mis ma arvan.`
          : 'Atlas. Midagi pole kirjas. Enne trenn, siis jutt.',
    ],
    5: [
      (f) =>
        f.sessions
          ? `Lugesin su ${f.sessions} trenni läbi. Sain kõvasti naerda. Nüüd olen igal trennil kohal — küll sa seda veel kahetsed.`
          : 'Null trenni. Julge strateegia. Pane ükskõik mida kirja.',
    ],
  },
  session: {
    1: [
      (f) =>
        `Lähme! ${f.sets} seeriat ${f.minutes} minutiga — just nii seda tehakse, vend. Nüüd söö korralikult ja puhka.`,
      (f) => `Pauh! ${f.sets} seeriat, ${f.minutes} minutit. Masin oled!`,
      (f) => `${f.sets} seeriat tehtud. Korralik töö, sõber!`,
      (f) =>
        `No see oli hea trenn, vend. ${f.minutes} minutit ja ${f.sets} seeriat — ausalt välja teenitud.`,
    ],
    3: [
      (f) => `${f.sets} seeriat, ${f.minutes} min. Normaalne.`,
      (f) => `Tehtud. ${f.sets} seeriat. Rohkem pole midagi öelda.`,
      (f) => `${f.minutes} minutit, ${f.sets} seeriat. Kirjas. Kõik.`,
    ],
    5: [
      (f) =>
        `${f.sets} seeriat. Ja see oli trenn või? Olen näinud soojendusi, kus on rohkem ambitsiooni.`,
      (f) => `${f.minutes} minutit… mingit tegevust. Panen trenniks kirja. Haletsusest.`,
      (f) => `${f.sets} seeriat. Kang ilmselt ei saanudki aru, et teda tõsteti.`,
      (f) => `Kirjas. ${f.sets} seeriat. Loodame, et keegi ei näinud.`,
      (f) =>
        `${f.minutes} minutit saalis ja ${f.sets} seeriat. Riietusruumis veetsid vist rohkem aega.`,
    ],
  },
  pr: {
    1: [
      (f, x) =>
        `LÄHME! ${x.exercise(f.exercise)} ${x.kg(f.weight)} × ${f.reps} — uus rekord! Loom oled!`,
      (f, x) =>
        `Vend. ${x.exercise(f.exercise)}: ${x.kg(f.weight)} × ${f.reps}. Isiklik rekord. Mul on täitsa kananahk!`,
    ],
    3: [
      (f, x) => `${x.exercise(f.exercise)} ${x.kg(f.weight)}. Rekord. Tee uuesti, siis usun.`,
      (f, x) => `${x.exercise(f.exercise)}: ${x.kg(f.weight)}. Hea. Ära pidu pane.`,
    ],
    5: [
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.kg(f.weight)} × ${f.reps}. „Rekord". Pärast ${x.kg(f.prevWeight)} oli latt ju maas.`,
      (f, x) => `${x.exercise(f.exercise)} liikus lõpuks. Ma juba hakkasin järelhüüet kirjutama.`,
      (f, x) => `${x.kg(f.weight)}. Aplausi ei tule — see oleks pidanud kuu aega tagasi juhtuma.`,
    ],
  },
  stall: {
    1: [
      (f, x) =>
        `${x.exercise(f.exercise)} on juba ${f.sessions} trenni ${x.kg(f.weight)} peal — pole hullu, vend, nii juhtub. Järgmine kord üks kordus juurde ja asi hakkab liikuma.`,
    ],
    3: [
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.kg(f.weight)}, ${f.sessions} korda järjest. Seisad paigal. Lisa kordus.`,
    ],
    5: [
      (f, x) =>
        `${x.exercise(f.exercise)}, ${x.kg(f.weight)}, trenn number ${f.sessions}. Kang tunneb su nägu juba ära. Tal on igav.`,
      (f, x) => `${x.kg(f.weight)}. Jälle. Sa ei treeni, sa istud karistust ära.`,
      (f, x) =>
        `${x.exercise(f.exercise)}: ${f.sessions} trenni sama raskusega. Stabiilsus on pensionifondi jaoks, mitte kangi jaoks.`,
    ],
  },
  restShort: {
    1: [
      (f, x) =>
        `Vend, ${x.exercise(f.exercise)}: seeriate vahel puhkasid ainult ${x.mmss(f.restSec)}. Võta ikka täis ${x.mmss(f.targetSec)} — viimased seeriad ütlevad aitäh.`,
    ],
    3: [
      (f, x) => `Puhkasid ${x.mmss(f.restSec)}. Pidi olema ${x.mmss(f.targetSec)}. Selline lugu.`,
    ],
    5: [
      (f, x) =>
        `${x.mmss(f.restSec)} puhkust. Kuhugi kiire või? Sest su areng küll kuhugi ei kiirusta.`,
      (f, x) =>
        `${x.mmss(f.targetSec)} tähendab ${x.mmss(f.targetSec)}, mitte ${x.mmss(f.restSec)}. Lugeda oskad? Mis vabandus sul siis kangi all on?`,
    ],
  },
  setDrop: {
    1: [
      (f) =>
        `${f.prevReps} → ${f.reps} kordust — pole stressi, sõber. Istu enne järgmist natuke kauem.`,
    ],
    3: [(f) => `${f.reps}? Eelmine seeria oli ${f.prevReps}. Puhka korralikult.`],
    5: [
      (f) => `${f.reps}. Pärast ${f.prevReps}. Tühjenesid kiiremini kui sünnipäevaõhupall.`,
      (f) => `${f.reps} kordust. Pink su all teeb rohkem tööd.`,
    ],
  },
  skipped: {
    1: [
      (f) =>
        `${f.dayName ? `Kuule vend, täna on kavas ${f.dayName}` : 'Kuule vend, täna on trennipäev'} — ka lühike trenn läheb arvesse. Oled mängus?`,
    ],
    3: [(f) => `${f.dayName ? `Kavas: ${f.dayName}` : 'Trenn'}. Täna. Tead küll, kus saal on.`],
    5: [
      (f) =>
        `${f.dayName ? `Kavas on ${f.dayName}` : 'Trennipäev'}, aga sind pole kuskil. Diivan on vist rõõmus. Vähemalt keegi on.`,
      () => `Ikka pole saalis? Pole hullu, hantlid on harjunud, et neid ignoreeritakse.`,
    ],
  },
  imbalance: {
    1: [
      (f, x) =>
        `Vend, ${x.muscle(f.high)}: ${f.highSets} seeriat, aga ${x.muscle(f.low)}: ainult ${f.lowSets}. Järgmine kord teeme ka sellele natuke armastust!`,
    ],
    3: [
      (f, x) =>
        `${x.muscle(f.high)}: ${f.highSets} seeriat. ${x.muscle(f.low)}: ${f.lowSets}. Paranda ära.`,
    ],
    5: [
      (f, x) =>
        `${x.muscle(f.high)} ${f.highSets}, ${x.muscle(f.low)} ${f.lowSets}. Teed ainult seda, mis lõbus on? Väga täiskasvanulik.`,
    ],
  },
  week: {
    1: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions}/${f.planned} — nädal täiesti ära tehtud! Legend!`
          : `Sel nädalal ${f.sessions}/${f.planned}. Pole hullu, iga trenn läks arvesse — järgmisel nädalal läheme uuesti!`,
    ],
    3: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions}/${f.planned}. Plaanis.`
          : `${f.sessions}/${f.planned}. Plaanist maas.`,
    ],
    5: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions}/${f.planned}. Oot. Kes sa oled ja mis sa mu kliendiga tegid?`
          : `${f.sessions}/${f.planned}. Ootasin vähe ja sa suutsid ikka alla selle jääda.`,
    ],
  },
  comeback: {
    1: [
      (f) =>
        `Ooo, tere tulemast tagasi, vend! ${f.daysOff} päeva pole midagi. Täna võtame rahulikult, siis kruvime üles.`,
    ],
    3: [(f) => `${f.daysOff} päeva vahet. Oled tagasi — alusta kergelt.`],
    5: [
      (f) =>
        `${f.daysOff} päeva. Arvasin juba, et kolisid alaliselt diivanile. Alusta kergelt — su uhkus elab selle üle, ta on harjunud.`,
    ],
  },
  shortSleep: {
    1: [(f) => `Ainult ${f.hours} h und — võta täna rahulikumalt, vend, ja õhtul varakult magama.`],
    3: [(f) => `${f.hours} h und. Täna kergemalt.`],
    5: [(f) => `${f.hours} h und. Täna kergemalt.`],
  },
  streak: {
    1: [(f) => `${f.days} päeva järjest! Oled täiega hoos, vend!`],
    3: [(f) => `${f.days} päeva järjest. Hoia seda.`],
    5: [(f) => `${f.days} päeva järjest. Ära kiitusega harju — seda ei tule.`],
  },
  bodyweight: {
    1: [(f, x) => `Kehakaal ${x.kg(f.kg)}, ${f.days} päevaga ${pct(f.deltaPct)}.`],
    3: [(f, x) => `Kehakaal ${x.kg(f.kg)}, ${f.days} päevaga ${pct(f.deltaPct)}.`],
    5: [(f, x) => `Kehakaal ${x.kg(f.kg)}, ${f.days} päevaga ${pct(f.deltaPct)}.`],
  },
  mom: {
    session: [(f) => `${f.sets} seeriat. Su ema teeb pühapäeval kahe pesumasinatäie vahel rohkem.`],
    stall: [
      (f, x) => `${x.exercise(f.exercise)}, ${x.kg(f.weight)}, jälle. Su ema soojendab sellega.`,
    ],
    restShort: [
      (f, x) => `${x.mmss(f.restSec)} puhkust. Su emal läheb kahe häälsõnumi vahel kauem.`,
    ],
    skipped: [() => `Su ema käis täna juba trennis. Lihtsalt ütlen.`],
    setDrop: [(f) => `${f.reps}? Su ema tegi tühja kangiga ${f.prevReps} ja ei virisenud.`],
    week: [
      (f) => `${f.sessions} trenni. Su ema jõuab nädalaga rohkem. Ja toidab sind veel lisaks.`,
    ],
  },
};
