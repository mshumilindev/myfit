/**
 * A blind held-out set, written before the routing round that followed it and
 * scored once before any code change: Estonian, Lithuanian, Polish and
 * grammar-heavy English / Ukrainian. Never tuned on — it measures how the
 * general mechanisms carry to messages nobody fitted anything to. Not part of
 * CORPUS (its every-4th split stays as it was).
 */
import type { Case, Row } from './corpus';

const AR = 'activity_report';
const UNSURE = 'unsure';
const PAIN = ['pain', 'pain_check'];

const ET: Row[] = [
  ['mida ma täna jõusaalis tegema peaksin', 'today'],
  ['kas mu kükk on viimasel ajal paranenud', 'progress_lift'],
  ['mitu päeva nädalas peaks trenni tegema', 'days_per_week'],
  ['kui kaua puhata raskete seeriate vahel', 'rest'],
  ['mitu grammi valku peaksin päevas sööma', 'protein'],
  ['kas kreatiin on ohutu', ['supplements', 'k_creatine_myths']],
  ['põlv hakkas kükkides valutama', PAIN],
  ['alaselg valutab pärast jõutõmmet', PAIN],
  ['kas ma tohin haigena trenni teha', 'sick'],
  ['kuidas pärast kuu aega pausi uuesti alustada', 'comeback'],
  ['mida süüa enne hommikust trenni', ['pre_meal', 'fasted']],
  ['mida pärast trenni süüa', 'post_meal'],
  ['kui palju kardiot peaks nädalas tegema', 'cardio'],
  ['kas kõhulihaseid võib iga päev teha', 'abs_daily'],
  ['mis on parim treeningjaotus neljaks päevaks', ['split_choice', 'plan_build']],
  ['mul pole täna üldse tahtmist', 'motivation'],
  ['olen täna väga väsinud', 'tired'],
  ['kui kaua peaks üks trenn kestma', 'session_length'],
  ['kas enne raskusi peaks venitama', 'stretch_before'],
  ['kuidas paremini uinuda', 'sleep_better'],
  ['kas õhtune trenn on hommikusest halvem', 'time_of_day'],
  ['mitu kordust teha lihasmassi jaoks', ['reps', 'muscle_gain_rate']],
  ['kas iga seeria peab olema lõpuni', 'failure'],
  ['millal kergem nädal teha', 'deload'],
  ['kuidas rinnalihaseid kasvatada', 'grow_muscle'],
  ['kui palju vett päevas juua', 'water'],
  ['jooksin eile 8 km', AR],
  ['käisin täna ujumas', AR],
  ['mis on minu parim jõutõmme', ['best', 'heaviest']],
  ['kui palju ma praegu kaalun', 'bodyweight'],
  ['millal ma viimati kükitasin', 'lift_last'],
  ['näita mu treeningplaani', 'plan'],
  ['tere treener', 'greeting'],
  ['aitäh abi eest', 'thanks'],
  ['kes sa oled', 'who'],
  ['sa ei kuula mind üldse', 'you_dumb'],
  ['kui mul on ainult 20 minutit, mida teha', 'short_on_time'],
  ['kui ma haigeks jään, kas jätta trenn vahele', 'sick'],
  [
    'ma ei taha kaalust alla võtta, tahan lihaseid',
    ['muscle_gain_rate', 'memory_note', 'my_goal', 'bulk_surplus'],
  ],
  ['milline ilm täna on', 'off_topic'],
];

const LT: Row[] = [
  ['ką man šiandien daryti sporto salėje', 'today'],
  ['kiek ilsėtis tarp sunkių serijų', 'rest'],
  ['kiek baltymų suvalgyti per dieną', 'protein'],
  ['skauda nugarą po mirties traukos', PAIN],
  ['ar galiu sportuoti kai sergu', 'sick'],
  ['kaip grįžti po mėnesio pertraukos', 'comeback'],
  ['kiek kartų per savaitę treniruotis', 'days_per_week'],
  ['kaip padidinti rankų raumenis', ['arms', 'grow_muscle']],
  ['ar kreatinas saugus', ['supplements', 'k_creatine_myths']],
  ['koks mano geriausias pritūpimas', ['best', 'heaviest']],
  ['kiek aš dabar sveriu', 'bodyweight'],
  ['vakar važiavau dviračiu dvi valandas', AR],
  ['neturiu jėgų šiandien', ['tired', 'motivation']],
  ['kiek laiko turi trukti treniruotė', 'session_length'],
  ['ką valgyti po treniruotės', 'post_meal'],
  ['jei turiu tik pusvalandį, ką daryti', 'short_on_time'],
  ['net jei skauda kelį, ar galiu tūpti', PAIN],
  ['ačiū, labai padėjai', 'thanks'],
  ['tu manęs neklausai', 'you_dumb'],
  ['kas laimėjo krepšinio rungtynes vakar', 'off_topic'],
];

const PL: Row[] = [
  ['co mam dzisiaj zrobić na siłowni', 'today'],
  ['ile przerwy między ciężkimi seriami', 'rest'],
  ['ile gram białka dziennie jeść', 'protein'],
  ['boli mnie łokieć przy uginaniu', PAIN],
  ['czy mogę ćwiczyć z gorączką', 'sick'],
  ['jak wrócić do formy po miesiącu przerwy', 'comeback'],
  ['ile razy w tygodniu robić nogi', ['muscle_frequency', 'days_per_week']],
  ['jak powiększyć bicepsy', ['arms', 'grow_muscle']],
  ['jaki jest mój rekord w martwym ciągu', ['best', 'heaviest']],
  ['ile teraz ważę', 'bodyweight'],
  ['wczoraj przejechałem 40 km na rowerze', AR],
  ['jak długo powinien trwać trening', 'session_length'],
  ['chyba że boli, czy robić przysiad poniżej równoległej', ['squat_form', 'k_butt_wink']],
  ['na wypadek gdybym zachorował, odpuścić trening?', 'sick'],
  ['jeśli rzucę siłownię na dwa miesiące, ile mięśni stracę', 'k_detraining'],
  ['boję się że utknę pod sztangą na ławce', ['k_fear_heavy', 'bench_alone']],
  ['dzięki za pomoc', 'thanks'],
  ['w ogóle mnie nie słuchasz', 'you_dumb'],
  ['kto wygrał mecz wczoraj', 'off_topic'],
  [
    'nie chcę chudnąć, chcę przytyć mięśniami',
    ['muscle_gain_rate', 'memory_note', 'my_goal', 'bulk_surplus'],
  ],
];

const GRAM: Row[] = [
  [
    'unless my back hurts, should i deadlift heavy today',
    ['technique_lift', 'today', 'k_deadlift_rounding', UNSURE],
  ],
  [
    'in case my shoulder acts up, what can i do instead of overhead press',
    ['alternatives', ...PAIN],
  ],
  ['even if i sleep badly, should i still train', ['sleep', 'skip', 'recovery']],
  ['as long as it doesn’t hurt, is it okay to train through soreness', 'train_sore'],
  ['once i hit 100 kg on bench, what should i aim for next', ['next_weight', 'add_weight', UNSURE]],
  ['whenever i squat my knees cave in', 'k_knees_cave'],
  [
    "i'm worried about getting pinned under the bar when i bench alone",
    ['bench_alone', 'k_fear_heavy'],
  ],
  ["i'm scared i'll drop the weight on my chest", ['bench_alone', 'k_fear_heavy']],
  ['if i quit lifting for two months, how much strength will i lose', 'k_detraining'],
  ['if i skip the gym during my holiday, will i lose my gains', ['k_detraining', 'k_holidays']],
  ['i benched yesterday, can i bench again today', ['two_days_row', 'recovery', 'train_sore']],
  ['will i be sore tomorrow after heavy squats', ['recovery', 'train_sore']],
  ['have i been training my back enough lately', ['volume_muscle', 'muscle_frequency', 'weak']],
  [
    "i don't want cardio, i want to get stronger",
    ['strength_vs_size', 'muscle_gain_rate', 'memory_note', 'my_goal'],
  ],
  [
    'forget about diet for now, how many sets should i do for legs',
    ['volume_muscle', 'sets_for_lift', 'muscle_frequency'],
  ],
  ['my brother asks whether creatine is safe', ['supplements', 'k_creatine_myths']],
  ['my mom is 70, is lifting safe for her', ['age', 'k_older_lifter']],
  ['you keep giving me the same answer', 'you_dumb'],
  [
    'long day at work. slept 5 hours. gym or rest?',
    ['skip', 'tired', 'recovery', 'sleep', 'stress'],
  ],
  ['quick question. how much water should i drink?', 'water'],
  ['how many workouts did i do in the last month', ['range_count', 'month']],
  ['i ran 5k this morning and then did legs', AR],
  ['what did i train last thursday', 'day_lookup'],
  ['is 2 minutes of rest enough for squats', 'rest'],
  ['якщо не болить, чи можна присідати нижче паралелі', ['squat_form', 'k_butt_wink']],
  ['на випадок якщо захворію, чи пропускати тренування', 'sick'],
  ['навіть якщо погано спав, йти в зал?', ['sleep', 'skip', 'recovery']],
  ['поки не болить, можна тренуватись з крепатурою?', 'train_sore'],
  ['боюсь застрягти під штангою на жимі', ['bench_alone', 'k_fear_heavy']],
  ['якщо кину зал на два місяці, скільки сили втрачу', 'k_detraining'],
  ['вчора жав, а сьогодні можна знову жим?', ['two_days_row', 'recovery', 'train_sore']],
  [
    'не хочу кардіо, хочу стати сильнішим',
    ['strength_vs_size', 'muscle_gain_rate', 'memory_note', 'my_goal'],
  ],
  ['брат питає чи безпечний креатин', ['supplements', 'k_creatine_myths']],
  ['мамі 70, чи можна їй тренуватись із вагою', ['age', 'k_older_lifter']],
  ['ти весь час відповідаєш одне й те саме', 'you_dumb'],
  [
    'важкий день. спав 5 годин. зал чи відпочинок?',
    ['skip', 'tired', 'recovery', 'sleep', 'stress'],
  ],
  ['швидке питання. скільки води пити?', 'water'],
  ['скільки тренувань я зробив за останній місяць', ['range_count', 'month']],
  ['зранку пробіг 5 км, а потім ноги', AR],
  ['що я тренував минулого четверга', 'day_lookup'],
];

const rows = (r: Row[]): Case[] =>
  r.map(([q, expect, prev]) => (prev ? { q, expect, prev } : { q, expect }));

export const BLIND_ET: Case[] = rows(ET);
export const BLIND_LT: Case[] = rows(LT);
export const BLIND_PL: Case[] = rows(PL);
export const BLIND_GRAM: Case[] = rows(GRAM);
export const BLIND: Case[] = [...BLIND_ET, ...BLIND_LT, ...BLIND_PL, ...BLIND_GRAM];
