/**
 * Atlas frazės — lietuviškai, rašyta lietuviškai (ne vertimas iš anglų).
 * Trys charakteriai: 1 Šiltas — savas bro · 3 Tiesus — trumpai ir sausai ·
 * 5 Negailestingas — šaiposi iš tinginystės (bet niekada iš kūno).
 */
import type { PhraseBook } from '../atlas/voice';
import * as N from '../atlas/num';

const pct = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;

/** A span as a person says it ("3 weeks"), and the same opening a sentence. */
const sp = (d: number) => N.spanDays('lt', d);
const Sp = (d: number) => N.cap(sp(d));

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

export const LT: PhraseBook = {
  intro: {
    1: [
      (f) =>
        f.sessions
          ? `Labas, broli! Aš Atlas. Permečiau tavo istoriją — ${sessions(f.sessions)}. Nuo dabar esu šalia kiekvienoje. Varom!`
          : 'Labas, broli! Aš Atlas. Įrašyk pirmą treniruotę — ir toliau jau varom kartu.',
      (f) =>
        f.sessions
          ? `Ei, bičiuli, čia Atlas! ${sessions(f.sessions)} — nerealu, matau, kad čia rimtai. Nuo šiandien einam kartu.`
          : 'Ei, bičiuli, čia Atlas! Pradedam nuo nulio — visi taip pradėjo. Įrašyk pirmą ir varom.',
      (f) =>
        f.sessions
          ? `Sveikas, čempione! Aš Atlas, tavo naujas sparingo partneris. Istorijoje ${sessions(f.sessions)} — šaunus startas, ant jo ir statom.`
          : 'Sveikas, čempione! Aš Atlas, tavo naujas sparingo partneris. Pradedam nuo švaraus lapo — pirma treniruotė bus legendinė.',
      (f) =>
        f.sessions
          ? `Aš Atlas, broli. Perskaičiau viską — ${sessions(f.sessions)}, šaunuolis! Esu šalia, kai tik prireiks paspirties.`
          : 'Aš Atlas, broli. Kol kas tuščia, bet tai tik pradžia. Kai būsi pasiruošęs — įrašyk ir varom.',
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
      (f, x) =>
        `Žvėrie! ${x.exercise(f.exercise)}: ${x.kg(f.weight)} × ${f.reps} — buvo ${x.kg(f.prevWeight)}, o dabar štai kas. Nerealu, šaunuolis!`,
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
      (f, x) =>
        `Ei, bičiuli, ${x.exercise(f.exercise)} ties ${x.kg(f.weight)} stovi jau ${sessions(f.sessions)}. Normalu, platoai ateina visiems. Pakeisk serijų schemą ar pailsėk dieną ilgiau — ir vėl pajudės.`,
      (f, x) =>
        `${x.exercise(f.exercise)}, ${x.kg(f.weight)} — tas pats jau ${sessions(f.sessions)}. Neliūdėk, broli, tai laikina. Įpiltas pakartojimas ar du, ir pralauši.`,
      (f, x) =>
        `Platoas pratime ${x.exercise(f.exercise)}, ${x.kg(f.weight)} — pas visus būna, čempione. Nuimk šiek tiek ant grifo, padaryk gražiai ir sugrįžk stipresnis.`,
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
      (f, x) =>
        `Ei, ${x.exercise(f.exercise)}: ilsėjaisi ${x.mmss(f.restSec)}, o tikslas buvo ${x.mmss(f.targetSec)}. Nieko tokio, broli, duok sau kiek daugiau kvėpuoti — serijos bus tvirtesnės.`,
      (f, x) =>
        `Žinau, nori greičiau, bet ${x.mmss(f.restSec)} gali būti per mažai. Paimk ${x.mmss(f.targetSec)}, bičiuli, ir grifas lengviau eis. Varom!`,
      (f, x) =>
        `Čempione, ${x.exercise(f.exercise)} — pailsėk ${x.mmss(f.targetSec)}, o ne ${x.mmss(f.restSec)}. Niekur nebėgam, treniruotė mūsų.`,
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
      (f) =>
        `${f.prevReps} → ${f.reps}? Nieko, broli, pavargsta visi. Atsipūsk ir kita serija bus tavo.`,
      (f) =>
        `Ei, ${f.reps} vietoj ${f.prevReps} — tai tik viena serija, bičiuli. Dar ilgas kelias, žvėrie, nenuleisk rankų.`,
      () =>
        'Serija nepasisekė, bet tu vis tiek čia. Atsigerk vandens, pailsėk ir parodyk kitai, kas čia šeimininkas!',
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
      (f) =>
        `Ei, bičiuli! ${f.dayName ? `Šiandien pagal planą — ${f.dayName}` : 'Šiandien treniruotės diena'}. Net dvidešimt minučių yra daugiau nei nieko — gal užsukam?`,
      () =>
        'Broli, salė laukia! Jei šiandien sunkiau, daryk lengvą versiją — svarbiausia pasirodyti. Aš čia, jei ką.',
      (f) =>
        `Ei, čempione${f.dayName ? `, ${f.dayName} laukia` : ', treniruotė laukia'}. Tik pradėk, o toliau įsivažiuosi pats. Varom?`,
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
        `Broli, per savaitę ${x.muscle(f.high)}: ${sets(f.highSets)}, o ${x.muscle(f.low)}: tik ${f.lowSets}. Kitą kartą parodyk daugiau meilės ir šitiems!`,
      (f, x) =>
        `Ei, bičiuli, pastebėjau: ${x.muscle(f.high)} gavo ${sets(f.highSets)}, o ${x.muscle(f.low)} — tik ${f.lowSets}. Šią savaitę parodykim meilės ir antrai pusei, ok?`,
      (f, x) =>
        `Varom subalansuoti! ${x.muscle(f.high)} — ${f.highSets}, ${x.muscle(f.low)} — ${f.lowSets}. Kitą treniruotę pridėk porą serijų ten, kur trūksta, broli.`,
      (f, x) =>
        `${x.muscle(f.high)}: ${sets(f.highSets)} — puiku! O ${x.muscle(f.low)}: ${f.lowSets}. Truputis balanso ir bus tobulai, broli.`,
    ],
    3: [
      (f, x) =>
        `Paskutinės 7 dienos — ${x.muscle(f.high)}: ${sets(f.highSets)}. ${x.muscle(f.low)}: ${f.lowSets}. Sutvarkyk.`,
    ],
    5: [
      (f, x) =>
        `Paskutinės 7 dienos: ${x.muscle(f.high)} — ${f.highSets}, ${x.muscle(f.low)} — ${f.lowSets}. Treniruoji tik tai, kas smagu? Labai suaugusiai.`,
    ],
  },
  week: {
    1: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} iš ${f.planned} — savaitė sutriuškinta! Legenda!`
          : `${f.sessions} iš ${f.planned} šią savaitę. Ramiai, kiekviena skaitosi — kitą savaitę varom iš naujo!`,
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} iš ${f.planned} — nerealu, čempione! Pasidžiauk savimi ir pailsėk kaip reikia.`
          : `${f.sessions} iš ${f.planned}. Sunki savaitė, broli, būna. Svarbu, kad vis tiek padarei — kitą pakelsim kartelę!`,
      (f) =>
        f.sessions >= f.planned
          ? `Žvėrie! ${f.sessions} iš ${f.planned} — planas įvykdytas. Tu tikrai čia rimtai.`
          : `${f.sessions} iš ${f.planned} — ne visai, bet tai ne tragedija, bičiuli. Pažiūrėkim, kas sutrukdė, ir kitą savaitę sutvarkom.`,
      (f) =>
        f.sessions >= f.planned
          ? `Varom, ${f.sessions} iš ${f.planned}! Taip ir auga rezultatai — savaitė po savaitės.`
          : `${f.sessions} iš ${f.planned}. Nenusimink, broli — ir tiek yra daugiau nei nieko. Kita savaitė bus tavo!`,
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
        `O, grįžai, broli! ${Sp(f.daysOff)} be treniruočių — niekis. Šiandien lengvai, paskui įsivažiuosim.`,
      (f) =>
        `Sveikas sugrįžęs, čempione! ${Sp(f.daysOff)} be salės — nieko tokio. Šiandien lengvai, apšilimas ir varom.`,
      (f) =>
        `Ei, broli, tavęs jau pasiilgau! ${Sp(f.daysOff)} pertraukos — normalu, visiems būna. Pradėk ramiai, įsivažiuosim greitai.`,
      (f) =>
        `Nerealu, kad grįžai, bičiuli. ${Sp(f.daysOff)} be treniruočių nieko nereiškia — svarbiausia, kad vėl čia.`,
    ],
    3: [(f) => `${Sp(f.daysOff)} be treniruočių. Grįžai — pradėk lengvai.`],
    5: [
      (f) =>
        `${Sp(f.daysOff)} be treniruočių. Maniau, jau visam laikui persikraustei ant sofos. Pradėk lengvai — ego išgyvens, jis pratęs.`,
    ],
  },
  shortSleep: {
    1: [
      (f) =>
        `Miegojai tik ${f.hours} val. — šiandien neperspausk, broli, ir vakare anksčiau į lovą.`,
      (f) =>
        `Ei, broli, tik ${f.hours} val. miego — šiandien nesistenk viršyti savęs. Lengvesnė treniruotė irgi skaitosi, o vakare anksti į lovą.`,
      (f) =>
        `${f.hours} val. miego — tai nedaug, bičiuli. Klausyk savęs šiandien, o jei pavargęs — pailsėk, salė niekur nedings.`,
      (f) =>
        `Čempione, miegojai ${f.hours} val. Šiandien lengvai ir be ambicijų, o vakare gerai išsimiegok. Rytoj vėl varom!`,
    ],
    3: [(f) => `${f.hours} val. miego. Šiandien lengviau.`],
    5: [(f) => `${f.hours} val. miego. Šiandien lengviau.`],
  },
  streak: {
    1: [
      (f) => `${Sp(f.days)} iš eilės! Tu degi, broli!`,
      (f) => `${Sp(f.days)} iš eilės! Nerealu, žvėrie — taip ir toliau!`,
      (f) =>
        `${Sp(f.days)} iš eilės — tu tikra mašina, bičiuli! Neleisk sau sustoti, bet ir pailsėti nepamiršk.`,
      (f) =>
        `Ei, ${sp(f.days)} be pertraukos! Čia jau ne atsitiktinumas, čempione — čia įprotis. Didžiuojuosi!`,
    ],
    3: [(f) => `${Sp(f.days)} iš eilės. Laikyk.`],
    5: [(f) => `${Sp(f.days)} iš eilės. Prie pagyrų nepriprask — jų nebus.`],
  },
  bodyweight: {
    1: [
      (f, x) => `Kūno svoris ${x.kg(f.kg)}, ${pct(f.deltaPct)} per ${sp(f.days)}.`,
      (f, x) =>
        `Užfiksavau: ${x.kg(f.kg)}, ${pct(f.deltaPct)} per ${sp(f.days)}. Skaičius kaip skaičius, bičiuli — svarbiausia, kad ateini į salę.`,
      (f, x) =>
        `Svarstyklės parodė ${x.kg(f.kg)} (${pct(f.deltaPct)} per ${sp(f.days)}). Tik duomenys, broli, jokių vertinimų.`,
      (f, x) =>
        `Kūno svoris ${x.kg(f.kg)}, ${pct(f.deltaPct)} per ${sp(f.days)}. Įrašyta, čempione — toliau darom savo.`,
    ],
    3: [(f, x) => `Kūno svoris ${x.kg(f.kg)}, ${pct(f.deltaPct)} per ${sp(f.days)}.`],
    5: [(f, x) => `Kūno svoris ${x.kg(f.kg)}, ${pct(f.deltaPct)} per ${sp(f.days)}.`],
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

  // SPO-124: real swearing, effort only (never body/health/slurs); needs native review
  swear: {
    intro: [
      (f) =>
        f.sessions
          ? `Atlas. Pažiūrėjau istoriją: ${sessions(f.sessions)} — nu bliamba, ne šūdas, bet ir ne kažkas. Dabar žiūrėsiu į kiekvieną tavo seriją, tai nesišvaistyk.`
          : 'Atlas. Nulis treniruočių, kurva. Įrašyk bent vieną, tada pasikalbėsim.',
      (f) =>
        f.sessions
          ? `Ką čia turim — ${sessions(f.sessions)}. Pizdec, kokia drąsa vadintis sportuojančiu. Nieko, aš jau čia, nachui tinginystė.`
          : 'Nulis treniruočių. Pizdec, net pradėti bijai? Įrašyk pirmą, nachui.',
      (f) =>
        f.sessions
          ? `Atlas čia. Istorijoje ${sessions(f.sessions)}, velnias griebtų — pasiūlau negyventi tuščiai. Nuo šiol kiekviena treniruotė po mano padidinamuoju stiklu.`
          : 'Atlas čia. Istorijos nėra, velnias griebtų. Pirma treniruotė pati neįsirašys, šūdas.',
      (f) =>
        f.sessions
          ? `Sveikas. Istorijoje ${sessions(f.sessions)}, jobanas. Laikas dirbti rimtai — aš čia ne glostyti, o varyti.`
          : 'Sveikas. Įrašų nulis, jobanas. Pradėk, o tada gausi iš manęs ir gero, ir blogo.',
    ],
    session: [
      (f) =>
        `${sets(f.sets)} per ${f.minutes} min. Bybis, pavadinai tai treniruote? Suoliukas net nespėjo sušilti.`,
      (f) =>
        `${f.minutes} min. salėj ir ${sets(f.sets)} — šūdas, o ne treniruotė. Bet nors atėjai, tai užskaitau.`,
      (f) =>
        `Pizdec, ${sets(f.sets)}. Su tokiu tempu grifas tave prisimins kaip kaimyną — veidą žino, vardo ne.`,
      (f) => `${sets(f.sets)}, kurva. Velnias su tavim, įrašyta — bet kitą kartą bent pasistenk.`,
    ],
    stall: [
      (f, x) =>
        `${x.exercise(f.exercise)}, ${x.kg(f.weight)} jau ${sessions(f.sessions)} — kurva, tu ten šaknis leidi? Pajudėk.`,
      (f, x) =>
        `Bybis, tas pats ${x.kg(f.weight)} ir ${x.exercise(f.exercise)} — net šūdas po tiek laiko pasikeistų. Pridėk ką nors.`,
      (f, x) =>
        `${x.exercise(f.exercise)}, ${sessions(f.sessions)} be jokio progreso. Pizdec. Ką ten tarp serijų veiki — telefone slankioji?`,
      (f, x) =>
        `Nu jobanas: ${x.kg(f.weight)} ir vėl ${x.exercise(f.exercise)}. Laikas bėga, o kartelė kaip prirūdijusi. Pridėk pakartojimą, bliamba.`,
    ],
    restShort: [
      (f, x) =>
        `Kur lekia, kurva? ${x.mmss(f.restSec)} vietoj ${x.mmss(f.targetSec)}. Pailsėk kaip žmogus, ne kaip pabėgęs iš salės.`,
      (f, x) =>
        `${x.mmss(f.restSec)}, bybis. Tikslas ${x.mmss(f.targetSec)}, o ne tavo nekantrumas. Atsisėsk ir palauk, šūdas.`,
      (f, x) =>
        `Pizdec, ${x.mmss(f.restSec)} poilsio. Serija bus prasta, o kaltas bus grifas? Duok sau ${x.mmss(f.targetSec)}.`,
      (f, x) =>
        `Velnias, ${x.mmss(f.restSec)} vietoj ${x.mmss(f.targetSec)}. Tau salėj gaisras ar kaip? Ramiau, jobanas.`,
    ],
    setDrop: [
      (f) => `Nuo ${f.prevReps} iki ${f.reps}? Kurva, kas čia nutiko — atidavei per anksti.`,
      (f) =>
        `Pizdec, ${reps(f.reps)} po ${f.prevReps}. Kur dingo užsispyrimas — rūbinėje su telefonu pasiliko?`,
      (f) =>
        `Bybis, ${f.reps} vietoj ${f.prevReps}. Pasidavei dar neįpusėjęs — velnias, tai ne varžybos su sofa.`,
      (f) =>
        `Šūdas, o ne serija: ${f.prevReps} → ${f.reps}. Pailsėk kaip reikia ir daryk iš naujo, nachui.`,
    ],
    skipped: [
      (f) =>
        `${f.dayName ? `Pagal planą — ${f.dayName}` : 'Šiandien treniruotė'}, o tavęs nėra, kurva. Pasiteisinimas jau paruoštas, ar dar kuri?`,
      () => 'Bybis, vėl salė be tavęs. Pasiteisinimų kalnas auga, o grifas dulka.',
      () => 'Pizdec, kiek galima? Kas šįkart: darbas, šaltis, „pavargau“? Atsistok ir eik, šūdas.',
      () => 'Jobanas, ir vėl neateini. Hanteliai jau pamiršo, kad tu egzistuoji.',
    ],
    imbalance: [
      (f, x) =>
        `${x.muscle(f.high)} — ${f.highSets}, ${x.muscle(f.low)} — ${f.lowSets}. Kurva, treniruoji tik tai, kas patinka? Likusi dalis irgi nori darbo.`,
      (f, x) =>
        `Pizdec, ${x.muscle(f.high)}: ${f.highSets}, o ${x.muscle(f.low)}: tik ${f.lowSets}. Jobanas, pamiršai, kad yra ir kita treniruotės pusė?`,
      (f, x) =>
        `Bliamba, ${x.muscle(f.low)}: ${f.lowSets}, o ${x.muscle(f.high)}: ${f.highSets}. Lengvą darbą renkiesi ir pats tai žinai, šūdas.`,
      (f, x) =>
        `Bybis: ${x.muscle(f.high)} — ${f.highSets}, ${x.muscle(f.low)} — ${f.lowSets}. Mėgstamas serijas darai, nemėgstamas aplenki. Velnias tokį planą.`,
    ],
    week: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} iš ${f.planned}. Kurva, pagaliau padarei tai, ką žadėjai. Nepergyvenk, nachui — dar neapsipratom.`
          : `${f.sessions} iš ${f.planned}. Šūdas, o ne savaitė. Planas buvo plane, o tu — ant sofos.`,
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} iš ${f.planned}. Bybis, sugebi, kai nori. Kodėl taip nedaryti kiekvieną savaitę, jobanas?`
          : `${f.sessions} iš ${f.planned}, bybis. Žadėti moki puikiai, vykdyti — nė velnio.`,
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} iš ${f.planned} — pizdec, tikrai tu? Gerai, užskaitau, bet nepradėk šokinėti.`
          : `Pizdec: ${f.sessions} iš ${f.planned}. Kas trukdė — kalendorius ar tingėjimas? Atsakymą žinom abu, nachui.`,
    ],
    pr: [
      (f, x) =>
        `Bliamba, ${x.kg(f.weight)} × ${f.reps} — ${x.exercise(f.exercise)}. Nesitikėjau. Gerai, gerai, šaunuolis — dabar nustok švytėti, dar ne olimpiada.`,
      (f, x) =>
        `${x.exercise(f.exercise)}, ${x.kg(f.weight)}, prieš tai buvo ${x.kg(f.prevWeight)}. Pizdec, ką čia padarei — pirmą kartą nenoriu tavęs plūsti. Šūdas, kaip sunku girti.`,
      (f, x) =>
        `Nachui, ${x.kg(f.weight)} — ${x.exercise(f.exercise)}! Aš tau nieko nesakiau, bet viduje kurva kaip džiaugiuosi.`,
      (f, x) =>
        `Bybis, naujas rekordas: ${x.exercise(f.exercise)}, ${x.kg(f.weight)} × ${f.reps}. Parodei grifui, kas čia šeimininkas. Dabar pakartok, o ne pamiršk kaip visada.`,
    ],
  },
};
