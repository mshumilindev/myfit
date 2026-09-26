/**
 * Atlas's phrase book — Polish, written as Polish (not translated).
 * Three tempers: 1 green — ziomek z siłki · 3 yellow — krótko i na temat ·
 * 5 red — jedzie po twoim wysiłku (nigdy po ciele).
 */
import type { PhraseBook } from '../atlas/voice';

const pct = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;

export const PL: PhraseBook = {
  intro: {
    1: [
      (f) =>
        f.sessions
          ? `Siema, mordo! Tu Atlas. Przejrzałem twoje ${f.sessions} treningi — od teraz jestem z tobą na każdym. Dawaj!`
          : 'Siema, ziomek! Tu Atlas. Wbij pierwszy trening, a od następnego jestem z tobą na każdym.',
    ],
    3: [
      (f) =>
        f.sessions
          ? `Atlas. Przeczytałem twoje ${f.sessions} treningi. Od teraz mówię, jak jest. Na każdym.`
          : 'Atlas. Pusto. Najpierw trening, potem gadamy.',
    ],
    5: [
      (f) =>
        f.sessions
          ? `Przeczytałem twoje ${f.sessions} treningi. Uśmiałem się. Od teraz będę na każdym — pożałujesz.`
          : 'Zero treningów. Odważna strategia. Wpisz cokolwiek, serio.',
    ],
  },
  session: {
    1: [
      (f) =>
        `No i elegancko! ${f.sets} serii w ${f.minutes} min — tak się to robi, byczku. Teraz szama i regeneracja.`,
      (f) => `Jest! ${f.sets} serii, ${f.minutes} minut. Kozak jesteś.`,
      (f) => `${f.sets} serii wpadło. Dobra robota, ziomuś!`,
    ],
    3: [
      (f) => `${f.sets} serii, ${f.minutes} min. Może być.`,
      (f) => `Zrobione. ${f.sets} serii. Nie ma co dodać.`,
      (f) => `${f.minutes} minut, ${f.sets} serii. Zaliczone. Tyle.`,
    ],
    5: [
      (f) => `${f.sets} serii. To miał być trening? Widziałem rozgrzewki z większymi ambicjami.`,
      (f) => `${f.minutes} minut… czegoś. Wpiszę jako trening. Z litości.`,
      (f) => `${f.sets} serii. Sztanga chyba nawet nie zauważyła, że ktoś ją podnosił.`,
      (f) => `Zapisane. ${f.sets} serii. Miejmy nadzieję, że nikt nie widział.`,
    ],
  },
  pr: {
    1: [
      (f, x) =>
        `JEEEST! ${x.exercise(f.exercise)} ${x.kg(f.weight)} × ${f.reps} — nowa życiówka! Bestia z ciebie!`,
      (f, x) =>
        `Mordo. ${x.exercise(f.exercise)}, ${x.kg(f.weight)} × ${f.reps}. Rekord! Aż mnie ciarki przeszły!`,
    ],
    3: [
      (f, x) => `${x.exercise(f.exercise)} ${x.kg(f.weight)}. Rekord. Powtórz, to uwierzę.`,
      (f, x) => `${x.kg(f.weight)} na ${x.exercise(f.exercise)}. Dobrze. Bez fajerwerków.`,
    ],
    5: [
      (f, x) =>
        `${x.exercise(f.exercise)}, ${x.kg(f.weight)} × ${f.reps}. „Rekord”. Po ${x.kg(f.prevWeight)} poprzeczka leżała na podłodze.`,
      (f, x) => `${x.exercise(f.exercise)} w końcu drgnęło. Już zacząłem pisać mowę pogrzebową.`,
      (f, x) => `${x.kg(f.weight)}. Bez oklasków — to powinno wejść miesiąc temu.`,
    ],
  },
  stall: {
    1: [
      (f, x) =>
        `${x.exercise(f.exercise)} stoi na ${x.kg(f.weight)} od ${f.sessions} treningów — spoko, mordo, każdy tak ma. Następnym razem dorzuć jedno powtórzenie i ruszy.`,
    ],
    3: [
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.kg(f.weight)}, ${f.sessions} razy z rzędu. Stoi. Dołóż powtórzenie.`,
    ],
    5: [
      (f, x) =>
        `${x.exercise(f.exercise)} na ${x.kg(f.weight)}, trening numer ${f.sessions}. Sztanga zna cię już na pamięć. Nudzi się.`,
      (f, x) => `${x.kg(f.weight)}. Znowu. To nie trening, to odsiadka.`,
      (f, x) =>
        `${f.sessions} treningów na tym samym ciężarze. Stabilność jest dobra w ZUS-ie, nie na ${x.exercise(f.exercise)}.`,
    ],
  },
  restShort: {
    1: [
      (f, x) =>
        `Ziomek, na ${x.exercise(f.exercise)} odpocząłeś tylko ${x.mmss(f.restSec)}. Weź pełne ${x.mmss(f.targetSec)} — ostatnie serie ci podziękują.`,
    ],
    3: [
      (f, x) => `Przerwa ${x.mmss(f.restSec)}. Miało być ${x.mmss(f.targetSec)}. Tyle w temacie.`,
    ],
    5: [
      (f, x) =>
        `${x.mmss(f.restSec)} przerwy. Spieszysz się gdzieś? Bo twoje progresy jakoś się nie spieszą.`,
      (f, x) =>
        `${x.mmss(f.targetSec)} to ${x.mmss(f.targetSec)}, a nie ${x.mmss(f.restSec)}. Liczyć umiesz? To co cię tłumaczy na sztandze?`,
    ],
  },
  setDrop: {
    1: [
      (f) =>
        `${f.prevReps} → ${f.reps} powtórzeń — luz, stary. Posiedź chwilę dłużej przed następną.`,
    ],
    3: [(f) => `${f.reps}? Poprzednio ${f.prevReps}. Odpoczywaj porządnie.`],
    5: [
      (f) => `${f.reps}. Po ${f.prevReps}. Uszło z ciebie szybciej niż z balonika po osiemnastce.`,
      (f) => `${f.reps} powtórzeń. Ławka pod tobą bardziej się napracowała.`,
    ],
  },
  skipped: {
    1: [
      (f) =>
        `${f.dayName ? `Ej, dziś ${f.dayName}` : 'Ej, dziś dzień treningowy'} — nawet szybki trening się liczy. Wchodzisz w to?`,
    ],
    3: [(f) => `${f.dayName ?? 'Trening'}. Dziś. Wiesz, gdzie jest siłka.`],
    5: [
      (f) =>
        `${f.dayName ?? 'Trening'} dziś, a ciebie nie ma. Kanapa pewnie wniebowzięta. Przynajmniej ktoś się cieszy.`,
      () => 'Dalej nie na siłce? Spoko, hantle przywykły, że się je ghostuje.',
    ],
  },
  imbalance: {
    1: [
      (f, x) =>
        `Stary, ${x.muscle(f.high)} dostało ${f.highSets} serii, a ${x.muscle(f.low)} tylko ${f.lowSets}. Następnym razem trochę miłości dla ${x.muscle(f.low)}!`,
    ],
    3: [
      (f, x) =>
        `${x.muscle(f.high)}: ${f.highSets} serii. ${x.muscle(f.low)}: ${f.lowSets}. Popraw to.`,
    ],
    5: [
      (f, x) =>
        `${x.muscle(f.high)} ${f.highSets}, ${x.muscle(f.low)} ${f.lowSets}. Robisz tylko to, co przyjemne? Bardzo dojrzale.`,
    ],
  },
  week: {
    1: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} z ${f.planned} — tydzień zamknięty z przytupem! Legenda!`
          : `${f.sessions} z ${f.planned} w tym tygodniu. Luz, każdy się liczył — w przyszłym tygodniu jedziemy dalej!`,
    ],
    3: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} z ${f.planned}. Zgodnie z planem.`
          : `${f.sessions} z ${f.planned}. Poniżej planu.`,
    ],
    5: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} z ${f.planned}. No proszę. Kim jesteś i co zrobiłeś z moim podopiecznym?`
          : `${f.sessions} z ${f.planned}. Niczego się nie spodziewałem, a i tak dałeś mniej.`,
    ],
  },
  comeback: {
    1: [(f) => `Ooo, wróciłeś, mordo! ${f.daysOff} dni to nic. Dziś spokojnie, rozkręcimy się.`],
    3: [(f) => `${f.daysOff} dni przerwy. Wróciłeś — zacznij lekko.`],
    5: [
      (f) =>
        `${f.daysOff} dni. Myślałem, że zameldowałeś się na kanapie na stałe. Zacznij lekko — duma przeżyje, jest przyzwyczajona.`,
    ],
  },
  shortSleep: {
    1: [(f) => `Tylko ${f.hours} h snu — dziś na spokojnie, ziomek, i wieczorem szybciej do wyra.`],
    3: [(f) => `${f.hours} h snu. Dziś lżej.`],
    5: [(f) => `${f.hours} h snu. Dziś lżej.`],
  },
  streak: {
    1: [(f) => `${f.days} dni z rzędu! Jesteś w gazie, mordo!`],
    3: [(f) => `${f.days} dni z rzędu. Trzymaj.`],
    5: [(f) => `${f.days} dni z rzędu. Nie przyzwyczajaj się do pochwał — więcej nie będzie.`],
  },
  bodyweight: {
    1: [(f, x) => `Masa ciała ${x.kg(f.kg)}, ${pct(f.deltaPct)} w ${f.days} dni.`],
    3: [(f, x) => `Masa ciała ${x.kg(f.kg)}, ${pct(f.deltaPct)} w ${f.days} dni.`],
    5: [(f, x) => `Masa ciała ${x.kg(f.kg)}, ${pct(f.deltaPct)} w ${f.days} dni.`],
  },
  mom: {
    session: [
      (f) => `${f.sets} serii. Twoja stara robi więcej w niedzielę między jednym praniem a drugim.`,
      (f) => `${f.minutes} minut? Twoja stara dłużej wybiera pomidory na bazarku.`,
    ],
    stall: [
      (f, x) =>
        `${x.exercise(f.exercise)}, ${x.kg(f.weight)}, znowu. Twoja stara się tym rozgrzewa.`,
    ],
    restShort: [
      (f, x) => `${x.mmss(f.restSec)} przerwy. Twoja stara dłużej nagrywa jedną głosówkę.`,
    ],
    skipped: [() => 'Twoja stara już dziś trenowała. Tak tylko mówię.'],
    setDrop: [
      (f) => `${f.reps}? Twoja stara zrobiła ${f.prevReps} na pustym gryfie i nie marudziła.`,
    ],
    week: [
      (f) =>
        `${f.sessions} treningów. Twoja stara w tydzień ogarnia więcej. I jeszcze ci obiad gotuje.`,
    ],
  },
};
