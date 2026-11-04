/**
 * Atlase fraasiraamat — eesti keeles, kirjutatud eesti keeles (mitte tõlge).
 * Kolm temperamenti: 1 roheline — sinu jõusaalivend · 3 kollane — otse ja kuivalt ·
 * 5 punane — teeb su laiskuse maatasa (aga mitte kunagi su keha).
 *
 * Harjutuste ja lihaste nimed jäävad nimetavasse käändesse (need tulevad
 * vormindajast), seepärast on laused ehitatud nii, et nime ei pea käänama.
 */
import type { PhraseBook } from '../atlas/voice';
import * as N from '../atlas/num';

const pct = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;

/** A span as a person says it ("3 weeks"), and the same opening a sentence. */
const sp = (d: number) => N.spanDays('et', d);
const Sp = (d: number) => N.cap(sp(d));

export const ET: PhraseBook = {
  intro: {
    1: [
      (f) =>
        f.sessions
          ? `Tervist, vend! Atlas siin. Vaatasin su ${f.sessions} trenni üle — nüüdsest olen igal trennil sinuga. Lähme!`
          : 'Tervist, vend! Atlas siin. Pane esimene trenn kirja ja edasi olen igal trennil sinuga.',
      (f) =>
        f.sessions
          ? `Tere, semu! Atlas siin. Käisin su ${f.sessions} trenni läbi — ägedalt tehtud. Edasi teeme koos, lähme!`
          : 'Tere, semu! Atlas siin. Pane esimene trenn kirja ja alustame — ma olen kogu aeg sinu nurgas.',
      (f) =>
        `Hei, kangelane! Mina olen Atlas, sinu uus trennikaaslane. ${f.sessions ? `${f.sessions} trenni on juba kirjas, see on täitsa hea algus.` : 'Pane mõni trenn kirja ja siis hakkab pihta.'}`,
      (f) =>
        `Mees, tere! Atlas kohal. ${f.sessions ? 'Vaatasin su senised trennid üle — hea vaim!' : 'Puhas leht, parim algus.'} Ma ei kao kuhugi, iga seeria juures olen sinuga.`,
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
      (f, x) =>
        `Bro, ${x.exercise(f.exercise)} ${x.kg(f.weight)} × ${f.reps}! Eelmine oli ${x.kg(f.prevWeight)} — täitsa hullumeelne hüpe, kangelane!`,
      (f, x) =>
        `Ägedalt, mees! ${x.exercise(f.exercise)}: ${x.kg(f.weight)} × ${f.reps} ja uus rekord. Võta hetk ja naudi seda, sa väärid!`,
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
      (f, x) =>
        `Semu, ${x.exercise(f.exercise)} on ${f.sessions} trenni ${x.kg(f.weight)} peal. Vahel jääbki asi korraks seisma, see on täitsa normaalne. Proovi üks kordus rohkem.`,
      (f, x) =>
        `Bro, ${x.kg(f.weight)} juba ${f.sessions} korda — ära muretse, platood tulevad kõigile. Ühe korduse või pisut kergema variandiga lähme jälle edasi.`,
      (f, x) =>
        `Mees, ${x.kg(f.weight)} on sul nüüd päris kindlalt käes! ${x.exercise(f.exercise)}, ${f.sessions} trenni sama raskusega — järgmine samm on tilluke, aga päris.`,
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
      (f, x) =>
        `Semu, ${x.exercise(f.exercise)}: puhkus oli ${x.mmss(f.restSec)}, siht ${x.mmss(f.targetSec)}. Anna endale veidi rohkem aega, järgmine seeria tuleb parem.`,
      (f, x) =>
        `Kuule, kangelane, ära kiirusta — ${x.mmss(f.restSec)} on napp, ${x.mmss(f.targetSec)} toob jõu tagasi. Aega on küll!`,
      (f, x) =>
        `Bro, puhka täis ${x.mmss(f.targetSec)}, pole kiiret. Ma ootan sinuga ja siis läheb kangi alla korralikult.`,
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
      (f) =>
        `${f.prevReps} → ${f.reps} — vend, see juhtub kõigiga. Võta natuke pikem paus ja järgmine tuleb jälle.`,
      (f) =>
        `Semu, ${f.reps} kordust pärast ${f.prevReps} on täiesti okei. Hinga sügavalt ja anna uus hoog!`,
      (f) =>
        `Mees, väike langus ${f.prevReps} → ${f.reps}, mingit probleemi pole. Kiire pausike ja lähme edasi.`,
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
      (f) =>
        `Hei, semu! ${f.dayName ? `Täna on kavas ${f.dayName}` : 'Täna on trennipäev'}. Kui aega vähe, tee lühike — ikkagi plussis. Ootan sind!`,
      (f) =>
        `Bro, nii hea päev trenniks! ${f.dayName ? `${f.dayName} ootab` : 'Saal ootab'} — ka paarkümmend minutit on võit. Lähme?`,
      () =>
        'Kuule, kangelane, ma ei sunni — aga saal on avatud ja mina olen siin. Ka väike trenn loeb, tule!',
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
        `Vend, sel nädalal ${x.muscle(f.high)}: ${f.highSets} seeriat, aga ${x.muscle(f.low)}: ainult ${f.lowSets}. Järgmine kord teeme ka sellele natuke armastust!`,
      (f, x) =>
        `Semu, ${x.muscle(f.high)} sai ${f.highSets} seeriat, ${x.muscle(f.low)} ainult ${f.lowSets}. Järgmine trenn anna väikesele vennale rohkem tähelepanu!`,
      (f, x) =>
        `Bro, vahva töö ${x.muscle(f.high)} kallal (${f.highSets})! Nüüd ${x.muscle(f.low)} ka (${f.lowSets}) — siis on terviklik pilt.`,
      (f, x) =>
        `Mees, nädala tasakaal: ${x.muscle(f.high)} ${f.highSets}, ${x.muscle(f.low)} ${f.lowSets}. Lisa järgmisel korral paar seeriat teisele poolele ja oledki paigas!`,
    ],
    3: [
      (f, x) =>
        `Viimased 7 päeva — ${x.muscle(f.high)}: ${f.highSets} seeriat. ${x.muscle(f.low)}: ${f.lowSets}. Paranda ära.`,
    ],
    5: [
      (f, x) =>
        `Viimased 7 päeva: ${x.muscle(f.high)} ${f.highSets}, ${x.muscle(f.low)} ${f.lowSets}. Teed ainult seda, mis lõbus on? Väga täiskasvanulik.`,
    ],
  },
  week: {
    1: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions}/${f.planned} — nädal täiesti ära tehtud! Legend!`
          : `Sel nädalal ${f.sessions}/${f.planned}. Pole hullu, iga trenn läks arvesse — järgmisel nädalal läheme uuesti!`,
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions}/${f.planned} — mees, nädal täis! Täitsa hullumeelne järjepidevus!`
          : `${f.sessions}/${f.planned} sel nädalal. Iga käimine loeb, semu — uus nädal, uus hoog!`,
      (f) =>
        f.sessions >= f.planned
          ? `Bro, ${f.sessions}/${f.planned}! Plaan täidetud, ägedalt tehtud.`
          : `${f.sessions}/${f.planned} — ega hullu pole, vend. Tähtis, et sa tulid tagasi, lähme edasi!`,
      (f) =>
        f.sessions >= f.planned
          ? `Kangelane! ${f.sessions}/${f.planned}, nädal on kotis. Puhka hästi!`
          : `Nädal sai ${f.sessions}/${f.planned}. See on alus, millele ehitada — järgmisel nädalal lisame!`,
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
        `Ooo, tere tulemast tagasi, vend! ${Sp(f.daysOff)} pausi pole midagi. Täna võtame rahulikult, siis kruvime üles.`,
      (f) =>
        `Vend, sa oled tagasi! ${Sp(f.daysOff)} pausi on täitsa tavaline asi. Alustame rahulikult ja ehitame üles.`,
      (f) =>
        `Ägedalt, mees, tore sind jälle näha! Pärast ${sp(f.daysOff)} pausi paneme täna kergema trenni ja naudime.`,
      () =>
        `Semu, tere tagasi! Pole oluline, kui kaua vahet oli — oluline, et sa siin oled. Lähme sujuvalt.`,
    ],
    3: [(f) => `${Sp(f.daysOff)} vahet. Oled tagasi — alusta kergelt.`],
    5: [
      (f) =>
        `${Sp(f.daysOff)} vahet. Arvasin juba, et kolisid alaliselt diivanile. Alusta kergelt — su uhkus elab selle üle, ta on harjunud.`,
    ],
  },
  shortSleep: {
    1: [
      (f) => `Ainult ${f.hours} h und — võta täna rahulikumalt, vend, ja õhtul varakult magama.`,
      (f) => `Semu, ${f.hours} h und on napp — täna kergem trenn ja õhtul varakult kotti.`,
      (f) =>
        `Bro, ${f.hours} h und. Kuula täna ennast, tee rahulikumalt ja puhka õhtul korralikult.`,
      (f) =>
        `Kuule, kangelane, ${f.hours} h unega pole vaja rekordeid taga ajada. Kerge trenn on täna täiesti okei.`,
    ],
    3: [(f) => `${f.hours} h und. Täna kergemalt.`],
    5: [(f) => `${f.hours} h und. Täna kergemalt.`],
  },
  streak: {
    1: [
      (f) => `${Sp(f.days)} järjest! Oled täiega hoos, vend!`,
      (f) => `${Sp(f.days)} järjest — mees, sa oled tuld täis!`,
      (f) => `Ägedalt, ${sp(f.days)} järjest! Hoia seda hoogu, kangelane.`,
      (f) => `Bro, ${Sp(f.days)} järjest ja ei peatu — täitsa hullumeelne tempo!`,
    ],
    3: [(f) => `${Sp(f.days)} järjest. Hoia seda.`],
    5: [(f) => `${Sp(f.days)} järjest. Ära kiitusega harju — seda ei tule.`],
  },
  bodyweight: {
    1: [
      (f, x) => `Kehakaal ${x.kg(f.kg)}, ${pct(f.deltaPct)} (ajavahemik: ${sp(f.days)}).`,
      (f, x) =>
        `Kehakaal ${x.kg(f.kg)}, muutus ${pct(f.deltaPct)} (${sp(f.days)}). Hea, et jälgid, semu.`,
      (f, x) => `Bro, kirjas: ${x.kg(f.kg)}, ${pct(f.deltaPct)} ajavahemikus ${sp(f.days)}.`,
      (f, x) =>
        `Uus mõõtmine: ${x.kg(f.kg)} (${pct(f.deltaPct)}, ${sp(f.days)}). Number on lihtsalt number, kangelane.`,
    ],
    3: [(f, x) => `Kehakaal ${x.kg(f.kg)}, ${pct(f.deltaPct)} (ajavahemik: ${sp(f.days)}).`],
    5: [(f, x) => `Kehakaal ${x.kg(f.kg)}, ${pct(f.deltaPct)} (ajavahemik: ${sp(f.days)}).`],
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
  // SPO-124: real swearing, effort only (never body/health/slurs); needs native review
  swear: {
    intro: [
      (f) =>
        `${f.sessions ? `Lugesin su ${f.sessions} trenni läbi. Kurat, siin on tööd.` : 'Null trenni kirjas. Kurat, alustame päris nullist.'} Olen nüüdsest igal trennil kõrval ega hoia sõnu tagasi.`,
      (f) =>
        `Atlas. ${f.sessions ? `Vittu, ${f.sessions} trenni on kirjas — vabandused on sul vist kõige paremini treenitud.` : 'Vittu, tühi leht.'} Hakkame siis tööle.`,
      () =>
        'Tere, mina olen Atlas. Türa, ma ei hakka sulle pugema: kehv seeria saab sõna, hea seeria samuti, aga harvem.',
      () =>
        'Persse, tere tulemast. Nüüd on sul kõrval keegi, kes ei lase sul tühja jahvatada. Näita, mis sa tõesti oskad.',
    ],
    session: [
      (f) => `${f.sets} seeriat ${f.minutes} minutiga? Kurat, isegi soojendus on pikem.`,
      (f) =>
        `Persse, ${f.minutes} minutit ja ${f.sets} seeriat. See pole trenn, see on kohalkäimine.`,
      (f) => `${f.sets} seeriat. Vittu, ma ootasin vähemalt higi.`,
      (f) => `Paska töö, ${f.minutes} minutit — kang ei jõudnud isegi ärgata.`,
    ],
    pr: [
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.kg(f.weight)} × ${f.reps}. Vittu, see oli tegelikult hea. Ütlesin selle ühe korra, ära harjuta.`,
      (f, x) =>
        `Persse, ${x.kg(f.weight)}! Eelmine oli ${x.kg(f.prevWeight)}. Türa, vahel sa siiski pingutad.`,
      (f, x) =>
        `${x.exercise(f.exercise)} ${x.kg(f.weight)}. Kurat küll, pidin ise nägema, et uskuda. Rekord.`,
      (f, x) => `Paska ka, ${x.kg(f.weight)} × ${f.reps}. Jah, rekord. Ei, ma ei nuta.`,
    ],
    stall: [
      (f, x) =>
        `${x.exercise(f.exercise)}, ${x.kg(f.weight)}, ${f.sessions}. trenn järjest. Kurat, see pole platoo, see on elukoht.`,
      (f, x) =>
        `Türa, ${x.kg(f.weight)} jälle! Kang on sind nii palju näinud, et tal on sinust kõrini.`,
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.kg(f.weight)}, ${f.sessions} trenni. Persse küll, lisa see kordus, mitte uus vabandus!`,
      (f, x) =>
        `Selline litsakas pingutus ei vii ${x.kg(f.weight)} pealt kuhugi. ${f.sessions} trenni ja ikka sama.`,
    ],
    restShort: [
      (f, x) =>
        `${x.mmss(f.restSec)} puhkust, kurat! Mis kiire sul on, viimased kordused maksavad selle kinni.`,
      (f, x) =>
        `Vittu, ${x.mmss(f.restSec)}? Pidi olema ${x.mmss(f.targetSec)}. Kell pole su vaenlane.`,
      (f, x) =>
        `Türa, ${x.mmss(f.restSec)}! Ootamine on ka töö, ${x.mmss(f.targetSec)} tähendab ${x.mmss(f.targetSec)}.`,
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.mmss(f.restSec)} vahet. Paska pingutus — kiire pole sama mis tugev.`,
    ],
    setDrop: [
      (f) => `${f.prevReps} → ${f.reps}. Kurat, kuhu see vaim jäi?`,
      (f) => `${f.reps} kordust! Türa, see seeria oli litsakas eelmise kõrval.`,
      (f) => `Vittu küll, ${f.prevReps} oli ja ${f.reps} sai. Keegi andis seal vaikselt alla.`,
      (f) => `Persse, ${f.reps}? Viimased kordused jätsid sind maha.`,
    ],
    skipped: [
      (f) =>
        `${f.dayName ? `${f.dayName} jäi tegemata` : 'Trenn jäi tegemata'}. Kurat, vabandusi on sul rohkem kui seeriaid.`,
      () => 'Vittu, jälle pole saalis! Diivanil on su koht juba mõnusasti ära soojendatud.',
      () => 'Türa, trenn jäi vahele. Paska vabandus ei tee ühtegi kordust.',
      (f) => `Persse, ${f.dayName ?? 'täna'} on kavas ja kang ootab üksi. Kurat, ilus lugu.`,
    ],
    imbalance: [
      (f, x) =>
        `${x.muscle(f.high)} ${f.highSets}, ${x.muscle(f.low)} ${f.lowSets}. Kurat, kas teine pool on sul nähtamatu?`,
      (f, x) =>
        `Vittu, ${f.highSets} seeriat lemmikule ja ${f.lowSets} sellele teisele — ${x.muscle(f.low)}. Valid lemmikuid nagu lasteaias.`,
      (f, x) =>
        `Persse, ${x.muscle(f.low)}: ${f.lowSets} seeriat. Sa ignoreerid seda nagu mingit tüütut kohustust.`,
      (f, x) =>
        `Türa, ${x.muscle(f.high)} ${f.highSets} vs ${x.muscle(f.low)} ${f.lowSets}. See pole programm, see on lemmikute lugu.`,
    ],
    week: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions}/${f.planned}. Kurat, tegid ära! Ära nüüd uhkusest üle pea kasva.`
          : `${f.sessions}/${f.planned}. Paska nädal — number on kirjas ja number ei valeta.`,
      (f) =>
        f.sessions >= f.planned
          ? `Vittu, ${f.sessions}/${f.planned}. Ma ei leia midagi, mille üle virisda. Imelik tunne.`
          : `Vittu, ${f.sessions}/${f.planned}. Plaan oli olemas, tegijat polnud.`,
      (f) =>
        f.sessions >= f.planned
          ? `Persse küll, ${f.sessions}/${f.planned}. Nädal kotis, kiitust ei tule.`
          : `Persse, ${f.sessions}/${f.planned}. Nädal läks vabanduste peale.`,
      (f) =>
        f.sessions >= f.planned
          ? `Türa, ${f.sessions}/${f.planned}. Täitsa tubli, nüüd tee sama uuesti.`
          : `Türa, ${f.sessions}/${f.planned}. Litsakas nädal, järgmine peab teist moodi olema.`,
    ],
  },
};
