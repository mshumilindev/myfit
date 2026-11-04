/**
 * Atlas's phrase book — Polish, written as Polish (not translated).
 * Three tempers: 1 green — ziomek z siłki · 3 yellow — krótko i na temat ·
 * 5 red — jedzie po twoim wysiłku (nigdy po ciele).
 */
import type { PhraseBook } from '../atlas/voice';
import * as N from '../atlas/num';

const pct = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;

/** A span as a person says it ("3 weeks"), and the same opening a sentence. */
const sp = (d: number) => N.spanDays('pl', d);
const Sp = (d: number) => N.cap(sp(d));

/** Polish plural: 1 → one, 2–4 (not 12–14) → few, else many. */
const plForm = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;
const plSets = (n: number) => `${n} ${plForm(n, 'seria', 'serie', 'serii')}`;
const plSessions = (n: number) => `${n} ${plForm(n, 'trening', 'treningi', 'treningów')}`;

export const PL: PhraseBook = {
  intro: {
    1: [
      (f) =>
        f.sessions
          ? `Siema, mordo! Tu Atlas. Przejrzałem twoje ${f.sessions} treningi — od teraz jestem z tobą na każdym. Dawaj!`
          : 'Siema, ziomek! Tu Atlas. Wbij pierwszy trening, a od następnego jestem z tobą na każdym.',
      (f) =>
        f.sessions
          ? `Cześć, bracie! Atlas melduje się na pokładzie. ${f.sessions} treningów w historii — git robota. Lecimy dalej!`
          : 'Cześć, bracie! Atlas melduje się na pokładzie. Wbij pierwszy trening, a rozkręcimy to razem.',
      (f) =>
        f.sessions
          ? `Yo, mistrzu! Tu Atlas, twój kumpel od siłki. ${f.sessions} treningów za tobą — solidna baza, sztos!`
          : 'Yo, mistrzu! Tu Atlas, twój kumpel od siłki. Pierwszy trening i jedziemy razem.',
      (f) =>
        f.sessions
          ? `Elo, ziom! Atlas na linii. Przejrzałem ${f.sessions} treningów — petarda, dociskamy dalej!`
          : 'Elo, ziom! Atlas na linii. Jak tylko wpiszesz pierwszy trening, będę kibicował na każdym.',
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
      (f) =>
        `Petarda, bracie! ${f.sets} serii w ${f.minutes} min — dociskałeś jak trzeba. Odpocznij, zasłużyłeś.`,
      (f) => `Git robota, mistrzu — ${f.minutes} minut i ${f.sets} serii. Lecimy tak dalej!`,
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
      (f, x) =>
        `Sztos, ziom! ${x.exercise(f.exercise)} ${x.kg(f.weight)} × ${f.reps} — z ${x.kg(f.prevWeight)} na tyle, to się nazywa progres. Git!`,
      (f, x) =>
        `Bracie, ${x.exercise(f.exercise)} ${x.kg(f.weight)}! Nowy rekord, petarda. Dociskaj tak dalej!`,
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
      (f, x) =>
        `${x.exercise(f.exercise)} siedzi na ${x.kg(f.weight)} od ${f.sessions} treningów — normalka, ziom. Dołóż jedno powtórzenie i ruszy.`,
      (f, x) =>
        `Spokojnie, mistrzu, ${x.exercise(f.exercise)} na ${x.kg(f.weight)} to teraz twój punkt wyjścia. ${f.sessions} treningów solidnej roboty — jeszcze trochę i pęknie.`,
      (f, x) =>
        `Bracie, ${x.kg(f.weight)} na ${x.exercise(f.exercise)} przez ${f.sessions} treningów — płaskowyż to część drogi. Dorzuć powtórzenie i lecimy dalej!`,
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
      (f, x) =>
        `Ej, ziom, na ${x.exercise(f.exercise)} wyszło ${x.mmss(f.restSec)} przerwy. Daj sobie ${x.mmss(f.targetSec)}, a serie będą mocniejsze.`,
      (f, x) =>
        `Mistrzu, wiem, że chce się lecieć, ale ${x.mmss(f.targetSec)} przerwy da ci więcej siły. Teraz było ${x.mmss(f.restSec)} — luz, następnym razem poczekaj.`,
      (f, x) =>
        `Stary, ${x.mmss(f.restSec)} to trochę krótko. Złap oddech do ${x.mmss(f.targetSec)} i dociśniesz lepiej.`,
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
      (f) =>
        `${f.prevReps} → ${f.reps}, normalka, bracie. Zdarza się. Dłuższa przerwa i dociskasz dalej.`,
      (f) =>
        `Ziom, spadek z ${f.prevReps} na ${f.reps} to nic strasznego. Złap oddech, następna będzie lepsza.`,
      (f) =>
        `${f.reps} po ${f.prevReps} — spoko, mistrzu. Zmęczenie robi swoje. Trochę więcej odpoczynku i lecimy.`,
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
      (f) =>
        `Siema, ziom! ${f.dayName ? `Dziś ${f.dayName}` : 'Dziś dzień treningowy'} — jak masz chwilę, wpadnij choć na krótko. Każdy trening się liczy.`,
      () =>
        'Hej, bracie, dziś trening w planie. Dasz radę, to wbijamy nawet na 20 minut — git. Nie dasz, luz, bez spiny.',
      () => 'Mistrzu, siłka na ciebie czeka. Wpadnij, rozkręć się lekko i zobaczymy, jak pójdzie.',
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
        `Stary, w tym tygodniu ${x.muscle(f.high)} dostało ${f.highSets} serii, a ${x.muscle(f.low)} tylko ${f.lowSets}. Następnym razem trochę miłości dla ${x.muscle(f.low)}!`,
      (f, x) =>
        `Ziom, ${x.muscle(f.high)} dostało ${f.highSets} serii, a ${x.muscle(f.low)} tylko ${f.lowSets}. Dorzuć trochę miłości dla ${x.muscle(f.low)} następnym razem!`,
      (f, x) =>
        `Bracie, mały sygnał: ${x.muscle(f.high)} ${f.highSets} serii, ${x.muscle(f.low)} ${f.lowSets}. Wyrównaj na kolejnym treningu, będzie git.`,
      (f, x) =>
        `Mistrzu, w tym tygodniu ${x.muscle(f.high)} wymiata (${f.highSets} serii), a ${x.muscle(f.low)} dostało ${f.lowSets}. Dorzuć coś dla ${x.muscle(f.low)} na następny raz!`,
    ],
    3: [
      (f, x) =>
        `Ostatnie 7 dni — ${x.muscle(f.high)}: ${f.highSets} serii. ${x.muscle(f.low)}: ${f.lowSets}. Popraw to.`,
    ],
    5: [
      (f, x) =>
        `Ostatnie 7 dni: ${x.muscle(f.high)} ${f.highSets}, ${x.muscle(f.low)} ${f.lowSets}. Robisz tylko to, co przyjemne? Bardzo dojrzale.`,
    ],
  },
  week: {
    1: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} z ${f.planned} — tydzień zamknięty z przytupem! Legenda!`
          : `${f.sessions} z ${f.planned} w tym tygodniu. Luz, każdy się liczył — w przyszłym tygodniu jedziemy dalej!`,
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} z ${f.planned} — komplet, mistrzu! Petarda, tak trzymaj!`
          : `${f.sessions} z ${f.planned} — spoko, ziom. Liczy się, że wbijasz, w przyszłym tygodniu dorzucimy.`,
      (f) =>
        f.sessions >= f.planned
          ? `Sztos, bracie! ${f.sessions} z ${f.planned}. Tydzień zaliczony na medal.`
          : `${f.sessions} z ${f.planned}. Bywa, bracie — ważne, że jesteś w grze. Lecimy dalej!`,
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} z ${f.planned}! Ziom, to jest ta konsekwencja. Git!`
          : `${f.sessions} z ${f.planned} — luz, mistrzu. Nowy tydzień, nowe otwarcie, dociskamy.`,
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
    1: [
      (f) =>
        `Ooo, wróciłeś, mordo! ${Sp(f.daysOff)} przerwy to nic. Dziś spokojnie, rozkręcimy się.`,
      (f) =>
        `Witaj z powrotem, bracie! ${Sp(f.daysOff)} przerwy to nic — wchodzimy lekko i się rozkręcamy.`,
      (f) =>
        `Super, że wracasz, mistrzu! ${Sp(f.daysOff)} przerwy za nami — pierwszy trening na luzie.`,
      (f) =>
        `Elo, ${sp(f.daysOff)} przerwy i jesteś z powrotem — git! Zacznij lekko, forma wróci szybciej, niż myślisz.`,
    ],
    3: [(f) => `${Sp(f.daysOff)} przerwy. Wróciłeś — zacznij lekko.`],
    5: [
      (f) =>
        `${Sp(f.daysOff)} przerwy. Myślałem, że zameldowałeś się na kanapie na stałe. Zacznij lekko — duma przeżyje, jest przyzwyczajona.`,
    ],
  },
  shortSleep: {
    1: [
      (f) => `Tylko ${f.hours} h snu — dziś na spokojnie, ziomek, i wieczorem szybciej do wyra.`,
      (f) => `${f.hours} h snu to mało, ziom — dziś na lajcie, a wieczorem porządny sen.`,
      (f) =>
        `Mistrzu, ${f.hours} h snu — dziś tyle, ile czujesz. Wyśpij się wieczorem, jutro dociśniemy.`,
      (f) =>
        `Bracie, krótka noc (${f.hours} h). Lżejszy trening dziś, długi sen wieczorem — git plan.`,
    ],
    3: [(f) => `${f.hours} h snu. Dziś lżej.`],
    5: [(f) => `${f.hours} h snu. Dziś lżej.`],
  },
  streak: {
    1: [
      (f) => `${Sp(f.days)} z rzędu! Jesteś w gazie, mordo!`,
      (f) => `${Sp(f.days)} z rzędu, petarda, bracie!`,
      (f) => `Mistrzu, ${sp(f.days)} pod rząd — ale seria! Tak trzymaj!`,
      (f) => `Sztos, ziom! ${Sp(f.days)} z rzędu, lecisz jak burza.`,
    ],
    3: [(f) => `${Sp(f.days)} z rzędu. Trzymaj.`],
    5: [(f) => `${Sp(f.days)} z rzędu. Nie przyzwyczajaj się do pochwał — więcej nie będzie.`],
  },
  bodyweight: {
    1: [
      (f, x) => `Masa ciała ${x.kg(f.kg)}, ${pct(f.deltaPct)} przez ${sp(f.days)}.`,
      (f, x) => `Waga: ${x.kg(f.kg)}, ${pct(f.deltaPct)} przez ${sp(f.days)}. Zapisane, ziom.`,
      (f, x) =>
        `Masa ciała ${x.kg(f.kg)} (${pct(f.deltaPct)}, ${sp(f.days)}). Info do kolekcji, bracie — lecimy dalej.`,
      (f, x) => `Zanotowane, mistrzu: ${x.kg(f.kg)}, ${pct(f.deltaPct)} przez ${sp(f.days)}.`,
    ],
    3: [(f, x) => `Masa ciała ${x.kg(f.kg)}, ${pct(f.deltaPct)} przez ${sp(f.days)}.`],
    5: [(f, x) => `Masa ciała ${x.kg(f.kg)}, ${pct(f.deltaPct)} przez ${sp(f.days)}.`],
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
  // SPO-124: real swearing, effort only (never body/health/slurs); needs native review
  swear: {
    intro: [
      (f) =>
        f.sessions
          ? `Przejrzałem te ${plSessions(f.sessions)}. Kurwa, jest co poprawiać. Od teraz stoję ci nad głową.`
          : 'Zero treningów, kurwa. Nie ma nawet czego hejtować. Idź coś podnieść.',
      (f) =>
        f.sessions
          ? `Atlas. Czytam te twoje ${plSessions(f.sessions)} i chuj mi w oko, jeśli to wszystko, na co cię stać.`
          : 'Atlas. Pusto, kurwa, jak na siłowni o 3 w nocy. Wpisz pierwszy trening, bo nie mam z czego się nabijać.',
      (f) =>
        f.sessions
          ? `Jestem Atlas i będę cię pilnował. Nie będzie pierdolenia, że „dziś nie mam czasu”. ${plSessions(f.sessions)} to dopiero początek.`
          : 'Jestem Atlas i będę cię pilnował. Nie będzie pierdolenia, że „dziś nie mam czasu”. Zaczynaj.',
      (f) =>
        f.sessions
          ? `${plSessions(f.sessions)} w historii. Spierdalaj na kolejny, bo Atlas się tu nie nudzi dla zabawy.`
          : 'Spierdalaj na siłkę. Pierwszy trening sam się nie wpisze.',
    ],
    session: [
      (f) =>
        `${plSets(f.sets)} w ${f.minutes} min? To gówno, nie trening. Następnym razem proszę o wysiłek, nie o obecność.`,
      (f) =>
        `Kurwa mać, ${f.minutes} minut i ${plSets(f.sets)}. Pierdolenie się z telefonem też się wlicza do czasu, co?`,
      (f) => `${plSets(f.sets)}. Chujowa robota, ale chociaż się pojawiłeś. Nie licz na medal.`,
      (f) =>
        `Odfajkowane: ${plSets(f.sets)}. Z takim zaangażowaniem to ja bym nawet butelki nie podniósł, kurwa.`,
    ],
    pr: [
      (f, x) =>
        `${x.exercise(f.exercise)} ${x.kg(f.weight)} × ${f.reps}. Kurwa, no. Rekord. Nie powiem „brawo”, ale chuj, zapisane.`,
      (f, x) =>
        `${x.kg(f.weight)} na ${x.exercise(f.exercise)}, po ${x.kg(f.prevWeight)}? Jebany rekord. Zasłużyłeś, ale nie rób z tego święta.`,
      (f, x) =>
        `No kurwa mać, ${x.exercise(f.exercise)} ${x.kg(f.weight)} × ${f.reps}. Wkurwia mnie, że muszę cię pochwalić.`,
      (f, x) =>
        `Spierdoliłeś mi plan narzekania: ${x.exercise(f.exercise)}, ${x.kg(f.weight)} × ${f.reps}. Ten ciężar to skurwysyn, a ty go ogarnąłeś.`,
    ],
    stall: [
      (f, x) =>
        `${x.exercise(f.exercise)} ${x.kg(f.weight)} od ${plSessions(f.sessions)}. Kurwa, to już nie plateau, to wspólne mieszkanie.`,
      (f, x) =>
        `Ile można, kurwa? ${x.kg(f.weight)} na ${x.exercise(f.exercise)}, ${f.sessions} razy. Dołóż coś albo przestań udawać, że masz plan.`,
      (f, x) =>
        `Pierdolisz o progresie, a ${x.exercise(f.exercise)} stoi na ${x.kg(f.weight)} od ${plSessions(f.sessions)}. Liczby nie kłamią.`,
      (f, x) =>
        `${x.kg(f.weight)}, ${plSessions(f.sessions)}, zero ruchu. To nie trening, tylko jebany kierat. Dołóż powtórzenie, na litość.`,
    ],
    restShort: [
      (f, x) =>
        `${x.mmss(f.restSec)} przerwy? Dokąd ci się, kurwa, tak spieszy? Miało być ${x.mmss(f.targetSec)}.`,
      (f, x) =>
        `Na ${x.exercise(f.exercise)} bierze się ${x.mmss(f.targetSec)}, a ty dałeś ${x.mmss(f.restSec)}. Pierdolone skracanie drogi, a potem zdziwienie, że seria leży.`,
      (f, x) =>
        `${x.mmss(f.restSec)}. Serio? Odpocznij normalnie, kurwa, ${x.mmss(f.targetSec)}, a nie odwalaj chujową robotę w pośpiechu.`,
      (f, x) =>
        `Spierdalasz z przerwy po ${x.mmss(f.restSec)}, jakby ktoś ci za to płacił. Wolniej: ${x.mmss(f.targetSec)}.`,
    ],
    setDrop: [
      (f) =>
        `${f.prevReps} → ${f.reps}. Co to kurwa było? Pierwsza seria na bogato, druga na pół gwizdka.`,
      (f) => `Z ${f.prevReps} na ${f.reps}. Ktoś tu odpuścił, kurwa, i to nie sztanga.`,
      (f) =>
        `${f.reps}? Jebać takie serie. Po ${f.prevReps} oczekuję czegoś więcej niż zmęczonego machnięcia ręką.`,
      (f) =>
        `Raz ${f.prevReps}, raz ${f.reps}. To gówno, nie dociskanie. Odpocznij porządnie i napraw to.`,
    ],
    skipped: [
      (f) =>
        `${f.dayName ?? 'Trening'} dziś, a ciebie nie ma. Kurwa, wymówka już się chyba sama pisze.`,
      (f) =>
        `Znowu pierdolisz, że „jutro”? ${f.dayName ? `Dziś ${f.dayName}` : 'Dziś dzień treningowy'}. Rusz się.`,
      () => 'Gdzie ty jesteś, kurwa? Siłownia czeka, hantle się nudzą, a ty gdzieś w chuju.',
      () => 'Spierdalaj z tej kanapy. Nikt za ciebie tego nie podniesie.',
    ],
    imbalance: [
      (f, x) =>
        `${x.muscle(f.high)} ${plSets(f.highSets)}, ${x.muscle(f.low)} ${f.lowSets}. Kurwa, trenujesz tylko to, co lubisz. Jebane lenistwo wybiórcze.`,
      (f, x) =>
        `${x.muscle(f.high)}: ${plSets(f.highSets)}. ${x.muscle(f.low)}: ${f.lowSets}. Wygodnictwo na pełnej, kurwa. Rusz to, czego unikasz.`,
      (f, x) =>
        `${x.muscle(f.low)} ${plSets(f.lowSets)}, ${x.muscle(f.high)} ${f.highSets}. Chujowo to rozdzieliłeś. Nie omijaj tego, na co ci się nie chce.`,
      (f, x) =>
        `Gówno, nie plan: ${x.muscle(f.high)} ${plSets(f.highSets)}, ${x.muscle(f.low)} tylko ${f.lowSets}. Zrób następnym razem to, na co nie masz ochoty.`,
    ],
    week: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} z ${f.planned}. Kurwa, no — plan zrobiony. Nie mów nikomu, że ci kiedyś naskoczyłem.`
          : `${f.sessions} z ${f.planned}. Chujowy tydzień. Plan był prosty, a ty i tak znalazłeś sposób, żeby go nie zrobić.`,
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} z ${f.planned}. Kurwa, nie ma się do czego przypierdolić. Wkurwiające.`
          : `${f.sessions} z ${f.planned}. Pierdolenie o „nie miałem czasu” zostaw na wieczór — liczby i tak mówią swoje.`,
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} z ${f.planned}. Chuj, zasłużyłeś. Dobra robota, ale nie rozpędzaj się.`
          : `${f.sessions} z ${f.planned}. Jebany tydzień na pół gwizdka. Następny ma być pełny, bez gadki.`,
      (f) =>
        f.sessions >= f.planned
          ? `Komplet: ${f.sessions} z ${f.planned}. Jestem zły, bo nie mam jak cię dziś opierdolić.`
          : `${f.sessions} z ${f.planned}. Co ty robiłeś, kurwa, przez resztę tygodnia? Bo na siłce cię nie było.`,
    ],
  },
};
