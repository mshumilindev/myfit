/**
 * Short guided conversations — Atlas asks, you tap (or type), he narrows down.
 *
 *  1. PAIN AFTER TRAINING — a non-diagnostic check-in, the way a good coach
 *     would ask: where, after which lift, when it shows up, what it feels like,
 *     how bad, any warning signs, one question about technique. Then one of
 *     three outcomes: likely normal soreness (tips), train lighter for 1–2
 *     weeks (offer to log it in Injuries), or rest + see a doctor/physio
 *     (offer to log it with a few days of full rest). Plus what your log says
 *     (a load jump last session) and a technique cue for that lift.
 *
 *  2. FIND AN EXERCISE — "what's the exercise where you lie down and pull the
 *     bar to your face?" Atlas reads the description (equipment, muscle,
 *     position, movement), asks for what's missing, and offers the closest
 *     library exercises as taps.
 *
 * A flow lives in the conversation state; a new, unrelated question ends it.
 */
import type { MuscleGroup } from '../data/exercises';
import { BUILT_IN_CATALOG, richExerciseByName } from '../data/exercises';
import { setTopWeight, setTypeOf } from '../store';
import type { AtlasAction, AskCtx, Tr } from './intentKit';
import { finishedOf, loggedLifts } from './intentKit';
import { findPart, PART_NAME, type BodyPart } from './memory';
import { findMuscle, normalize, tokens } from './nlu';
import { terms } from './retrieve';

export type Flow =
  | {
      kind: 'pain';
      step: PainStep;
      part?: BodyPart | null;
      lift?: string | null;
      when?: 'during' | 'after' | 'nextday';
      feel?: 'sharp' | 'dull' | 'tired';
      level?: 1 | 2 | 3;
      flags?: string[];
      form?: 'bad' | 'ok' | 'unknown';
    }
  | {
      kind: 'find';
      step: 'equipment' | 'muscle' | 'position' | 'pick';
      desc: string;
      asked: string[];
      shown: string[];
    };

type PainStep = 'part' | 'lift' | 'when' | 'feel' | 'level' | 'flags' | 'form';

export interface FlowReply {
  intent: string;
  text: string;
  chips?: string[];
  action?: AtlasAction;
  /** The flow after this reply (null = finished). */
  flow: Flow | null;
}

const has = (ph: string, re: RegExp) => re.test(` ${ph} `);

// ============================================================================
// 1. Pain after training
// ============================================================================

const PAIN_RE =
  /(^|\s)(болить|болять|біль|болі\S*|ниє|ниють|тягне|стріляє|травм\S*|потягнув|потягнула|защемил\S*|болит|боль|болят|pain\S*|hurts?|hurting|ache\S*|injur\S*|tweak\S*|pulled)(\s|$)/u;
const NOT_PAIN_RE =
  /(^|\s)(не болить|не болять|не болит|no pain|doesn.?t hurt|does not hurt|без болю)(\s|$)/u;
/** "Hurt my gains", logging an injury in the app, coming back, pain meds — other topics. */
const NOT_A_REPORT_RE =
  /((hurt\S*|harm\S*) (my |the |your )?(strength|progress|gains|results|growth|muscles?|recovery|performance|testosterone|sleep|bulk|cut)|where (do|can|should) i (put|log|record|add|note)|how (do|can) i (log|record|add|note)|як (записати|внести|додати|відмітити)|де (записати|відмітити|вказати)|числиться|в додатку|in the app|return\S*|coming back|come back|повернен\S*|повернутися|після перерви|after (an |the |my )?(injury|break)|meds|pills|ibuprofen|painkiller\S*|знеболю\S*|таблетк\S*|ібупрофен|types of pain|види болю|який біль нормальний)/u;

/** "My knee hurts after squats" — start the check-in? (Not "my friend's knee".) */
export function painStart(question: string): boolean {
  const ph = normalize(question);
  return has(ph, PAIN_RE) && !has(ph, NOT_PAIN_RE) && !has(ph, NOT_A_REPORT_RE);
}

const PARTS: [BodyPart, [string, string]][] = [
  ['knee', ['Knee', 'Коліно']],
  ['lower_back', ['Lower back', 'Поперек']],
  ['shoulder', ['Shoulder', 'Плече']],
  ['elbow', ['Elbow', 'Лікоть']],
  ['wrist', ['Wrist', 'Зап’ястя']],
  ['neck', ['Neck', 'Шия']],
  ['hip', ['Hip', 'Кульшовий']],
  ['ankle', ['Ankle', 'Гомілкостоп']],
];

/** The injury screen's body parts (hamstring pain is logged as the hip area). */
const INJURY_PART: Record<BodyPart, string> = {
  knee: 'knee',
  lower_back: 'lower_back',
  shoulder: 'shoulder',
  elbow: 'elbow',
  wrist: 'wrist',
  neck: 'neck',
  hip: 'hip',
  ankle: 'ankle',
  hamstring: 'hip',
};

type Fam =
  | 'squat'
  | 'bench'
  | 'deadlift'
  | 'ohp'
  | 'row'
  | 'curl'
  | 'pull'
  | 'dip'
  | 'lunge'
  | 'legpress'
  | 'other';
function family(lift: string | null | undefined): Fam {
  const n = (lift ?? '').toLowerCase();
  if (/leg press/.test(n)) return 'legpress';
  if (/lunge|split squat/.test(n)) return 'lunge';
  if (/squat/.test(n)) return 'squat';
  if (/deadlift|good morning|rdl/.test(n)) return 'deadlift';
  if (/bench|chest press|push.?up/.test(n)) return 'bench';
  if (/military|overhead|shoulder press|arnold/.test(n)) return 'ohp';
  if (/row/.test(n)) return 'row';
  if (/curl/.test(n)) return 'curl';
  if (/pull.?up|chin.?up|pulldown/.test(n)) return 'pull';
  if (/dip/.test(n)) return 'dip';
  return 'other';
}

/** One technique question per lift × area, and the cue if the answer is "yes". */
const FORM: [Fam, BodyPart[], [string, string], [string, string]][] = [
  [
    'squat',
    ['knee'],
    ['Did your knees cave inward on the way up?', 'Коліна на підйомі заходили всередину?'],
    [
      'Push the knees out over the toes the whole rep, a slightly wider stance, and drop the weight 10–20% until it holds.',
      'Тисни коліна назовні по лінії носків увесь повтор, стань трохи ширше й скинь 10–20% ваги, доки не триматиметься.',
    ],
  ],
  [
    'squat',
    ['lower_back', 'hip'],
    ['Did your lower back round at the bottom?', 'Поперек округлювався внизу?'],
    [
      'Brace hard before each rep, stop just above the depth where the back rounds, and build depth back slowly.',
      'Перед кожним повтором сильно напружуй прес, сідай до глибини, де спина ще рівна, і глибину повертай поступово.',
    ],
  ],
  [
    'bench',
    ['shoulder', 'elbow'],
    [
      'Were your elbows flared out wide (close to 90°)?',
      'Лікті були широко розведені, майже під 90°?',
    ],
    [
      'Tuck the elbows to ~45–60°, pinch the shoulder blades, and touch the bar lower, around the nipple line.',
      'Тримай лікті під ~45–60°, зведи лопатки й опускай гриф нижче — приблизно на рівень сосків.',
    ],
  ],
  [
    'deadlift',
    ['lower_back', 'hip', 'hamstring'],
    [
      'Did your back round or the bar drift away from your legs?',
      'Спина округлювалась або гриф відходив від ніг?',
    ],
    [
      'Bar over mid-foot and touching the legs, take the slack out, brace, and push the floor away; drop the weight until every rep looks the same.',
      'Гриф над серединою стопи й впритул до ніг, вибери «люфт», напруж корпус і відштовхуй підлогу; скинь вагу, доки всі повтори не будуть однакові.',
    ],
  ],
  [
    'ohp',
    ['lower_back'],
    ['Were you leaning back a lot to finish the press?', 'Сильно прогинався назад, щоб дотиснути?'],
    [
      'Squeeze the glutes and abs, ribs down, and move the head back so the bar travels straight; lighter until you stop leaning.',
      'Напруж сідниці й прес, ребра вниз, голову трохи назад, щоб гриф ішов прямо; легше, доки не перестанеш прогинатися.',
    ],
  ],
  [
    'ohp',
    ['shoulder', 'neck'],
    [
      'Did it hurt at the very top or when the bar passed your face?',
      'Боліло вгорі чи коли гриф проходив біля обличчя?',
    ],
    [
      'Press a bit in front with a slightly narrower grip, and stop the range just before it hurts; dumbbells with a neutral grip are often easier.',
      'Тисни трохи попереду й вужчим хватом, зупиняйся перед точкою болю; гантелі нейтральним хватом часто переносяться легше.',
    ],
  ],
  [
    'row',
    ['lower_back'],
    [
      'Were you swinging the weight up with your body?',
      'Закидав вагу ривком, розгойдуючись корпусом?',
    ],
    [
      'Lighter and strict: hold the torso angle, pull to the belly; chest-supported rows take the lower back out completely.',
      'Легше й чисто: тримай кут корпусу, тягни до живота; тяга з упором грудьми повністю знімає поперек.',
    ],
  ],
  [
    'curl',
    ['elbow', 'wrist'],
    [
      'Were you using a straight bar or bending your wrists?',
      'Згинав прямим грифом або підгинав зап’ястя?',
    ],
    [
      'Switch to an EZ bar or dumbbells, keep the wrists straight, and slow the lowering.',
      'Перейди на EZ-гриф або гантелі, тримай зап’ястя рівно й повільніше опускай.',
    ],
  ],
  [
    'pull',
    ['elbow', 'shoulder'],
    [
      'Were you doing lots of reps with a narrow or underhand grip?',
      'Робив багато повторів вузьким чи зворотним хватом?',
    ],
    [
      'Use a neutral grip, fewer total reps for 2 weeks, and start each rep by pulling the shoulders down first.',
      'Нейтральний хват, менше повторів загалом на 2 тижні, і кожен повтор починай з того, що опускаєш плечі.',
    ],
  ],
  [
    'dip',
    ['shoulder'],
    ['Were you going very deep at the bottom?', 'Опускався дуже глибоко внизу?'],
    [
      'Stop when the upper arm is parallel to the floor and lean slightly forward; skip dips for 1–2 weeks if it still hurts.',
      'Зупиняйся, коли плече паралельне підлозі, трохи нахили корпус уперед; якщо болить — 1–2 тижні без брусів.',
    ],
  ],
  [
    'lunge',
    ['knee'],
    ['Was the front knee wobbling or caving in?', 'Переднє коліно хиталось чи заходило всередину?'],
    [
      'Shorter range, slower, knee tracking over the middle toes; a split squat holding something for balance is easier to control.',
      'Менша амплітуда, повільніше, коліно по лінії середніх пальців; болгарський присід з опорою рукою легше контролювати.',
    ],
  ],
];

function formQ(fam: Fam, part: BodyPart | null | undefined) {
  if (!part) return null;
  return FORM.find(([f, parts]) => f === fam && parts.includes(part)) ?? null;
}

/** What your log says about that lift: a jump in load last session. */
function loadJump(c: AskCtx, lift: string | null | undefined, L: Tr): string {
  if (!lift) return '';
  const tops: number[] = [];
  for (const w of finishedOf(c)) {
    const ex = w.exercises.find((e) => e.name === lift);
    if (!ex) continue;
    const sets = ex.sets.filter((s) => setTypeOf(s) !== 'warmup');
    if (!sets.length) continue;
    tops.push(Math.max(...sets.map((s) => setTopWeight(s))));
    if (tops.length === 3) break;
  }
  if (tops.length < 2 || !tops[1]) return '';
  const pct = Math.round(((tops[0] - tops[1]) / tops[1]) * 100);
  if (pct < 8) return '';
  return L(
    ` Your log shows a jump: ${c.fmt.kg(tops[1])} → ${c.fmt.kg(tops[0])} (+${pct}%) last session — a big step like that is a common trigger.`,
    ` У журналі видно стрибок: ${c.fmt.kg(tops[1])} → ${c.fmt.kg(tops[0])} (+${pct}%) минулого разу — такий різкий крок часто й дає біль.`,
  );
}

function recentLifts(c: AskCtx): string[] {
  const last = finishedOf(c)[0];
  const names = last ? last.exercises.map((e) => e.name) : [];
  const more = loggedLifts(c)
    .sort((a, b) => b.count - a.count)
    .map((l) => l.name);
  return [...new Set([...names, ...more])].slice(0, 3);
}

/** Read whatever the message already tells (part, lift, timing, feel, level, flags). */
function readPain(
  f: Extract<Flow, { kind: 'pain' }>,
  q: string,
  c: AskCtx,
  exercise: string | null,
) {
  const ph = normalize(q);
  const words = tokens(q);
  const part = findPart(words, ph);
  if (part) f.part = part;
  if (exercise) f.lift = exercise;
  if (has(ph, /(не пов.?язано|не від вправи|not from|unrelated|нічого не робив)/u)) f.lift = null;
  if (has(ph, /(під час|во время|during|mid.?set|у підході|в підході)/u)) f.when = 'during';
  else if (
    has(
      ph,
      /(наступного дня|на наступний день|на другий день|назавтра|next day|day after|на следующий день)/u,
    )
  )
    f.when = 'nextday';
  else if (has(ph, /(після|одразу після|after|после)/u)) f.when ??= 'after';
  if (has(ph, /(гостр\S*|колюч\S*|стріляє|пронизлив\S*|sharp|stabbing|shooting|острая|острый)/u))
    f.feel = 'sharp';
  else if (
    has(
      ph,
      /(як утома|як втома|крепатур\S*|забит\S*|муск|tired|fatigue|doms|like soreness|крепатура)/u,
    )
  )
    f.feel = 'tired';
  else if (has(ph, /(тупий|тупа|ниюч\S*|ниє|dull|aching|achy|ноющ\S*)/u)) f.feel = 'dull';
  const n = /(^|\s)(10|[1-9])(\s*(\/|з|из|of)\s*10)?(\s|$)/u.exec(` ${ph} `);
  if (has(ph, /(1.3|легк\S* біль|трохи|mild|a bit|слегка|немного)/u)) f.level = 1;
  else if (has(ph, /(4.6|середн\S*|moderate|помірн\S*)/u)) f.level = 2;
  else if (has(ph, /(7.10|сильн\S*|дуже болить|нестерпн\S*|severe|really bad|очень)/u)) f.level = 3;
  else if (n && f.step === 'level') f.level = Number(n[2]) <= 3 ? 1 : Number(n[2]) <= 6 ? 2 : 3;
  const flags = f.flags ?? [];
  if (has(ph, /(набряк\S*|набрякл\S*|опух\S*|swell\S*|swollen|отек\S*)/u)) flags.push('swelling');
  if (has(ph, /(онімін\S*|оніміл\S*|поколюв\S*|мурашки|numb\S*|tingl\S*|онемен\S*)/u))
    flags.push('numb');
  if (
    has(
      ph,
      /(не можу (навантажити|стати|підняти|зігнути|розігнути)|can.?t (put weight|bear weight|lift my|bend|straighten)|не могу)/u,
    )
  )
    flags.push('cantload');
  if (has(ph, /(клацає|клацанн\S*|хрусь|хрустить|щелкает|click\S*|pop\S*)/u)) flags.push('click');
  if (
    has(ph, /(нічого з цього|нічого такого|none of|немає|нема|ні$|ничего)/u) &&
    f.step === 'flags'
  )
    flags.push('none');
  if (flags.length) f.flags = [...new Set(flags)];
  if (f.step === 'form') {
    if (has(ph, /(^|\s)(так|да|yes|yeah|було|мабуть так|probably)(\s|$)/u)) f.form = 'bad';
    else if (has(ph, /(^|\s)(ні|нет|no|nope|не було)(\s|$)/u)) f.form = 'ok';
    else f.form = 'unknown';
  }
}

const STEPS: PainStep[] = ['part', 'lift', 'when', 'feel', 'level', 'flags', 'form'];

function nextPain(f: Extract<Flow, { kind: 'pain' }>, c: AskCtx, L: Tr): FlowReply | null {
  // A warning sign already said (swelling, numbness…) — no more questions.
  if ((f.flags ?? []).some((x) => x !== 'none')) return null;
  for (const step of STEPS) {
    if (step === 'part' && !f.part)
      return ask(
        f,
        step,
        L('Where exactly does it hurt?', 'Де саме болить?'),
        PARTS.map(([, n]) => L(n[0], n[1])).concat(L('Somewhere else', 'Інше')),
      );
    if (step === 'lift' && f.lift === undefined) {
      const lifts = recentLifts(c).map((x) => c.fmt.exercise(x));
      return ask(f, step, L('After which exercise did it start?', 'Після якої вправи почалося?'), [
        ...lifts,
        L('Not from an exercise', 'Не пов’язано з вправою'),
      ]);
    }
    if (step === 'when' && !f.when)
      return ask(f, step, L('When does it hurt?', 'Коли болить?'), [
        L('During the set', 'Під час підходу'),
        L('Right after training', 'Одразу після тренування'),
        L('The next day', 'Наступного дня'),
      ]);
    if (step === 'feel' && !f.feel)
      return ask(f, step, L('What does it feel like?', 'Який це біль?'), [
        L('Sharp, stabbing', 'Гострий, колючий'),
        L('Dull, aching', 'Тупий, ниючий'),
        L('Like tired, sore muscle', 'Як утома мʼяза'),
      ]);
    if (step === 'level' && !f.level)
      return ask(f, step, L('How bad, 1 to 10?', 'Наскільки сильно, від 1 до 10?'), [
        '1–3',
        '4–6',
        '7–10',
      ]);
    if (step === 'flags' && !f.flags?.length)
      return ask(f, step, L('Any of these?', 'Є щось із цього?'), [
        L('Swelling', 'Набряк'),
        L('Numbness or tingling', 'Оніміння, поколювання'),
        L("Can't load it", 'Не можу навантажити'),
        L('Clicking with pain', 'Клацає з болем'),
        L('None of these', 'Нічого з цього'),
      ]);
    if (step === 'form' && !f.form) {
      const fq = formQ(family(f.lift), f.part);
      if (fq)
        return ask(f, step, L(fq[2][0], fq[2][1]), [
          L('Yes', 'Так'),
          L('No', 'Ні'),
          L("Don't know", 'Не знаю'),
        ]);
      f.form = 'unknown';
    }
  }
  return null;
}

function ask(
  f: Extract<Flow, { kind: 'pain' }>,
  step: PainStep,
  text: string,
  chips: string[],
): FlowReply {
  return { intent: 'pain', text, chips, flow: { ...f, step } };
}

function verdict(f: Extract<Flow, { kind: 'pain' }>, c: AskCtx, L: Tr): FlowReply {
  const where = f.part ? L(PART_NAME[f.part][0], PART_NAME[f.part][1]) : L('that area', 'цю зону');
  const flags = (f.flags ?? []).filter((x) => x !== 'none');
  const red =
    flags.length > 0 ||
    f.level === 3 ||
    (f.feel === 'sharp' && f.when === 'during' && (f.level ?? 2) >= 2);
  const mild =
    !red &&
    (f.feel === 'tired' || (f.when === 'nextday' && f.feel !== 'sharp')) &&
    (f.level ?? 1) === 1;
  const fq = formQ(family(f.lift), f.part);
  const cue = fq && f.form !== 'ok' ? ` ${L(fq[3][0], fq[3][1])}` : '';
  const log = loadJump(c, f.lift, L);
  const part = f.part ? INJURY_PART[f.part] : null;
  const note = L(
    'I’m not a doctor — this is a training call, not a diagnosis.',
    'Я не лікар — це рішення щодо тренувань, а не діагноз.',
  );
  if (red)
    return {
      intent: 'pain_check',
      text: L(
        `This one should be seen by a doctor or physio — ${flags.length ? 'swelling, numbness, clicking or not being able to load it are signs not to train through' : 'sharp or strong pain during a set is a stop sign'}. Rest ${where} for a few days: no exercises that load it, normal walking is fine.${log}${cue}${part ? ' I can log it as an injury with 5 days of rest — the plan will steer around it.' : ''} ${note}`,
        `Це варто показати лікарю чи фізіотерапевту — ${flags.length ? 'набряк, оніміння, клацання чи неможливість навантажити — ознаки, з якими не тренуються' : 'гострий чи сильний біль під час підходу — сигнал зупинитися'}. Дай зоні «${where}» кілька днів відпочинку: без вправ на неї, звичайна ходьба — можна.${log}${cue}${part ? ' Можу записати це як травму з 5 днями відпочинку — план обходитиме цю зону.' : ''} ${note}`,
      ),
      action: part
        ? {
            type: 'injury',
            bodyPart: part,
            stage: 'protect',
            restDays: 5,
            note: 'Atlas: pain check',
          }
        : undefined,
      flow: null,
    };
  if (mild)
    return {
      intent: 'pain_check',
      text: L(
        `Sounds like normal muscle soreness, not an injury: it peaks 1–2 days after and fades within ~3 days. Light movement, a proper warm-up and sleep help; train ${where} again when it's mostly gone.${log}${cue} If it isn't better in 3–4 days or turns sharp — tell me and we log it.`,
        `Схоже на звичайну крепатуру, а не травму: пік через 1–2 дні, минає десь за 3 дні. Допомагають легкий рух, нормальна розминка й сон; ${where} тренуй знову, коли майже мине.${log}${cue} Якщо за 3–4 дні не краще або біль стане гострим — скажи, запишемо.`,
      ),
      flow: null,
    };
  return {
    intent: 'pain_check',
    text: L(
      `Train around it for 1–2 weeks: cut the load on exercises for ${where} by 30–50% and only use the range that doesn't hurt; pain during a set should stay at 3/10 or lower and be gone by the next day.${log}${cue} If it's not improving in two weeks — see a physio.${part ? ' I can log it as an injury (return stage) so the plan lightens that area by itself.' : ''} ${note}`,
      `1–2 тижні тренуйся в обхід: на вправах для зони «${where}» мінус 30–50% ваги й лише та амплітуда, де не болить; біль під час підходу — не більше 3 з 10 і має минати до наступного дня.${log}${cue} Якщо за два тижні не краще — до фізіотерапевта.${part ? ' Можу записати це в «Травми» (етап повернення) — план сам полегшить цю зону.' : ''} ${note}`,
    ),
    action: part
      ? { type: 'injury', bodyPart: part, stage: 'reintroduce', note: 'Atlas: pain check' }
      : undefined,
    flow: null,
  };
}

export function startPain(q: string, c: AskCtx, exercise: string | null, L: Tr): FlowReply {
  const f: Extract<Flow, { kind: 'pain' }> = { kind: 'pain', step: 'part' };
  readPain(f, q, c, exercise);
  const next = nextPain(f, c, L);
  const lead = L(
    "Don't train through it. Let's figure out what to do — a few quick questions (tap or type).",
    'Через біль не тренуйся. Давай розберемось, що з цим робити, — кілька коротких питань (тапни або напиши).',
  );
  if (next) return { ...next, text: `${lead} ${next.text}` };
  return verdict(f, c, L);
}

function continuePain(
  f: Extract<Flow, { kind: 'pain' }>,
  q: string,
  c: AskCtx,
  exercise: string | null,
  L: Tr,
): FlowReply {
  const g = { ...f };
  // The answer to the question just asked.
  const ph = normalize(q);
  if (g.step === 'lift' && g.lift === undefined) {
    const named =
      exercise ?? recentLifts(c).find((x) => normalize(c.fmt.exercise(x)) === ph) ?? null;
    g.lift = named;
  }
  if (g.step === 'part' && !findPart(tokens(q), ph)) g.part = null;
  const before = JSON.stringify(g);
  readPain(g, q, c, exercise);
  // The reply answered something else ("it was the bench") → ask this step again.
  const field = { when: 'when', feel: 'feel', level: 'level', flags: 'flags' }[g.step as string] as
    'when' | 'feel' | 'level' | 'flags' | undefined;
  if (field && !g[field] && JSON.stringify(g) !== before)
    return nextPain(g, c, L) ?? verdict(g, c, L);
  if (g.step === 'when' && !g.when) g.when = 'after';
  if (g.step === 'feel' && !g.feel) g.feel = 'dull';
  if (g.step === 'level' && !g.level) {
    const n = /(\d+)/.exec(ph);
    g.level = n ? (Number(n[1]) <= 3 ? 1 : Number(n[1]) <= 6 ? 2 : 3) : 2;
  }
  if (g.step === 'flags' && !g.flags?.length) g.flags = ['none'];
  if (g.step === 'part' && g.part === undefined) g.part = null;
  const next = nextPain(g, c, L);
  return next ?? verdict(g, c, L);
}

// ============================================================================
// 2. Find an exercise by description
// ============================================================================

const FIND_RE =
  /(як (вона |воно )?називаєт\S*|як називається|не пам.?ятаю (як|назв)|забув (як|назв)|забула (як|назв)|не знаю (як|назв)|шукаю вправу|знайди вправу|що за вправа|що це за вправа|вправа (де|коли|в якій|у якій)|как называется|не помню (как|назв)|ищу упражнение|что за упражнение|упражнение (где|когда)|what.?s (it|the exercise|that exercise|the one) called|what is (it|the exercise|that exercise) called|exercise where|the one where|find (an|the|me an?) exercise|forgot (the|its) name|don.?t know (the|its) name|what exercise (is|do)|name of (the|an|that) exercise|(яка|що за|якою) вправ\S*( \S+){0,8} \S+(еш|єш|иш|їш)(\s|$)|(which|what) exercise( \S+){0,8} (you|i) (lie|sit|stand|pull|push|hold|lift|kneel|hang)\S*)/u;

export function findStart(question: string): boolean {
  return FIND_RE.test(` ${normalize(question)} `);
}

type Eq = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'kettlebell' | 'bands' | 'body' | 'ezBar';
const EQ: [Eq, RegExp, [string, string]][] = [
  ['barbell', /(штанг\S*|гриф\S*|barbell|bar(\s|$))/u, ['Barbell', 'Штанга']],
  ['ezBar', /(ez|ізогн\S* гриф|вигнут\S* гриф|w.?гриф)/u, ['EZ bar', 'EZ-гриф']],
  ['dumbbell', /(гантел\S*|dumbbell\S*|db(\s|$))/u, ['Dumbbells', 'Гантелі']],
  ['cable', /(блок\S*|трос\S*|кросовер|кроссовер|cable\S*|pulley|rope)/u, ['Cable', 'Блок / трос']],
  ['machine', /(тренажер\S*|машин\S*|machine|смiт|сміт\S*|smith)/u, ['Machine', 'Тренажер']],
  ['kettlebell', /(гир\S*|kettlebell\S*)/u, ['Kettlebell', 'Гиря']],
  ['bands', /(резинк\S*|стрічк\S*|еспандер\S*|band\S*)/u, ['Band', 'Резинка']],
  [
    'body',
    /(власн\S* вага|без ваги|без обтяження|турнік\S*|бруси|брусах|свой вес|bodyweight|body weight|no equipment|pull.?up bar|parallel bars)/u,
    ['Bodyweight', 'Власна вага'],
  ],
];

type Pos =
  'lying' | 'seated' | 'standing' | 'bent' | 'incline' | 'decline' | 'kneeling' | 'hanging';
const POS: [Pos, RegExp, RegExp, [string, string]][] = [
  ['incline', /(похил\S*|під кутом|incline)/u, /incline/i, ['Incline', 'На похилій лаві']],
  ['decline', /(головою вниз|decline|зворотн\S* нахил)/u, /decline/i, ['Decline', 'Головою вниз']],
  [
    'lying',
    /(лежач\S*|лежить|лягаєш|ляжеш|на лаві|на спині|на животі|лежа|lying|lie down|on (a|the) bench|on my back|flat)/u,
    /lying|bench|flat|floor|supine|prone/i,
    ['Lying down', 'Лежачи'],
  ],
  ['seated', /(сидяч\S*|сидиш|сидя|seated|sitting|sit)/u, /seated|sitting/i, ['Seated', 'Сидячи']],
  ['standing', /(стоячи|стоїш|стоя|standing|stand)/u, /standing/i, ['Standing', 'Стоячи']],
  [
    'bent',
    /(в нахилі|у нахилі|нахил\S*|bent over|bent|hinge)/u,
    /bent|bent-over|good morning|romanian|stiff/i,
    ['Bent over', 'У нахилі'],
  ],
  [
    'kneeling',
    /(на колінах|стоячи на колінах|kneel\S*|на коленях)/u,
    /kneel/i,
    ['Kneeling', 'На колінах'],
  ],
  ['hanging', /(у висі|в висі|висиш|висячи|hang\S*|вися)/u, /hang/i, ['Hanging', 'У висі']],
];

type Move =
  | 'press'
  | 'pull'
  | 'curl'
  | 'extension'
  | 'fly'
  | 'squat'
  | 'lunge'
  | 'hinge'
  | 'crunch'
  | 'raise'
  | 'shrug'
  | 'pullover'
  | 'lateral'
  | 'legRaise'
  | 'facePull';
const MOVE: [Move, RegExp, RegExp][] = [
  [
    'lateral',
    /(в сторони|в сторону|у сторони|через сторони|розводиш руки|lateral|to the sides?|sideways|out to the side\S*)/u,
    /lateral|side/i,
  ],
  [
    'legRaise',
    /((підніма\S*|піднімаєш|підйом\S*|raise\S*|lift\S*) (\S+ )?(ноги|ніг|коліна|legs?|knees)|(ноги|коліна|legs|knees) (\S+ )?(вгору|до грудей|up))/u,
    /leg raise|knee raise|knee tuck/i,
  ],
  ['facePull', /(до обличчя|до лиця|to (my|your|the) face|face ?pull|канат\S* до)/u, /face pull/i],
  [
    'pullover',
    /(пуловер\S*|за голову|over (my|your|the) head|behind (the|your) head|pullover)/u,
    /pullover/i,
  ],
  ['press', /(жим\S*|жмеш|жати|вижима\S*|штовха\S*|press\S*|push\S*)/u, /press|push/i],
  ['pull', /(тяга|тягнеш|тягти|тягнути|підтяг\S*|тянешь|тяну|row\S*|pull\S*)/u, /row|pull|chin/i],
  ['curl', /(згинанн\S*|згина\S*|на біцепс|curl\S*)/u, /curl/i],
  [
    'extension',
    /(розгинанн\S*|розгина\S*|французьк\S*|extension\S*|kickback|skull)/u,
    /extension|kickback|skull|pushdown/i,
  ],
  [
    'fly',
    /(розведенн\S*|розводиш|зведенн\S*|зводиш|метелик|fly|flye\S*|pec deck)/u,
    /fly|flye|pec deck|crossover/i,
  ],
  ['squat', /(присід\S*|присіда\S*|squat\S*)/u, /squat/i],
  ['lunge', /(випад\S*|lunge\S*|болгарськ\S*|split)/u, /lunge|split/i],
  [
    'hinge',
    /(станов\S*|мертв\S* тяг|deadlift\S*|hinge|good morning|гуд монінг)/u,
    /deadlift|good morning|romanian|stiff/i,
  ],
  [
    'crunch',
    /(скручуванн\S*|скручу\S*|прес\b|crunch\S*|sit.?up\S*|abs)/u,
    /crunch|sit-up|sit up|twist/i,
  ],
  ['raise', /(підйом\S*|піднімаєш|махи|маховi|raise\S*|lift\S* (up|to))/u, /raise/i],
  ['shrug', /(шраг\S*|знизуванн\S*|плечима вгору|shrug\S*)/u, /shrug/i],
];

const MUSCLE_CHIPS: [MuscleGroup, [string, string]][] = [
  ['chest', ['Chest', 'Груди']],
  ['lats', ['Back', 'Спина']],
  ['quads', ['Legs', 'Ноги']],
  ['shoulders', ['Shoulders', 'Плечі']],
  ['biceps', ['Biceps', 'Біцепс']],
  ['triceps', ['Triceps', 'Трицепс']],
  ['core', ['Abs / core', 'Прес']],
  ['glutes', ['Glutes', 'Сідниці']],
];
const MUSCLE_FAMILY: Partial<Record<MuscleGroup, MuscleGroup[]>> = {
  lats: ['lats', 'back', 'middle_back' as MuscleGroup, 'lower_back', 'traps'],
  back: ['lats', 'back', 'middle_back' as MuscleGroup, 'lower_back', 'traps'],
  quads: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  core: ['core', 'abs' as MuscleGroup, 'obliques' as MuscleGroup],
};

interface Feat {
  eq: Eq | null;
  pos: Pos[];
  move: Move[];
  muscle: MuscleGroup | null;
  words: Set<string>;
}

function features(desc: string): Feat {
  const ph = ` ${normalize(desc)} `;
  return {
    eq: EQ.find(([, re]) => re.test(ph))?.[0] ?? null,
    pos: POS.filter(([, re]) => re.test(ph)).map(([p]) => p),
    move: MOVE.filter(([, re]) => re.test(ph)).map(([m]) => m),
    muscle: findMuscle(tokens(desc), normalize(desc)),
    words: new Set(terms(desc)),
  };
}

let CANDS:
  | {
      name: string;
      eq: string | null;
      muscles: MuscleGroup[];
      strength: boolean;
      words: Set<string>;
    }[]
  | null = null;
function candidates() {
  if (CANDS) return CANDS;
  CANDS = [];
  const seen = new Set<string>();
  for (const ex of BUILT_IN_CATALOG) {
    const name = ex.names[0];
    if (seen.has(name)) continue;
    seen.add(name);
    const rich = richExerciseByName(name);
    const cat = rich?.category ?? 'strength';
    CANDS.push({
      name,
      eq: rich?.equipment ?? ex.equipment ?? null,
      muscles: rich ? [...rich.primaryMuscles, ...rich.secondaryMuscles.slice(0, 1)] : [ex.muscle],
      strength: cat === 'strength' || cat === 'powerlifting',
      words: new Set(ex.names.flatMap((n) => terms(n))),
    });
  }
  return CANDS;
}

function score(f: Feat): { name: string; s: number }[] {
  const fam = f.muscle ? (MUSCLE_FAMILY[f.muscle] ?? [f.muscle]) : null;
  return candidates()
    .map((c) => {
      let s = c.strength ? 0.5 : 0;
      if (f.eq) s += c.eq === f.eq || (f.eq === 'barbell' && c.eq === 'ezBar') ? 3 : -2;
      if (fam)
        s += c.muscles.some((m) => fam.includes(m)) ? (fam.includes(c.muscles[0]) ? 3 : 1.5) : -2;
      for (const p of f.pos) {
        const re = POS.find(([x]) => x === p)![2];
        s += re.test(c.name) ? 2 : 0;
      }
      for (const m of f.move) {
        const re = MOVE.find(([x]) => x === m)![2];
        // The very specific movements say more than the muscle guess.
        s += re.test(c.name)
          ? m === 'lateral' || m === 'legRaise' || m === 'facePull'
            ? 5
            : 2.5
          : 0;
      }
      let hit = 0;
      for (const w of f.words) if (c.words.has(w)) hit++;
      s += Math.min(3, hit * 1.2);
      return { name: c.name, s };
    })
    .sort((a, b) => b.s - a.s);
}

function findReply(fl: Extract<Flow, { kind: 'find' }>, c: AskCtx, L: Tr): FlowReply {
  const f = features(fl.desc);
  const ranked = score(f).filter((x) => !fl.shown.includes(x.name));
  const known =
    (f.eq ? 1 : 0) + (f.muscle ? 1 : 0) + (f.pos.length ? 1 : 0) + (f.move.length ? 1 : 0);
  const clear = ranked.length > 3 && ranked[0].s - (ranked[3]?.s ?? 0) >= 2;
  // Ask for what's missing — up to three questions — unless it's already clear.
  if (!(known >= 3 || clear || fl.asked.length >= 3)) {
    if (!f.eq && !fl.asked.includes('equipment'))
      return {
        intent: 'find_exercise',
        text: L('What did you use?', 'З чим ти її робив?'),
        chips: EQ.filter(([e]) => e !== 'ezBar').map(([, , n]) => L(n[0], n[1])),
        flow: { ...fl, step: 'equipment', asked: [...fl.asked, 'equipment'] },
      };
    if (!f.muscle && !fl.asked.includes('muscle'))
      return {
        intent: 'find_exercise',
        text: L('Which muscle did it work?', 'Який мʼяз вона качає?'),
        chips: MUSCLE_CHIPS.map(([, n]) => L(n[0], n[1])),
        flow: { ...fl, step: 'muscle', asked: [...fl.asked, 'muscle'] },
      };
    if (!f.pos.length && !fl.asked.includes('position'))
      return {
        intent: 'find_exercise',
        text: L('And your position?', 'А в якому положенні?'),
        chips: POS.filter(([p]) =>
          ['lying', 'seated', 'standing', 'bent', 'incline'].includes(p),
        ).map(([, , , n]) => L(n[0], n[1])),
        flow: { ...fl, step: 'position', asked: [...fl.asked, 'position'] },
      };
  }
  const top = ranked.slice(0, 4);
  if (!top.length || top[0].s <= 1)
    return {
      intent: 'find_exercise',
      text: L(
        'Nothing close in the library yet. Describe the movement in other words — what moves, where the weight goes.',
        'У бібліотеці нічого близького не знайшов. Опиши рух інакше — що рухається й куди йде вага.',
      ),
      flow: { ...fl, step: 'pick' },
    };
  const names = top.map((x) => c.fmt.exercise(x.name));
  return {
    intent: 'find_exercise',
    text: L('Is it one of these?', 'Це одна з цих?'),
    chips: [...names, L('None of these', 'Ні, не те')],
    flow: { ...fl, step: 'pick', shown: [...fl.shown, ...top.map((x) => x.name)] },
  };
}

export function startFind(q: string, c: AskCtx, L: Tr): FlowReply {
  return findReply({ kind: 'find', step: 'equipment', desc: q, asked: [], shown: [] }, c, L);
}

function continueFind(
  fl: Extract<Flow, { kind: 'find' }>,
  q: string,
  c: AskCtx,
  L: Tr,
): FlowReply | null {
  const ph = normalize(q);
  if (fl.step === 'pick') {
    const picked = fl.shown.find((n) => normalize(c.fmt.exercise(n)) === ph || normalize(n) === ph);
    if (picked) {
      const rich = richExerciseByName(picked);
      const muscles = (rich?.primaryMuscles ?? []).map((m) => c.fmt.muscle(m)).join(', ');
      const nm = c.fmt.exercise(picked);
      return {
        intent: 'find_exercise',
        text: L(
          `That's ${nm}${muscles ? ` — works ${muscles}` : ''}. You'll find it by that name when you add an exercise.`,
          `Це ${nm}${muscles ? ` — працюють ${muscles}` : ''}. Під цією назвою її й знайдеш, коли додаватимеш вправу.`,
        ),
        chips: [
          L(`${nm}: technique tips?`, `${nm}: техніка?`),
          L(`What can replace ${nm}?`, `Чим замінити ${nm}?`),
        ],
        flow: null,
      };
    }
    if (/(^|\s)(ні|не те|none|no|нет|не то)(\s|$)/u.test(` ${ph} `))
      return findReply({ ...fl, asked: fl.asked }, c, L);
  }
  // An answer to "with what / which muscle / position" — or more description.
  // (After an offer, a new detail re-ranks everything — the offer wasn't rejected.)
  return findReply(
    { ...fl, desc: `${fl.desc} ${q}`, shown: fl.step === 'pick' ? [] : fl.shown },
    c,
    L,
  );
}

// ============================================================================

/** Continue whichever flow is running. Null = the message isn't part of it. */
export function continueFlow(
  f: Flow,
  q: string,
  c: AskCtx,
  exercise: string | null,
  L: Tr,
): FlowReply | null {
  const ph = normalize(q);
  if (
    /(^|\s)(стоп|скасуй|досить|забудь|cancel|stop|never ?mind|отмена|хватит)(\s|$)/u.test(` ${ph} `)
  )
    return { intent: 'flow_cancel', text: L('Okay, dropped it.', 'Добре, облишимо.'), flow: null };
  if (f.kind === 'pain') return continuePain(f, q, c, exercise, L);
  return continueFind(f, q, c, L);
}
