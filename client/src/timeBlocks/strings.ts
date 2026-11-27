import type { LocaleId } from '../i18n';
import type { BlockGroup } from './blockCatalog';
import type { BlockFormat } from './model';

/** Words of the time-block screens. The module's own words live in its chunk, not in the core i18n (add-on boundary). */
export interface TimeBlocksStrings {
  getReady: string;
  getInPosition: string;
  clockRunning: string;
  go: string;
  cancel: string;
  formats: Record<BlockFormat, string>;
  help: Record<BlockFormat, string>;
  ready: string;
  edit: string;
  start: string;
  addExercise: string;
  conditioning: string;
  conditioningNote: string;
  conditioningLine: (blocks: number, min: number, rounds: number) => string;
  blockWord: string;
  blockReadyTitle: string;
  blockReadyNote: string;
  catAll: string;
  addedWord: string;
  addByName: (name: string) => string;
  cats: Record<BlockGroup, string>;
  paused: string;
  pause: string;
  resume: string;
  finish: string;
  roundBtn: string;
  roundDone: string;
  amrapCap: (rounds: number) => string;
  emomCap: (minute: number, total: number) => string;
  fortimeCap: (round: number, total: number, cap: string) => string;
  intervalsCap: (rest: boolean, round: number, total: number) => string;
  timeUp: string;
  allDone: string;
  logResult: string;
  result: string;
  rounds: string;
  plusReps: string;
  minutes: string;
  seconds: string;
  timeUpFlag: string;
  hitCap: string;
  scaled: string;
  save: string;
  actuallyDid: string;
  optional: string;
  asPlanned: string;
  plannedReps: (n: number) => string;
  less: string;
  more: string;
  actualsNote: string;
  summaryRounds: (rounds: number, extra: number) => string;
  newBlock: string;
  editBlock: string;
  format: string;
  classics: string;
  tapToClear: string;
  capMin: string;
  targetRounds: string;
  everySec: string;
  forMin: string;
  workSec: string;
  restSec: string;
  exercises: string;
  noneYet: string;
  nAdded: (n: number) => string;
  addBlock: string;
  saveBlock: string;
  stillNeeded: string;
  needExercise: string;
  startedFrom: (name: string) => string;
  movedToBlock: (name: string) => string;
  remove: string;
  deleteBlock: string;
  deleteBlockTitle: string;
  deleteBlockBody: string;
  keep: string;
  timeBlockRow: string;
  exerciseInfo: string;
  /** Long one-line summary parts: "12 min", "target 8 rounds", "cap 15 min", "every 60 s × 10". */
  minN: (m: number) => string;
  targetN: (n: number) => string;
  capN: (m: number) => string;
  everyN: (s: number, n: number) => string;
  movedIntoBlock: (name: string) => string;
  timeBlockHint: string;
  blockLabel: string;
}

const en: TimeBlocksStrings = {
  getReady: 'Get ready',
  getInPosition: 'Get in position',
  clockRunning: 'Clock running',
  go: 'GO',
  cancel: 'Cancel',
  formats: { amrap: 'AMRAP', emom: 'EMOM', fortime: 'For time', intervals: 'Intervals' },
  help: {
    amrap: 'As many rounds as you can before the time is up.',
    emom: 'A new round starts every interval. Rest is what is left of it.',
    fortime: 'Finish the work as fast as you can. The cap stops it.',
    intervals: 'Work and rest on a clock, round after round.',
  },
  ready: 'Ready',
  edit: 'Edit',
  start: 'Start',
  addExercise: 'Add exercise',
  conditioning: 'Conditioning',
  conditioningNote: 'Not counted in muscle sets.',
  conditioningLine: (b, m, r) => `${b} blocks · ${m} min · ${r} rounds`,
  blockWord: 'Block',
  blockReadyTitle: 'Block-ready exercises',
  blockReadyNote: 'Only moves that work in a timed block. Your own moves can be added by name.',
  catAll: 'All',
  addedWord: 'Added',
  addByName: (n) => `Add “${n}”`,
  cats: {
    bodyweight: 'Bodyweight',
    kettlebell: 'Kettlebell',
    barbell: 'Barbell',
    machines: 'Machines',
    dumbbell: 'Dumbbell',
    throws: 'Throws & carries',
  },
  paused: 'Paused',
  pause: 'Pause',
  resume: 'Resume',
  finish: 'Finish',
  roundBtn: 'Round',
  roundDone: 'Round done',
  amrapCap: (rounds: number) => `Rounds ${rounds}`,
  emomCap: (minute: number, total: number) => `Min ${minute}/${total}`,
  fortimeCap: (round: number, total: number, cap: string) =>
    `Round ${round}/${total}${cap ? ` · cap ${cap}` : ''}`,
  intervalsCap: (rest: boolean, round: number, total: number) =>
    `${rest ? 'Rest' : 'Work'} ${round}/${total}`,
  timeUp: 'Time is up',
  allDone: 'Done',
  logResult: 'Log result',
  result: 'Result',
  rounds: 'Rounds',
  plusReps: '+ reps',
  minutes: 'Min',
  seconds: 'Sec',
  timeUpFlag: 'Time up',
  hitCap: 'Hit the cap',
  scaled: 'Scaled',
  save: 'Save',
  actuallyDid: 'What you actually did',
  optional: 'Optional',
  asPlanned: 'As planned',
  plannedReps: (n: number) => `planned ${n} reps`,
  less: 'Less',
  more: 'More',
  actualsNote: 'Leave it as is and the app counts everything as done.',
  summaryRounds: (rounds: number, extra: number) => `${rounds} rounds${extra ? ` + ${extra}` : ''}`,
  newBlock: 'New time block',
  editBlock: 'Edit time block',
  format: 'Format',
  classics: 'Start from a classic',
  tapToClear: '(tap again to clear)',
  capMin: 'Time cap, min',
  targetRounds: 'Target rounds',
  everySec: 'Every, s',
  forMin: 'For, min',
  workSec: 'Work, s',
  restSec: 'Rest, s',
  exercises: 'Exercises',
  noneYet: 'None yet',
  nAdded: (n: number) => `${n} added`,
  addBlock: 'Add block',
  saveBlock: 'Save block',
  stillNeeded: 'Still needed',
  needExercise: 'Add at least one exercise',
  startedFrom: (name: string) =>
    `Started from ${name}. It moves into the block; Undo brings it back.`,
  movedToBlock: (name: string) => `${name} moved to the block`,
  remove: 'Remove',
  deleteBlock: 'Delete block',
  deleteBlockTitle: 'Delete this block?',
  deleteBlockBody: 'The block and its result are removed from this session.',
  keep: 'Keep',
  timeBlockRow: 'Time block…',
  exerciseInfo: 'Exercise details',
  minN: (m) => `${m} min`,
  targetN: (n) => `target ${n} rounds`,
  capN: (m) => `cap ${m} min`,
  everyN: (s, n) => `every ${s} s × ${n}`,
  movedIntoBlock: (n) => `${n} moved into the block`,
  timeBlockHint: 'Move this exercise into a timed block',
  blockLabel: 'Time block',
};
const uk: TimeBlocksStrings = {
  getReady: 'Приготуйтесь',
  getInPosition: 'Займіть позицію',
  clockRunning: 'Час іде',
  go: 'СТАРТ',
  cancel: 'Скасувати',
  formats: { amrap: 'AMRAP', emom: 'EMOM', fortime: 'На час', intervals: 'Інтервали' },
  help: {
    amrap: 'Якомога більше раундів, поки не закінчиться час.',
    emom: 'Новий раунд починається щоразу через інтервал. Відпочинок — те, що лишилось від нього.',
    fortime: 'Виконай роботу якнайшвидше. Ліміт часу зупиняє блок.',
    intervals: 'Робота й відпочинок за таймером, раунд за раундом.',
  },
  ready: 'Готово',
  edit: 'Змінити',
  start: 'Старт',
  addExercise: 'Додати вправу',
  conditioning: 'Кондиціонування',
  conditioningNote: 'Не входить у підходи по м’язах.',
  conditioningLine: (b, m, r) => `${b} блоків · ${m} min · ${r} раундів`,
  blockWord: 'Блок',
  blockReadyTitle: 'Вправи для блоку',
  blockReadyNote: 'Лише рухи, що працюють у блоці на час. Свої рухи можна додати за назвою.',
  catAll: 'Усі',
  addedWord: 'Додано',
  addByName: (n) => `Додати «${n}»`,
  cats: {
    dumbbell: 'Гантелі',
    throws: 'Кидки й перенесення',
    bodyweight: 'Власна вага',
    kettlebell: 'Гиря',
    barbell: 'Штанга',
    machines: 'Тренажери',
  },
  paused: 'Пауза',
  pause: 'Пауза',
  resume: 'Далі',
  finish: 'Завершити',
  roundBtn: 'Раунд',
  roundDone: 'Раунд виконано',
  amrapCap: (rounds: number) => `Раундів ${rounds}`,
  emomCap: (minute: number, total: number) => `Хв ${minute}/${total}`,
  fortimeCap: (round: number, total: number, cap: string) =>
    `Раунд ${round}/${total}${cap ? ` · ліміт ${cap}` : ''}`,
  intervalsCap: (rest: boolean, round: number, total: number) =>
    `${rest ? 'Відпочинок' : 'Робота'} ${round}/${total}`,
  timeUp: 'Час вийшов',
  allDone: 'Готово',
  logResult: 'Записати результат',
  result: 'Результат',
  rounds: 'Раунди',
  plusReps: '+ повторень',
  minutes: 'Хв',
  seconds: 'Сек',
  timeUpFlag: 'Час вийшов',
  hitCap: 'Дійшов до ліміту',
  scaled: 'Полегшено',
  save: 'Зберегти',
  actuallyDid: 'Що ти зробив насправді',
  optional: 'Необовʼязково',
  asPlanned: 'Як заплановано',
  plannedReps: (n: number) => `заплановано ${n} повторень`,
  less: 'Менше',
  more: 'Більше',
  actualsNote: 'Залиш як є, і застосунок порахує все виконаним.',
  summaryRounds: (rounds: number, extra: number) =>
    `${rounds} раундів${extra ? ` + ${extra}` : ''}`,
  newBlock: 'Новий часовий блок',
  editBlock: 'Змінити часовий блок',
  format: 'Формат',
  classics: 'Почати з класики',
  tapToClear: '(торкнись ще раз, щоб скинути)',
  capMin: 'Ліміт часу, хв',
  targetRounds: 'Ціль, раундів',
  everySec: 'Кожні, с',
  forMin: 'Протягом, хв',
  workSec: 'Робота, с',
  restSec: 'Відпочинок, с',
  exercises: 'Вправи',
  noneYet: 'Поки немає',
  nAdded: (n: number) => `додано ${n}`,
  addBlock: 'Додати блок',
  saveBlock: 'Зберегти блок',
  stillNeeded: 'Ще потрібно',
  needExercise: 'Додай хоча б одну вправу',
  startedFrom: (name: string) =>
    `Почато з «${name}». Вона переходить у блок; Скасувати поверне її.`,
  movedToBlock: (name: string) => `«${name}» перенесено в блок`,
  remove: 'Прибрати',
  deleteBlock: 'Видалити блок',
  deleteBlockTitle: 'Видалити цей блок?',
  deleteBlockBody: 'Блок і його результат буде прибрано з цього тренування.',
  keep: 'Залишити',
  timeBlockRow: 'Часовий блок…',
  exerciseInfo: 'Про вправу',
  minN: (m) => `${m} хв`,
  targetN: (n) => `ціль: ${n} раундів`,
  capN: (m) => `ліміт ${m} хв`,
  everyN: (s, n) => `кожні ${s} с × ${n}`,
  movedIntoBlock: (n) => `${n} перенесено в блок`,
  timeBlockHint: 'Перенести цю вправу в часовий блок',
  blockLabel: 'Часовий блок',
};
const pl: TimeBlocksStrings = {
  getReady: 'Przygotuj się',
  getInPosition: 'Przyjmij pozycję',
  clockRunning: 'Czas leci',
  go: 'START',
  cancel: 'Anuluj',
  formats: { amrap: 'AMRAP', emom: 'EMOM', fortime: 'Na czas', intervals: 'Interwały' },
  help: {
    amrap: 'Jak najwięcej rund, zanim skończy się czas.',
    emom: 'Nowa runda zaczyna się co interwał. Odpoczynek to to, co z niego zostaje.',
    fortime: 'Wykonaj pracę jak najszybciej. Limit czasu zatrzymuje blok.',
    intervals: 'Praca i odpoczynek na zegarze, runda po rundzie.',
  },
  ready: 'Gotowe',
  edit: 'Edytuj',
  start: 'Start',
  addExercise: 'Dodaj ćwiczenie',
  conditioning: 'Kondycja',
  conditioningNote: 'Nie liczone do serii mięśni.',
  conditioningLine: (b, m, r) => `${b} bloków · ${m} min · ${r} rund`,
  blockWord: 'Blok',
  blockReadyTitle: 'Ćwiczenia do bloku',
  blockReadyNote: 'Tylko ruchy, które działają w bloku na czas. Własne ruchy dodasz po nazwie.',
  catAll: 'Wszystkie',
  addedWord: 'Dodano',
  addByName: (n) => `Dodaj „${n}”`,
  cats: {
    bodyweight: 'Masa ciała',
    kettlebell: 'Kettlebell',
    barbell: 'Sztanga',
    machines: 'Maszyny',
    dumbbell: 'Hantle',
    throws: 'Rzuty i noszenie',
  },
  paused: 'Pauza',
  pause: 'Pauza',
  resume: 'Wznów',
  finish: 'Zakończ',
  roundBtn: 'Runda',
  roundDone: 'Runda zrobiona',
  amrapCap: (rounds: number) => `Rund ${rounds}`,
  emomCap: (minute: number, total: number) => `Min ${minute}/${total}`,
  fortimeCap: (round: number, total: number, cap: string) =>
    `Runda ${round}/${total}${cap ? ` · limit ${cap}` : ''}`,
  intervalsCap: (rest: boolean, round: number, total: number) =>
    `${rest ? 'Odpoczynek' : 'Praca'} ${round}/${total}`,
  timeUp: 'Czas minął',
  allDone: 'Gotowe',
  logResult: 'Zapisz wynik',
  result: 'Wynik',
  rounds: 'Rundy',
  plusReps: '+ powtórzeń',
  minutes: 'Min',
  seconds: 'Sek',
  timeUpFlag: 'Czas minął',
  hitCap: 'Limit osiągnięty',
  scaled: 'Ułatwione',
  save: 'Zapisz',
  actuallyDid: 'Co naprawdę zrobiłeś',
  optional: 'Opcjonalnie',
  asPlanned: 'Zgodnie z planem',
  plannedReps: (n: number) => `zaplanowano ${n} powt.`,
  less: 'Mniej',
  more: 'Więcej',
  actualsNote: 'Zostaw bez zmian, a aplikacja policzy wszystko jako wykonane.',
  summaryRounds: (rounds: number, extra: number) => `${rounds} rund${extra ? ` + ${extra}` : ''}`,
  newBlock: 'Nowy blok czasowy',
  editBlock: 'Edytuj blok czasowy',
  format: 'Format',
  classics: 'Zacznij od klasyka',
  tapToClear: '(dotknij ponownie, by wyczyścić)',
  capMin: 'Limit czasu, min',
  targetRounds: 'Cel, rund',
  everySec: 'Co, s',
  forMin: 'Przez, min',
  workSec: 'Praca, s',
  restSec: 'Odpoczynek, s',
  exercises: 'Ćwiczenia',
  noneYet: 'Jeszcze brak',
  nAdded: (n: number) => `dodano ${n}`,
  addBlock: 'Dodaj blok',
  saveBlock: 'Zapisz blok',
  stillNeeded: 'Jeszcze potrzeba',
  needExercise: 'Dodaj przynajmniej jedno ćwiczenie',
  startedFrom: (name: string) => `Zaczęto od „${name}”. Przechodzi do bloku; Cofnij ją przywróci.`,
  movedToBlock: (name: string) => `„${name}” przeniesiono do bloku`,
  remove: 'Usuń',
  deleteBlock: 'Usuń blok',
  deleteBlockTitle: 'Usunąć ten blok?',
  deleteBlockBody: 'Blok i jego wynik zostaną usunięte z tego treningu.',
  keep: 'Zostaw',
  timeBlockRow: 'Blok czasowy…',
  exerciseInfo: 'Szczegóły ćwiczenia',
  minN: (m) => `${m} min`,
  targetN: (n) => `cel: ${n} rund`,
  capN: (m) => `limit ${m} min`,
  everyN: (s, n) => `co ${s} s × ${n}`,
  movedIntoBlock: (n) => `${n} przeniesione do bloku`,
  timeBlockHint: 'Przenieś to ćwiczenie do bloku czasowego',
  blockLabel: 'Blok czasowy',
};
const lt: TimeBlocksStrings = {
  getReady: 'Pasiruoškite',
  getInPosition: 'Užimkite padėtį',
  clockRunning: 'Laikas eina',
  go: 'START',
  cancel: 'Atšaukti',
  formats: { amrap: 'AMRAP', emom: 'EMOM', fortime: 'Į laiką', intervals: 'Intervalai' },
  help: {
    amrap: 'Kuo daugiau ratų, kol baigsis laikas.',
    emom: 'Naujas ratas prasideda kas intervalą. Poilsis — tai, kas lieka.',
    fortime: 'Atlik darbą kuo greičiau. Laiko riba sustabdo bloką.',
    intervals: 'Darbas ir poilsis pagal laikmatį, ratas po rato.',
  },
  ready: 'Paruošta',
  edit: 'Keisti',
  start: 'Pradėti',
  addExercise: 'Pridėti pratimą',
  conditioning: 'Kondicija',
  conditioningNote: 'Neįskaičiuota į raumenų serijas.',
  conditioningLine: (b, m, r) => `${b} blokų · ${m} min · ${r} raundų`,
  blockWord: 'Blokas',
  blockReadyTitle: 'Pratimai blokui',
  blockReadyNote:
    'Tik judesiai, tinkantys laiko blokui. Savo judesius galima pridėti pagal pavadinimą.',
  catAll: 'Visi',
  addedWord: 'Pridėta',
  addByName: (n) => `Pridėti „${n}“`,
  cats: {
    bodyweight: 'Savo svoris',
    kettlebell: 'Svarstis',
    barbell: 'Štanga',
    machines: 'Treniruokliai',
    dumbbell: 'Hanteliai',
    throws: 'Metimai ir nešimas',
  },
  paused: 'Pauzė',
  pause: 'Pauzė',
  resume: 'Tęsti',
  finish: 'Baigti',
  roundBtn: 'Ratas',
  roundDone: 'Ratas atliktas',
  amrapCap: (rounds: number) => `Ratų ${rounds}`,
  emomCap: (minute: number, total: number) => `Min. ${minute}/${total}`,
  fortimeCap: (round: number, total: number, cap: string) =>
    `Ratas ${round}/${total}${cap ? ` · riba ${cap}` : ''}`,
  intervalsCap: (rest: boolean, round: number, total: number) =>
    `${rest ? 'Poilsis' : 'Darbas'} ${round}/${total}`,
  timeUp: 'Laikas baigėsi',
  allDone: 'Atlikta',
  logResult: 'Įrašyti rezultatą',
  result: 'Rezultatas',
  rounds: 'Ratai',
  plusReps: '+ pakartojimų',
  minutes: 'Min.',
  seconds: 'Sek.',
  timeUpFlag: 'Laikas baigėsi',
  hitCap: 'Pasiekta riba',
  scaled: 'Palengvinta',
  save: 'Išsaugoti',
  actuallyDid: 'Ką iš tikrųjų padarei',
  optional: 'Neprivaloma',
  asPlanned: 'Kaip planuota',
  plannedReps: (n: number) => `planuota ${n} pakart.`,
  less: 'Mažiau',
  more: 'Daugiau',
  actualsNote: 'Palik kaip yra, ir programa viską laikys atlikta.',
  summaryRounds: (rounds: number, extra: number) => `${rounds} ratų${extra ? ` + ${extra}` : ''}`,
  newBlock: 'Naujas laiko blokas',
  editBlock: 'Keisti laiko bloką',
  format: 'Formatas',
  classics: 'Pradėk nuo klasikos',
  tapToClear: '(palieskite dar kartą, kad išvalytumėte)',
  capMin: 'Laiko riba, min.',
  targetRounds: 'Tikslas, ratų',
  everySec: 'Kas, s',
  forMin: 'Per, min.',
  workSec: 'Darbas, s',
  restSec: 'Poilsis, s',
  exercises: 'Pratimai',
  noneYet: 'Dar nėra',
  nAdded: (n: number) => `pridėta ${n}`,
  addBlock: 'Pridėti bloką',
  saveBlock: 'Išsaugoti bloką',
  stillNeeded: 'Dar reikia',
  needExercise: 'Pridėk bent vieną pratimą',
  startedFrom: (name: string) =>
    `Pradėta nuo „${name}“. Jis keliauja į bloką; Atšaukti jį grąžins.`,
  movedToBlock: (name: string) => `„${name}“ perkeltas į bloką`,
  remove: 'Pašalinti',
  deleteBlock: 'Ištrinti bloką',
  deleteBlockTitle: 'Ištrinti šį bloką?',
  deleteBlockBody: 'Blokas ir jo rezultatas bus pašalinti iš šios treniruotės.',
  keep: 'Palikti',
  timeBlockRow: 'Laiko blokas…',
  exerciseInfo: 'Pratimo informacija',
  minN: (m) => `${m} min.`,
  targetN: (n) => `tikslas: ${n} ratų`,
  capN: (m) => `riba ${m} min.`,
  everyN: (s, n) => `kas ${s} s × ${n}`,
  movedIntoBlock: (n) => `${n} perkeltas į bloką`,
  timeBlockHint: 'Perkelti šį pratimą į laiko bloką',
  blockLabel: 'Laiko blokas',
};
const et: TimeBlocksStrings = {
  getReady: 'Valmistu',
  getInPosition: 'Võta asend',
  clockRunning: 'Aeg jookseb',
  go: 'START',
  cancel: 'Tühista',
  formats: { amrap: 'AMRAP', emom: 'EMOM', fortime: 'Ajale', intervals: 'Intervallid' },
  help: {
    amrap: 'Nii palju ringe kui võimalik enne aja lõppu.',
    emom: 'Uus ring algab iga intervalli järel. Puhkus on see, mis järele jääb.',
    fortime: 'Tee töö ära nii kiiresti kui saad. Ajalimiit peatab ploki.',
    intervals: 'Töö ja puhkus kella järgi, ring ringi haaval.',
  },
  ready: 'Valmis',
  edit: 'Muuda',
  start: 'Start',
  addExercise: 'Lisa harjutus',
  conditioning: 'Konditsioneerimine',
  conditioningNote: 'Ei lähe lihaste seeriatesse.',
  conditioningLine: (b, m, r) => `${b} plokki · ${m} min · ${r} vooru`,
  blockWord: 'Plokk',
  blockReadyTitle: 'Plokiks sobivad harjutused',
  blockReadyNote: 'Ainult liigutused, mis sobivad ajaplokki. Oma liigutusi saab lisada nime järgi.',
  catAll: 'Kõik',
  addedWord: 'Lisatud',
  addByName: (n) => `Lisa „${n}”`,
  cats: {
    bodyweight: 'Oma kaal',
    kettlebell: 'Kettlebell',
    barbell: 'Kang',
    machines: 'Trenažöörid',
    dumbbell: 'Hantlid',
    throws: 'Visked ja kandmine',
  },
  paused: 'Paus',
  pause: 'Paus',
  resume: 'Jätka',
  finish: 'Lõpeta',
  roundBtn: 'Ring',
  roundDone: 'Ring tehtud',
  amrapCap: (rounds: number) => `Ringe ${rounds}`,
  emomCap: (minute: number, total: number) => `Min ${minute}/${total}`,
  fortimeCap: (round: number, total: number, cap: string) =>
    `Ring ${round}/${total}${cap ? ` · limiit ${cap}` : ''}`,
  intervalsCap: (rest: boolean, round: number, total: number) =>
    `${rest ? 'Puhkus' : 'Töö'} ${round}/${total}`,
  timeUp: 'Aeg sai läbi',
  allDone: 'Valmis',
  logResult: 'Salvesta tulemus',
  result: 'Tulemus',
  rounds: 'Ringid',
  plusReps: '+ kordusi',
  minutes: 'Min',
  seconds: 'Sek',
  timeUpFlag: 'Aeg sai läbi',
  hitCap: 'Jõudsin limiidini',
  scaled: 'Kergendatud',
  save: 'Salvesta',
  actuallyDid: 'Mida sa tegelikult tegid',
  optional: 'Valikuline',
  asPlanned: 'Nagu planeeritud',
  plannedReps: (n: number) => `planeeritud ${n} kordust`,
  less: 'Vähem',
  more: 'Rohkem',
  actualsNote: 'Jäta nii ja rakendus loeb kõik tehtuks.',
  summaryRounds: (rounds: number, extra: number) => `${rounds} ringi${extra ? ` + ${extra}` : ''}`,
  newBlock: 'Uus ajaplokk',
  editBlock: 'Muuda ajaplokki',
  format: 'Formaat',
  classics: 'Alusta klassikast',
  tapToClear: '(puuduta uuesti, et tühistada)',
  capMin: 'Ajalimiit, min',
  targetRounds: 'Siht, ringe',
  everySec: 'Iga, s',
  forMin: 'Kestus, min',
  workSec: 'Töö, s',
  restSec: 'Puhkus, s',
  exercises: 'Harjutused',
  noneYet: 'Veel pole',
  nAdded: (n: number) => `lisatud ${n}`,
  addBlock: 'Lisa plokk',
  saveBlock: 'Salvesta plokk',
  stillNeeded: 'Veel vaja',
  needExercise: 'Lisa vähemalt üks harjutus',
  startedFrom: (name: string) =>
    `Alustatud harjutusest „${name}”. See liigub plokki; Võta tagasi toob selle tagasi.`,
  movedToBlock: (name: string) => `„${name}” liigutati plokki`,
  remove: 'Eemalda',
  deleteBlock: 'Kustuta plokk',
  deleteBlockTitle: 'Kustutada see plokk?',
  deleteBlockBody: 'Plokk ja selle tulemus eemaldatakse sellest treeningust.',
  keep: 'Jäta',
  timeBlockRow: 'Ajaplokk…',
  exerciseInfo: 'Harjutuse info',
  minN: (m) => `${m} min`,
  targetN: (n) => `siht: ${n} ringi`,
  capN: (m) => `piir ${m} min`,
  everyN: (s, n) => `iga ${s} s × ${n}`,
  movedIntoBlock: (n) => `${n} liigutati plokki`,
  timeBlockHint: 'Liiguta see harjutus ajaplokki',
  blockLabel: 'Ajaplokk',
};

export const STRINGS: Record<LocaleId, TimeBlocksStrings> = { en, uk, pl, lt, et };
