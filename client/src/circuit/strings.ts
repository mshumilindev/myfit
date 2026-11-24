import type { LocaleId } from '../i18n';

/** Words of the circuit screens. Circuit's own words live in its chunk, not in the core i18n (add-on boundary). */
export interface CircuitStrings {
  circuitLabel: string;
  circuitHint: string;
  circuitSettingDesc: string;
  circuitAdding: string;
  circuitSoFar: (n: number) => string;
  circuitFinishSet: string;
  circuitNewCircuit: (l: string) => string;
  esCircuitSub: string;
  esCircuitStart: string;
  circuitAddAnother: string;
  circuitAddRound: string;
  circuitAllLogged: (n: number) => string;
  circuitBuilding: string;
  circuitCompleteRound: string;
  circuitContinueCircuit: string;
  circuitContinueRound: (n: number) => string;
  circuitDoneStart: (l: string) => string;
  circuitExerciseOf: (a: number, b: number) => string;
  circuitFinishAll: string;
  circuitLogRound: (slot: string, n: number) => string;
  circuitNext: string;
  circuitNoLoad: string;
  circuitRecorded: string;
  circuitRest: string;
  circuitRoundComplete: (n: number) => string;
  circuitRoundCompleteBody: string;
  circuitRoundGoal: string;
  circuitRoundOf: (a: number, b: number) => string;
  circuitRounds: string;
  circuitRoundsOpen: string;
  circuitRoundsShort: string;
  circuitStart: string;
  circuitStartRound: (n: number) => string;
  circuitStatusDone: string;
  circuitSwipeHint: string;
  circuitWhatYouDid: string;
}

const en: CircuitStrings = {
  circuitLabel: 'Circuit',
  esCircuitSub: 'Exercises back to back, in rounds',
  esCircuitStart: 'Start',
  circuitAdding: 'Adding to Circuit',
  circuitSoFar: (n: number) => `${n} so far · next add joins the loop`,
  circuitFinishSet: 'Finish set',
  circuitHint: 'Exercises you add next join one round-based circuit — like a crossfit block.',
  circuitSettingDesc:
    "Run any number of exercises in rounds. Turn it off to go back to normal exercises — it's not a superset, so the loop mark shows wherever it appears.",
  circuitNewCircuit: (l: string) => `New circuit (${l})`,
  circuitAddAnother: 'Add another exercise',
  circuitAddRound: 'Add a round',
  circuitAllLogged: (n: number) => `All ${n} exercises logged.`,
  circuitBuilding: 'Building the circuit',
  circuitCompleteRound: 'Complete round',
  circuitContinueCircuit: 'Continue circuit',
  circuitContinueRound: (n: number) => `Continue round ${n}`,
  circuitDoneStart: (l: string) => `Done — start Circuit ${l}`,
  circuitExerciseOf: (a: number, b: number) => `Exercise ${a} of ${b}`,
  circuitFinishAll: 'Finish circuit',
  circuitLogRound: (slot: string, n: number) => `Log ${slot} · round ${n}`,
  circuitNext: 'Next',
  circuitNoLoad: 'No load — bodyweight. Volume counts reps only.',
  circuitRecorded: 'Recorded',
  circuitRest: 'Rest · auto',
  circuitRoundComplete: (n: number) => `Round ${n} complete`,
  circuitRoundCompleteBody: "Keep the loop going or wrap it up — it's your call.",
  circuitRoundGoal: 'Round goal',
  circuitRoundOf: (a: number, b: number) => `Round ${a} of ${b}`,
  circuitRounds: 'Rounds',
  circuitRoundsOpen: 'rounds are open',
  circuitRoundsShort: 'rounds',
  circuitStart: 'Start circuit',
  circuitStartRound: (n: number) => `Start round ${n}`,
  circuitStatusDone: 'done',
  circuitSwipeHint: 'swipe between exercises in the round',
  circuitWhatYouDid: 'What you did',
};

const uk: CircuitStrings = {
  circuitLabel: 'Кругова',
  esCircuitSub: 'Вправи одна за одною, колами',
  esCircuitStart: 'Почати',
  circuitAdding: 'Додаю в Кругову',
  circuitSoFar: (n: number) => `${n} · наступна додається в коло`,
  circuitFinishSet: 'Завершити набір',
  circuitHint: 'Наступні вправи додаються в одну кругову з раундами — як блок у кросфіті.',
  circuitSettingDesc:
    'Виконуй скільки завгодно вправ колами. Вимкни, щоб повернутися до звичайних вправ — це не суперсет, тож петлю видно всюди, де вона зʼявляється.',
  circuitNewCircuit: (l: string) => `Нова кругова (${l})`,
  circuitAddAnother: 'Додати ще вправу',
  circuitAddRound: 'Додати коло',
  circuitAllLogged: (n: number) => `Усі ${n} вправи записано.`,
  circuitBuilding: 'Збираємо кругову',
  circuitCompleteRound: 'Завершити коло',
  circuitContinueCircuit: 'Продовжити кругову',
  circuitContinueRound: (n: number) => `Продовжити коло ${n}`,
  circuitDoneStart: (l: string) => `Готово — почати Кругову ${l}`,
  circuitExerciseOf: (a: number, b: number) => `Вправа ${a} з ${b}`,
  circuitFinishAll: 'Завершити кругову',
  circuitLogRound: (slot: string, n: number) => `Записати ${slot} · коло ${n}`,
  circuitNext: 'Далі',
  circuitNoLoad: 'Без ваги — власна вага. В обʼєм рахуються тільки повтори.',
  circuitRecorded: 'Записано',
  circuitRest: 'Відпочинок · авто',
  circuitRoundComplete: (n: number) => `Коло ${n} завершено`,
  circuitRoundCompleteBody: 'Продовжуй коло або завершуй — тобі вирішувати.',
  circuitRoundGoal: 'Ціль кола',
  circuitRoundOf: (a: number, b: number) => `Раунд ${a} з ${b}`,
  circuitRounds: 'Кола',
  circuitRoundsOpen: 'кола відкриті',
  circuitRoundsShort: 'кіл',
  circuitStart: 'Почати кругову',
  circuitStartRound: (n: number) => `Почати коло ${n}`,
  circuitStatusDone: 'завершено',
  circuitSwipeHint: 'гортай між вправами кола',
  circuitWhatYouDid: 'Що зроблено',
};

const pl: CircuitStrings = {
  circuitLabel: 'Obwód',
  esCircuitSub: 'Ćwiczenia jedno po drugim, w rundach',
  esCircuitStart: 'Start',
  circuitAdding: 'Dodaję do obwodu',
  circuitSoFar: (n: number) => `${n} · kolejne dołącza do obwodu`,
  circuitFinishSet: 'Zakończ zestaw',
  circuitHint: 'Kolejne ćwiczenia trafiają do jednego obwodu z rundami — jak blok crossfit.',
  circuitSettingDesc:
    'Wykonuj dowolną liczbę ćwiczeń w rundach. Wyłącz, aby wrócić do zwykłych ćwiczeń — to nie superseria, więc pętlę zobaczysz wszędzie.',
  circuitNewCircuit: (l: string) => `Nowy obwód (${l})`,
  circuitAddAnother: 'Dodaj kolejne ćwiczenie',
  circuitAddRound: 'Dodaj rundę',
  circuitAllLogged: (n: number) => `Zapisano wszystkie ćwiczenia (${n}).`,
  circuitBuilding: 'Budujemy obwód',
  circuitCompleteRound: 'Zakończ rundę',
  circuitContinueCircuit: 'Kontynuuj obwód',
  circuitContinueRound: (n: number) => `Kontynuuj rundę ${n}`,
  circuitDoneStart: (l: string) => `Gotowe — zacznij Obwód ${l}`,
  circuitExerciseOf: (a: number, b: number) => `Ćwiczenie ${a} z ${b}`,
  circuitFinishAll: 'Zakończ obwód',
  circuitLogRound: (slot: string, n: number) => `Zapisz ${slot} · runda ${n}`,
  circuitNext: 'Dalej',
  circuitNoLoad: 'Bez obciążenia — masa ciała. Objętość liczy tylko powtórzenia.',
  circuitRecorded: 'Zapisano',
  circuitRest: 'Odpoczynek · auto',
  circuitRoundComplete: (n: number) => `Runda ${n} ukończona`,
  circuitRoundCompleteBody: 'Kontynuuj obwód albo zakończ — Twój wybór.',
  circuitRoundGoal: 'Cel rundy',
  circuitRoundOf: (a: number, b: number) => `Runda ${a} z ${b}`,
  circuitRounds: 'Rundy',
  circuitRoundsOpen: 'rundy są otwarte',
  circuitRoundsShort: 'rund',
  circuitStart: 'Rozpocznij obwód',
  circuitStartRound: (n: number) => `Zacznij rundę ${n}`,
  circuitStatusDone: 'ukończono',
  circuitSwipeHint: 'przesuwaj między ćwiczeniami rundy',
  circuitWhatYouDid: 'Co zrobiłeś',
};

const et: CircuitStrings = {
  circuitLabel: 'Ringtreening',
  esCircuitSub: 'Harjutused järjest, ringidena',
  esCircuitStart: 'Alusta',
  circuitAdding: 'Lisan ringi',
  circuitSoFar: (n: number) => `${n} · järgmine liitub ringiga`,
  circuitFinishSet: 'Lõpeta komplekt',
  circuitHint: 'Järgmisena lisatavad harjutused liidetakse üheks ringiks — nagu crossfiti plokk.',
  circuitSettingDesc:
    'Tee ükskõik kui palju harjutusi ringidena. Lülita välja, et naasta tavaharjutuste juurde — see pole superseeria, seega näed silmust kõikjal.',
  circuitNewCircuit: (l: string) => `Uus ring (${l})`,
  circuitAddAnother: 'Lisa veel harjutus',
  circuitAddRound: 'Lisa ring',
  circuitAllLogged: (n: number) => `Kõik ${n} harjutust salvestatud.`,
  circuitBuilding: 'Ehitame ringi',
  circuitCompleteRound: 'Lõpeta ring',
  circuitContinueCircuit: 'Jätka ringi',
  circuitContinueRound: (n: number) => `Jätka ${n}. ringi`,
  circuitDoneStart: (l: string) => `Valmis — alusta ringi ${l}`,
  circuitExerciseOf: (a: number, b: number) => `Harjutus ${a} / ${b}`,
  circuitFinishAll: 'Lõpeta ringtreening',
  circuitLogRound: (slot: string, n: number) => `Logi ${slot} · ring ${n}`,
  circuitNext: 'Järgmine',
  circuitNoLoad: 'Koormuseta — keharaskus. Maht loeb ainult kordusi.',
  circuitRecorded: 'Salvestatud',
  circuitRest: 'Puhkus · auto',
  circuitRoundComplete: (n: number) => `Ring ${n} tehtud`,
  circuitRoundCompleteBody: 'Jätka ringi või lõpeta — sinu valik.',
  circuitRoundGoal: 'Ringi eesmärk',
  circuitRoundOf: (a: number, b: number) => `Ring ${a} / ${b}`,
  circuitRounds: 'Ringid',
  circuitRoundsOpen: 'ringid on avatud',
  circuitRoundsShort: 'ringi',
  circuitStart: 'Alusta ringi',
  circuitStartRound: (n: number) => `Alusta ${n}. ringi`,
  circuitStatusDone: 'tehtud',
  circuitSwipeHint: 'liigu ringi harjutuste vahel',
  circuitWhatYouDid: 'Mida tegid',
};

const lt: CircuitStrings = {
  circuitLabel: 'Ratas',
  esCircuitSub: 'Pratimai vienas po kito, ratais',
  esCircuitStart: 'Pradėti',
  circuitAdding: 'Dedu į ratą',
  circuitSoFar: (n: number) => `${n} · kitas jungiamas į ratą`,
  circuitFinishSet: 'Baigti rinkinį',
  circuitHint: 'Toliau pridedami pratimai jungiami į vieną ratų treniruotę — kaip crossfit blokas.',
  circuitSettingDesc:
    'Atlik bet kiek pratimų ratais. Išjunk, kad grįžtum prie įprastų pratimų — tai ne supersetas, tad kilpą matysi visur.',
  circuitNewCircuit: (l: string) => `Naujas ratas (${l})`,
  circuitAddAnother: 'Pridėti dar pratimą',
  circuitAddRound: 'Pridėti ratą',
  circuitAllLogged: (n: number) => `Įrašyti visi ${n} pratimai.`,
  circuitBuilding: 'Kuriame ratą',
  circuitCompleteRound: 'Baigti ratą',
  circuitContinueCircuit: 'Tęsti ratus',
  circuitContinueRound: (n: number) => `Tęsti ${n} ratą`,
  circuitDoneStart: (l: string) => `Gatava — pradėti ratą ${l}`,
  circuitExerciseOf: (a: number, b: number) => `${a} pratimas iš ${b}`,
  circuitFinishAll: 'Baigti ratus',
  circuitLogRound: (slot: string, n: number) => `Žymėti ${slot} · ${n} ratas`,
  circuitNext: 'Toliau',
  circuitNoLoad: 'Be svorio — kūno svoris. Apimtis skaičiuoja tik pakartojimus.',
  circuitRecorded: 'Įrašyta',
  circuitRest: 'Poilsis · auto',
  circuitRoundComplete: (n: number) => `${n} ratas baigtas`,
  circuitRoundCompleteBody: 'Tęsk ratą arba baik — tau spręsti.',
  circuitRoundGoal: 'Rato tikslas',
  circuitRoundOf: (a: number, b: number) => `${a} ratas iš ${b}`,
  circuitRounds: 'Ratai',
  circuitRoundsOpen: 'ratai atviri',
  circuitRoundsShort: 'ratų',
  circuitStart: 'Pradėti ratą',
  circuitStartRound: (n: number) => `Pradėti ${n} ratą`,
  circuitStatusDone: 'baigta',
  circuitSwipeHint: 'braukite tarp rato pratimų',
  circuitWhatYouDid: 'Ką padarei',
};

export const STRINGS: Record<LocaleId, CircuitStrings> = { en, uk, pl, et, lt };
