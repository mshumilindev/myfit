/**
 * Atlas frazės — lietuviškai, rašyta lietuviškai (ne vertimas iš anglų).
 * Trys charakteriai: 1 Šiltas — savas bro · 3 Tiesus — trumpai ir sausai ·
 * 5 Negailestingas — šaiposi iš tinginystės (bet niekada iš kūno).
 */
import type { PhraseBook } from '../atlas/voice';

const pct = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;

/** Lithuanian count agreement: 1 serija · 2 serijos · 10 serijų. */
const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const t = n % 100;
  const w = !Number.isInteger(n)
    ? few
    : d === 1 && t !== 11
      ? one
      : d >= 2 && (t < 12 || t > 19)
        ? few
        : many;
  return `${n} ${w}`;
};
const sets = (n: number) => pl(n, 'serija', 'serijos', 'serijų');
const reps = (n: number) => pl(n, 'pakartojimas', 'pakartojimai', 'pakartojimų');
const sessions = (n: number) => pl(n, 'treniruotė', 'treniruotės', 'treniruočių');
const days = (n: number) => pl(n, 'diena', 'dienos', 'dienų');

export const LT: PhraseBook = {
  intro: {
    1: [
      (f) =>
        f.sessions
          ? `Labas, broli! Aš Atlas. Permečiau tavo istoriją — ${sessions(f.sessions)}. Nuo dabar esu šalia kiekvienoje. Varom!`
          : 'Labas, broli! Aš Atlas. Įrašyk pirmą treniruotę — ir toliau jau varom kartu.',
    ],
    3: [
      (f) =>
        f.sessions
          ? `Atlas. Istoriją mačiau: ${sessions(f.sessions)}. Toliau komentuoju kiekvieną. Be cukraus.`
          : 'Atlas. Įrašų nulis. Pirma sportuoji, paskui kalbamės.',
    ],
    5: [
      (f) =>
        f.sessions
          ? `Peržiūrėjau tavo istoriją — ${sessions(f.sessions)}. Pasijuokiau. Dabar būsiu kiekvienoje treniruotėje. Pasigailėsi.`
          : 'Nulis treniruočių. Drąsi strategija. Įrašyk bent ką nors, žmogau.',
    ],
  },
  session: {
    1: [
      (f) =>
        `Varom! ${sets(f.sets)} per ${f.minutes} min. — štai kaip reikia, broli. Dabar pavalgyk ir ilsėkis.`,
      (f) => `Yra! ${sets(f.sets)}, ${f.minutes} min. Tu mašina, drauguži.`,
      (f) => `${sets(f.sets)} — įskaityta. Gerai padirbėjai, bro!`,
      (f) => `Šaunuolis! ${f.minutes} min. salėje ne veltui. Taip ir toliau!`,
    ],
    3: [
      (f) => `${sets(f.sets)}, ${f.minutes} min. Normaliai.`,
      (f) => `Baigta. ${sets(f.sets)}. Nėra ką pridurti.`,
      (f) => `${f.minutes} min., ${sets(f.sets)}. Užskaityta. Tiek.`,
    ],
    5: [
      (f) => `${sets(f.sets)}. Čia treniruotė? Mačiau apšilimų su didesnėm ambicijom.`,
      (f) => `${f.minutes} min. kažko. Įrašysiu kaip treniruotę. Iš gailesčio.`,
      (f) => `${sets(f.sets)}. Grifas tikriausiai net nepastebėjo, kad jį kėlė.`,
      (f) => `Įrašyta. ${sets(f.sets)}. Tikėkimės, niekas nematė.`,
    ],
  },
  pr: {
    1: [
      (f, x) =>
        `VAROOOM! ${x.exercise(f.exercise)}: ${x.kg(f.weight)} × ${f.reps} — naujas rekordas! Žvėris!`,
      (f, x) =>
        `Broli. ${x.exercise(f.exercise)}, ${x.kg(f.weight)} × ${f.reps}. Asmeninis rekordas. Aš užsivedęs!`,
      (f, x) =>
        `Nu tu duodi! ${x.kg(f.weight)} — ${x.exercise(f.exercise)} dar niekada taip nėjo. Didžiuojuos!`,
    ],
    3: [
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.kg(f.weight)}. Rekordas. Pakartok — tada patikėsiu.`,
      (f, x) => `${x.kg(f.weight)}, ${x.exercise(f.exercise)}. Gerai. Nešvęsk.`,
    ],
    5: [
      (f, x) =>
        `${x.exercise(f.exercise)}, ${x.kg(f.weight)} × ${f.reps}. „Rekordas“. Kai anksčiau buvo ${x.kg(f.prevWeight)}, kartelė gulėjo ant grindų.`,
      (f, x) =>
        `${x.exercise(f.exercise)} pagaliau pajudėjo. O aš jau buvau pradėjęs rašyti nekrologą.`,
      (f, x) => `${x.kg(f.weight)}. Plojimų nebus — tai turėjo įvykti prieš mėnesį.`,
    ],
  },
  stall: {
    1: [
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.kg(f.weight)}, treniruočių iš eilės — ${f.sessions}. Ramiai, broli, taip būna. Kitą kartą vienu pakartojimu daugiau, ir pajudės.`,
    ],
    3: [
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.kg(f.weight)}, ${sessions(f.sessions)} iš eilės. Įstrigai. Pridėk pakartojimą.`,
    ],
    5: [
      (f, x) =>
        `${x.exercise(f.exercise)}, ${x.kg(f.weight)}, ir taip jau ${sessions(f.sessions)}. Grifas tave jau pažįsta iš veido. Jam nuobodu.`,
      (f, x) => `${x.kg(f.weight)}. Vėl. Tu ne treniruojiesi, tu bausmę atlikinėji.`,
      (f, x) =>
        `${x.exercise(f.exercise)}: ${sessions(f.sessions)} su tuo pačiu svoriu. Stabilumas geras pensijų fondui, ne progresui.`,
    ],
  },
  restShort: {
    1: [
      (f, x) =>
        `Broli, ${x.exercise(f.exercise)}: ilsėjaisi tik ${x.mmss(f.restSec)}. Pasiimk visas ${x.mmss(f.targetSec)} — paskutinės serijos padėkos.`,
    ],
    3: [(f, x) => `Poilsis ${x.mmss(f.restSec)}. Turėjo būti ${x.mmss(f.targetSec)}. Ir viskas.`],
    5: [
      (f, x) =>
        `${x.mmss(f.restSec)} poilsio. Kur skubi? Progresas tavo tai tikrai niekur neskuba.`,
      (f, x) =>
        `${x.mmss(f.targetSec)} reiškia ${x.mmss(f.targetSec)}, ne ${x.mmss(f.restSec)}. Skaičiuoti moki? Tai kuo teisiniesi prie grifo?`,
    ],
  },
  setDrop: {
    1: [
      (f) =>
        `${f.prevReps} → ${f.reps} — nieko baisaus, drauguži. Prieš kitą seriją pasėdėk ilgiau.`,
    ],
    3: [(f) => `${reps(f.reps)}? Praeitoj serijoj buvo ${f.prevReps}. Ilsėkis kaip reikia.`],
    5: [
      (f) => `${f.reps}. Po ${f.prevReps}. Subliūškai greičiau nei balionas po gimtadienio.`,
      (f) => `${reps(f.reps)}. Suoliukas po tavim dirba daugiau.`,
    ],
  },
  skipped: {
    1: [
      (f) =>
        `${f.dayName ? `Ei, broli, šiandien pagal planą: ${f.dayName}` : 'Ei, broli, šiandien treniruotės diena'} — net greita treniruotė skaitosi. Einam?`,
    ],
    3: [
      (f) =>
        `${f.dayName ? `Pagal planą: ${f.dayName}` : 'Treniruotė'}. Šiandien. Kur salė — žinai.`,
    ],
    5: [
      (f) =>
        `${f.dayName ? `Pagal planą — ${f.dayName}` : 'Treniruotės diena'}, o tavęs nėra. Sofa turbūt laiminga. Bent jau kažkas.`,
      () => 'Vis dar ne salėje? Nieko, hanteliai jau pratę, kad juos ignoruoja.',
    ],
  },
  imbalance: {
    1: [
      (f, x) =>
        `Broli, ${x.muscle(f.high)}: ${sets(f.highSets)}, o ${x.muscle(f.low)}: tik ${f.lowSets}. Kitą kartą parodyk daugiau meilės ir šitiems!`,
    ],
    3: [
      (f, x) =>
        `${x.muscle(f.high)}: ${sets(f.highSets)}. ${x.muscle(f.low)}: ${f.lowSets}. Sutvarkyk.`,
    ],
    5: [
      (f, x) =>
        `${x.muscle(f.high)} — ${f.highSets}, ${x.muscle(f.low)} — ${f.lowSets}. Treniruoji tik tai, kas smagu? Labai suaugusiai.`,
    ],
  },
  week: {
    1: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} iš ${f.planned} — savaitė sutriuškinta! Legenda!`
          : `${f.sessions} iš ${f.planned} šią savaitę. Ramiai, kiekviena skaitosi — kitą savaitę varom iš naujo!`,
    ],
    3: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} iš ${f.planned}. Pagal planą.`
          : `${f.sessions} iš ${f.planned}. Ne pagal planą.`,
    ],
    5: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} iš ${f.planned}. Nu nu. Kas tu toks ir ką padarei su mano klientu?`
          : `${f.sessions} iš ${f.planned}. Tikėjausi mažai, o tu vis tiek sugebėjai nuvilti.`,
    ],
  },
  comeback: {
    1: [
      (f) =>
        `O, grįžai, broli! ${days(f.daysOff)} — niekis. Šiandien lengvai, paskui įsivažiuosim.`,
    ],
    3: [(f) => `${days(f.daysOff)} pertraukos. Grįžai — pradėk lengvai.`],
    5: [
      (f) =>
        `${days(f.daysOff)}. Maniau, jau visam laikui persikraustei ant sofos. Pradėk lengvai — ego išgyvens, jis pratęs.`,
    ],
  },
  shortSleep: {
    1: [
      (f) =>
        `Miegojai tik ${f.hours} val. — šiandien neperspausk, broli, ir vakare anksčiau į lovą.`,
    ],
    3: [(f) => `${f.hours} val. miego. Šiandien lengviau.`],
    5: [(f) => `${f.hours} val. miego. Šiandien lengviau.`],
  },
  streak: {
    1: [(f) => `${days(f.days)} iš eilės! Tu degi, broli!`],
    3: [(f) => `${days(f.days)} iš eilės. Laikyk.`],
    5: [(f) => `${days(f.days)} iš eilės. Prie pagyrų nepriprask — jų nebus.`],
  },
  bodyweight: {
    1: [(f, x) => `Kūno svoris ${x.kg(f.kg)}, ${pct(f.deltaPct)} per ${f.days} d.`],
    3: [(f, x) => `Kūno svoris ${x.kg(f.kg)}, ${pct(f.deltaPct)} per ${f.days} d.`],
    5: [(f, x) => `Kūno svoris ${x.kg(f.kg)}, ${pct(f.deltaPct)} per ${f.days} d.`],
  },
  mom: {
    session: [
      (f) => `${sets(f.sets)}? Tavo mama daugiau nuveikia sekmadienį tarp dviejų skalbimų.`,
      () =>
        'Tavo mama nuo Maximos iki namų su pirkinių maišais daugiau pakelia nei tu per visą treniruotę.',
    ],
    stall: [
      (f, x) => `${x.exercise(f.exercise)}, ${x.kg(f.weight)}, vėl. Tavo mama su tiek apšyla.`,
    ],
    restShort: [
      (f, x) => `${x.mmss(f.restSec)} poilsio. Tavo mama ilgiau ilsisi tarp dviejų balso žinučių.`,
    ],
    skipped: [
      () => 'Tavo mama šiandien jau pasportavo. Šiaip sakau.',
      () => 'Tavo mama jau ir daržą ravėjo, ir cepelinų privirė. O tu dar net salėj nebuvai.',
    ],
    setDrop: [(f) => `${f.reps}? Tavo mama su tuščiu grifu padarė ${f.prevReps} ir nezyzė.`],
    week: [
      (f) =>
        `${sessions(f.sessions)}. Tavo mama per savaitę nuveikia daugiau. Ir dar tave pamaitina.`,
    ],
  },
};
