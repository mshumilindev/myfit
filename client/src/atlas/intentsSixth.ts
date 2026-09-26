/**
 * Atlas's answer base, part six — depth where it matters most:
 *  - technique for ~35 main lifts (cues → mistakes → deeper; "why?" explains);
 *  - injuries: body-part layers for pain, return to training, red flags;
 *  - nutrition: calories from YOUR bodyweight and goal, carbs, fats, meals,
 *    before/after training, plant-based, sugar, late eating, electrolytes.
 * General coaching information, not medical or dietetic advice.
 */
import { latestWeight } from '../store';
import { techFor } from './technique';
import { findPart, type BodyPart } from './memory';
import type { Intent, Tr } from './intentKit';

const WORKOUT = [
  'workout*',
  'training',
  'gym',
  'session',
  'lifting',
  'тренуван*',
  'заняття',
  'зал',
  'залу',
  'тренировк*',
];

// ---- technique -------------------------------------------------------------------

const TECH_WORDS = [
  'technique',
  'form',
  'how to do',
  'how do i do',
  'how to perform',
  'cues',
  'mistake*',
  'correctly',
  'properly',
  'техні*',
  'як правильно',
  'як робити',
  'помилк*',
  'правильно',
  'как делать',
  'как правильно',
  'техник*',
  'ошибк*',
];

// ---- pain layers by body part ---------------------------------------------------------

const PAIN_MORE: Record<BodyPart | 'any', [string, string][]> = {
  any: [
    [
      'This week: train everything that doesn’t hurt, keep the painful movement out or pain-free (0–3 of 10). Movement helps more than rest.',
      'Цього тижня: тренуй усе, що не болить, а болісний рух прибери або роби без болю (0–3 з 10). Рух допомагає більше, ніж спокій.',
    ],
    [
      'Coming back: start at ~50% of the old weight, add 10–20% a week while it stays quiet the next morning.',
      'Повернення: з ~50% старої ваги, +10–20% на тиждень, якщо наступного ранку спокійно.',
    ],
    [
      'See a doctor if there’s swelling, numbness, night pain, a pop at the moment it happened, or no improvement in 2 weeks.',
      'До лікаря — якщо набряк, оніміння, біль уночі, «клацання» в момент травми або за 2 тижні не краще.',
    ],
  ],
  lower_back: [
    [
      'Lower back, this week: walk daily, try McGill curl-ups, side planks and bird-dogs; swap deadlifts and rows for leg press and chest-supported rows.',
      'Поперек, цього тижня: щодня ходи, «McGill curl-up», бічна планка, «пташка-собака»; станову й тяги в нахилі заміни на жим ногами й тягу з упором грудьми.',
    ],
    [
      'Back to hinging: RDLs with a light bar, then trap-bar pulls, then your deadlift at 50–60%. Brace every rep.',
      'Повернення до нахилів: румунська тяга з легким грифом, потім тяга з трап-грифом, потім станова з 50–60%. Напружуй корпус щоразу.',
    ],
    [
      "Red flags: numbness in the groin or between the legs, new trouble peeing or controlling the bladder/bowel, or a weak, dragging foot — emergency now (112 / 911). Pain running below the knee, fever, or pain that's worse at night — see a doctor within days.",
      'Тривожні ознаки: оніміння в паху чи між ногами, нові проблеми із сечовипусканням або контролем сечового міхура/кишківника, слабка стопа, що «шльопає», — невідкладно, 103 або 112. Біль, що йде нижче коліна, температура чи біль, сильніший уночі, — до лікаря протягом кількох днів.',
    ],
  ],
  knee: [
    [
      'Knee, this week: box squats to a pain-free depth, leg press partials, spanish squats or wall sits; skip deep lunges and jumps.',
      'Коліно, цього тижня: присід на лаву до глибини без болю, жим ногами неповний, «іспанський присід» чи стілець біля стіни; без глибоких випадів і стрибків.',
    ],
    [
      'Build back: slow tempo squats (3 s down), then full depth, then load. Tendon pain likes steady, heavy-ish isometrics.',
      'Відновлення: повільний присід (3 с вниз), далі повна глибина, потім вага. Біль у сухожиллі любить рівномірні доволі важкі статичні утримання.',
    ],
    [
      'Red flags: locking, giving way, swelling after a twist — get it checked.',
      'Тривожні ознаки: коліно «заклинює», підгинається, набрякло після скручування — на огляд.',
    ],
  ],
  shoulder: [
    [
      'Shoulder, this week: no overhead pressing or dips; landmine press, neutral-grip dumbbells, cable rows, face pulls, band external rotations.',
      'Плече, цього тижня: без жимів над головою й брусів; «лендмайн», гантелі нейтральним хватом, тяги на блоці, face pull, зовнішня ротація з резинкою.',
    ],
    [
      'Build back: floor press, then bench with a narrower grip and a 1-s pause, then overhead once raising the arm is pain-free.',
      'Відновлення: жим з підлоги, далі жим лежачи вужчим хватом з паузою 1 с, над головою — коли підйом руки вже без болю.',
    ],
    [
      'Red flags: can’t lift the arm, night pain lying on it, weakness after a fall — get it checked.',
      'Тривожні ознаки: не можеш підняти руку, болить уночі лежачи на ній, слабкість після падіння — на огляд.',
    ],
  ],
  elbow: [
    [
      'Elbow, this week: neutral grips, no skull-crushers or heavy chin-ups; slow wrist extensions/curls with a light dumbbell help tendons.',
      'Лікоть, цього тижня: нейтральний хват, без французького жиму й важких підтягувань зворотним хватом; повільні розгинання/згинання кисті з легкою гантеллю допомагають сухожиллям.',
    ],
    [
      'Build back over 4–8 weeks: tendons adapt slower than muscle. Straps take the grip off it.',
      'Відновлення 4–8 тижнів: сухожилля адаптуються повільніше за м’язи. Лямки знімають навантаження з хвату.',
    ],
    [
      'Red flags: a pop with a sudden bruise on the arm — see a doctor quickly.',
      'Тривожні ознаки: «клацання» з раптовим синцем на руці — до лікаря швидко.',
    ],
  ],
  wrist: [
    [
      'Wrist, this week: wraps, straight-wrist grips, dumbbells or cables instead of a straight bar; push-ups on fists or handles.',
      'Зап’ястя, цього тижня: бинти, рівне зап’ястя, гантелі чи блок замість прямого грифа; віджимання на кулаках чи упорах.',
    ],
    [
      'Build back: light wrist curls and extensions, then back to the bar with wraps.',
      'Відновлення: легкі згинання й розгинання кисті, потім назад до грифа з бинтами.',
    ],
    [
      'Red flags: pain in the “snuffbox” at the base of the thumb after a fall — X-ray.',
      'Тривожні ознаки: біль біля основи великого пальця після падіння — рентген.',
    ],
  ],
  neck: [
    [
      'Neck, this week: no shrugs or overhead; chin tucks, gentle range of motion, keep the head neutral in every lift.',
      'Шия, цього тижня: без шрагів і над головою; прибирай підборіддя, легкий рух, голова нейтрально в кожній вправі.',
    ],
    [
      'Build back gradually; heavy pulls last.',
      'Повертайся поступово; важкі тяги — в останню чергу.',
    ],
    [
      'Red flags: pain, numbness or weakness down the arm — see a doctor. A sudden severe headache, dizziness with vision or speech problems, or neck pain after a fall or a hit — emergency (112 / 911).',
      'Тривожні ознаки: біль, оніміння чи слабкість, що йдуть у руку, — до лікаря. Раптовий сильний головний біль, запаморочення з порушенням зору чи мови, біль у шиї після падіння чи удару — невідкладно, 103 або 112.',
    ],
  ],
  hip: [
    [
      'Hip, this week: glute bridges, side-lying leg raises, a narrower stance, shallower squats; avoid deep flexion that pinches.',
      'Кульшовий, цього тижня: сідничний міст, відведення ноги лежачи на боці, вужча стійка, мілкіший присід; без глибокого згинання, що «защемлює».',
    ],
    [
      'Build back: widen the stance and deepen the squat only as far as it stays pain-free.',
      'Відновлення: ширша стійка й глибший присід — лише доки без болю.',
    ],
    [
      'Red flags: groin pain with limping, night pain — get it checked.',
      'Тривожні ознаки: біль у паху з кульганням, біль уночі — на огляд.',
    ],
  ],
  ankle: [
    [
      'Ankle, this week: seated and machine work, no jumps or running; calf raises and gentle ankle circles if pain-free.',
      'Гомілкостоп, цього тижня: вправи сидячи й на тренажерах, без стрибків і бігу; підйоми на литки й м’які кола стопою, якщо без болю.',
    ],
    [
      'Build back: balance on one leg, then single-leg calf raises, then running.',
      'Відновлення: баланс на одній нозі, потім підйоми на литку однією, потім біг.',
    ],
    [
      'Red flags: can’t take 4 steps, bone pain on the ankle bones — X-ray.',
      'Тривожні ознаки: не можеш зробити 4 кроки, болить сама кісточка — рентген.',
    ],
  ],
  hamstring: [
    [
      'Hamstring, this week: no sprints or heavy RDLs; light bridges and isometric holds pain-free.',
      'Задня поверхня, цього тижня: без спринтів і важкої румунської тяги; легкий міст і статичні утримання без болю.',
    ],
    [
      'Build back: slow leg curls, then RDLs light, then Nordic curls — over 3–6 weeks.',
      'Відновлення: повільні згинання ніг, потім легка румунська тяга, потім «нордичні» — за 3–6 тижнів.',
    ],
    [
      'Red flags: a pop with a big bruise at the back of the thigh — see a doctor.',
      'Тривожні ознаки: «клацання» з великим синцем на задній поверхні — до лікаря.',
    ],
  ],
};

/** "Tell me more" layers for pain — by the body part in the thread. */
export function painMore(words: string[], phrase: string, depth: number, L: Tr): string | null {
  const part = findPart(words, phrase) ?? 'any';
  const layer = PAIN_MORE[part][depth] ?? PAIN_MORE.any[depth];
  return layer ? L(layer[0], layer[1]) : null;
}

// ---- intents ------------------------------------------------------------------------

export const INTENTS_SIXTH: Intent[] = [
  {
    id: 'technique_lift',
    all: [TECH_WORDS],
    needs: 'exercise',
    answer: (c, p, L) => {
      const card = techFor(p.exercise!);
      const name = c.fmt.exercise(p.exercise!);
      if (!card)
        return L(
          `${name}: control the lowering, full range you own, no swinging. Open it in the library for photos and the Learn video — and film a set from the side.`,
          `${name}: контрольоване опускання, повна амплітуда, яку контролюєш, без ривків. Відкрий у бібліотеці — там фото й відео з Learn, і зніми сет збоку.`,
        );
      return `${name}: ${L(card.cues[0], card.cues[1])}`;
    },
    more: (c, p, L, depth) => {
      if (!p.exercise) return null;
      const card = techFor(p.exercise);
      if (!card) return null;
      const layers = [card.mistakes, card.deeper];
      const x = layers[depth];
      if (!x) return null;
      return depth === 0 ? L(`Common mistakes: ${x[0]}`, `Типові помилки: ${x[1]}`) : L(x[0], x[1]);
    },
    why: (_c, p, L) => {
      const card = p.exercise ? techFor(p.exercise) : null;
      return card ? L(card.why[0], card.why[1]) : null;
    },
    suggest: (L) => [
      L('Common mistakes?', 'Типові помилки?'),
      L('Why?', 'Чому?'),
      L('What muscles does it work?', 'Які м’язи працюють?'),
    ],
  },
  // ---- injuries ----
  {
    id: 'pain_types',
    all: [
      [
        'sharp',
        'dull',
        'burning',
        'stabbing',
        'гострий',
        'гостра',
        'ниючий',
        'тупий',
        'пекучий',
        'острая',
        'ноющая',
        'тупая',
      ],
      ['pain', 'біль', 'боль', 'болить', 'hurt*'],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Dull, spread-out ache in the muscle that shows up a day later and fades in 2–4 days — normal soreness. Sharp, in a joint, getting worse with load, or with swelling — stop that lift and log it in Injury. Numbness, pain shooting down a limb, or pain at night — see a doctor.',
        'Тупий розлитий біль у м’язі, що з’являється наступного дня й минає за 2–4 дні, — звичайна крепатура. Гострий, у суглобі, гіршає з вагою або з набряком — зупини вправу й запиши в «Травми». Оніміння, біль, що стріляє в руку чи ногу, або біль уночі — до лікаря.',
      ),
  },
  {
    id: 'return_injury',
    all: [
      [
        'return',
        'get back',
        'come back',
        'start again',
        'when can i',
        'повернут*',
        'повертат*',
        'коли можна',
        'вернуться',
        'когда можно',
      ],
      ['injur*', 'травм*', 'pain', 'болю', 'біль', 'hurt*', 'після травм*'],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        "When everyday movement is pain-free: start at ~50% of the old weight, add 10–20% a week if it's quiet the next morning. After surgery, a fracture or a concussion, your doctor or physio sets the timeline. The Injury screen runs this for you stage by stage.",
        'Коли звичайні рухи без болю: почни з ~50% старої ваги, +10–20% на тиждень, якщо наступного ранку спокійно. Після операції, перелому чи струсу мозку терміни визначає лікар або фізіотерапевт. Екран «Травми» веде це поетапно.',
      ),
    more: (_c, p, L, depth) => painMore(p.words, p.phrase, depth + 1, L),
  },
  {
    id: 'ice_heat',
    all: [
      ['ice', 'heat', 'heating pad', 'лід', 'льод', 'тепло', 'грілк*', 'лед', 'холод', 'cold pack'],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Fresh knock or swelling: short cold for comfort (10–15 min). Stiff, achy muscles: heat. Neither heals it — easy movement does.',
        'Свіжий удар чи набряк: коротко холод для полегшення (10–15 хв). Скуті, ниючі м’язи: тепло. Лікує ж не це, а легкий рух.',
      ),
  },
  {
    id: 'painkillers',
    all: [
      [
        'painkiller*',
        'ibuprofen',
        'nsaid*',
        'paracetamol',
        'знеболювальн*',
        'знеболююч*',
        'ібупрофен*',
        'обезбол*',
        'таблетк*',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Don’t take painkillers to train through pain — the pain is the signal you need. Ask a doctor or pharmacist about what’s right for you.',
        'Не пий знеболювальне, щоб тренуватися крізь біль, — біль і є потрібний сигнал. Що саме тобі підходить — спитай лікаря чи фармацевта.',
      ),
  },
  {
    id: 'tendon',
    all: [['tendon*', 'tendinitis', 'tendinopathy', 'сухожил*', 'тендиніт*', 'тендинопат*']],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Tendons like steady load, not rest: slow, heavy-ish reps or holds, 3–4 times a week, for 6–12 weeks or more. Pain up to 3/10 during is OK if it settles by the next morning. A sudden pop or snap with weakness (Achilles, biceps) is different — see a doctor within days.',
        'Сухожилля люблять рівномірне навантаження, а не спокій: повільні досить важкі повтори чи утримання, 3–4 рази на тиждень, 6–12 тижнів і довше. Біль під час — до 3/10 нормально, якщо до ранку минає. Раптовий хлопок чи «клацання» зі слабкістю (ахіл, біцепс) — інша історія: до лікаря протягом кількох днів.',
      ),
  },
  {
    id: 'cramps',
    all: [['cramp*', 'судом*', 'спазм*', 'зводить']],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        "Cramps mid-set: stop, stretch the muscle gently until it lets go. They're usually fatigue — if they keep coming, check sleep, fluids and food. See a doctor if cramps are frequent at rest, start with a new medication, or a calf stays painful, swollen or warm afterwards.",
        'Судома посеред сету: зупинись і м’яко розтягни м’яз, доки не відпустить. Зазвичай це втома — якщо повторюється, перевір сон, воду й харчування. До лікаря — якщо судоми часті в спокої, почалися з новими ліками або литка й після цього болить, набрякла чи гаряча.',
      ),
  },
  {
    id: 'numbness',
    all: [
      [
        'numb',
        'numbness',
        'numbed',
        'tingl*',
        'pins and needles',
        'оніміння',
        'німіє',
        'поколюв*',
        'немеет',
        'онемен*',
        'мурашк*',
      ],
    ],
    neutral: true,
    priority: true,
    answer: (_c, _p, L) =>
      L(
        'Numbness or tingling usually means a nerve or blood flow is being irritated — not a muscle problem. Stop the lift that brings it on and loosen anything tight (wraps, belt). If it stays, spreads or comes with weakness — see a doctor. Sudden numbness of the face or one side of the body, or numbness in the groin — call 112 / 911 now.',
        'Оніміння чи поколювання зазвичай означає, що подразнений нерв або порушений кровотік, — це не про м’яз. Зупини вправу, яка це викликає, і послаб усе тісне (бинти, пояс). Якщо не минає, поширюється чи є слабкість — до лікаря. Раптове оніміння обличчя чи половини тіла або оніміння в паху — одразу 103 або 112.',
      ),
  },

  // ---- nutrition ----
  {
    id: 'calories',
    all: [['calorie*', 'kcal', 'калорі*', 'калорий', 'ккал', 'калораж*', 'kalori*']],
    neutral: true,
    answer: (c, _p, L) => {
      const bw = latestWeight(c.s.bodyMetrics)?.weight;
      if (!bw)
        return L(
          'Log your bodyweight and I’ll estimate your calories. Rough rule: ~30–33 kcal per kg for an active lifter.',
          'Запиши вагу — порахую калорії. Орієнтир: ~30–33 ккал на кг для людини, що тренується.',
        );
      const lo = Math.round((bw * 29) / 50) * 50;
      const hi = Math.round((bw * 33) / 50) * 50;
      const g = c.mem?.goal?.v;
      const tail =
        g === 'fat_loss'
          ? L(
              ` For your fat-loss goal: ~${Math.max(lo - 400, 1200)}–${Math.max(hi - 400, Math.max(lo - 400, 1200) + 200)} — don't go lower without a dietitian.`,
              ` Для твоєї мети — схуднення: ~${Math.max(lo - 400, 1200)}–${Math.max(hi - 400, Math.max(lo - 400, 1200) + 200)}; нижче — лише з дієтологом.`,
            )
          : g === 'muscle'
            ? L(
                ` For your muscle goal: ~${lo + 250}–${hi + 250}.`,
                ` Для твоєї мети — м’язи: ~${lo + 250}–${hi + 250}.`,
              )
            : '';
      return L(
        `At ${c.fmt.kg(bw)}, maintenance is roughly ${lo}–${hi} kcal a day.${tail} Watch the scale for 2 weeks and adjust by 200.`,
        `При ${c.fmt.kg(bw)} підтримка — приблизно ${lo}–${hi} ккал на день.${tail} Два тижні дивись на ваги й коригуй на 200.`,
      );
    },
  },
  {
    id: 'cut_deficit',
    all: [
      ['deficit', 'дефіцит*', 'дефицит*', 'how fast lose', 'як швидко схуд*', 'скільки скидати'],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'A 300–500 kcal deficit, losing 0.5–1% of bodyweight a week. Keep lifting heavy and protein at ~2 g/kg — that’s what keeps the muscle.',
        'Дефіцит 300–500 ккал, мінус 0,5–1% ваги на тиждень. Далі важко тренуйся й тримай білок ~2 г/кг — саме це зберігає м’язи.',
      ),
  },
  {
    id: 'bulk_surplus',
    all: [
      [
        'surplus',
        'lean bulk',
        'dirty bulk',
        'профіцит*',
        'профицит*',
        'чистий набір',
        'брудний набір',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Small surplus: +200–300 kcal, gaining ~0.25–0.5% of bodyweight a month (more if you’re new). Faster mostly adds fat.',
        'Невеликий профіцит: +200–300 ккал, +0,25–0,5% ваги на місяць (новачкам більше). Швидше — здебільшого жир.',
      ),
  },
  {
    id: 'carbs',
    all: [['carb*', 'вуглевод*', 'углевод*', 'rice', 'pasta', 'рис', 'макарон*', 'вівсянк*']],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Carbs fuel hard sets: ~3–5 g/kg a day works for most lifters, more of it around training. Low-carb works for fat loss if you like it, but sessions may feel flatter.',
        'Вуглеводи — паливо для важких сетів: ~3–5 г/кг на день підходить більшості, більше — навколо тренування. Низьковуглеводна дієта теж працює для схуднення, якщо подобається, але тренування можуть бути «пласкішими».',
      ),
  },
  {
    id: 'fats',
    all: [
      [
        'dietary fat',
        'fats',
        'fat intake',
        'omega*',
        'fish oil',
        'жири',
        'жирів',
        'омега*',
        'риб’ячий жир',
        'рибячий жир',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Fats: ~0.6–1 g/kg a day, mostly from olive oil, nuts, eggs and fish. Two fish meals a week cover omega-3 for most people.',
        'Жири: ~0,6–1 г/кг на день, здебільшого з оливкової олії, горіхів, яєць і риби. Дві рибні страви на тиждень покривають омега-3 для більшості.',
      ),
  },
  {
    id: 'pre_meal',
    all: [
      ['eat', 'meal', 'food', 'їсти', 'їжа', 'поїсти', 'їм', 'есть', 'кушать', 'поесть'],
      ['before', 'перед', 'до', 'pre'],
      WORKOUT,
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        '1–3 h before: a normal meal with carbs and protein (rice + chicken, oats + yoghurt). 30–60 min before: something small — a banana, a yoghurt.',
        'За 1–3 год: звичайна їжа з вуглеводами й білком (рис + курка, вівсянка + йогурт). За 30–60 хв: щось невелике — банан, йогурт.',
      ),
  },
  {
    id: 'post_meal',
    all: [
      ['eat', 'meal', 'food', 'їсти', 'їжа', 'поїсти', 'есть', 'кушать', 'поесть'],
      ['after', 'після', 'после', 'post'],
      WORKOUT,
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Within a few hours after: 25–40 g protein and some carbs. The “30-minute window” is mostly a myth — the day’s total matters more.',
        'Протягом кількох годин після: 25–40 г білка й трохи вуглеводів. «Вікно 30 хвилин» — здебільшого міф; важливіший підсумок за день.',
      ),
  },
  {
    id: 'meals_count',
    all: [
      [
        'meals',
        'times a day',
        'how often eat',
        'прийом* їжі',
        'разів на день',
        'скільки разів їсти',
        'раз в день',
        'сколько раз есть',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        '3–5 meals, each with ~0.4 g protein per kg. Fewer is fine too if the daily total is there.',
        '3–5 прийомів, у кожному ~0,4 г білка на кг. Менше — теж нормально, якщо за день набирається.',
      ),
  },
  {
    id: 'vegan',
    all: [
      [
        'vegan',
        'vegetarian',
        'plant based',
        'plant-based',
        'веган*',
        'вегетар*',
        'рослинн*',
        'без мяса',
        'без м’яса',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Plant-based works: aim a bit higher on protein (~2 g/kg), mix sources (soy, tofu, lentils, seitan, pea protein), take B12, and creatine helps even more than for meat-eaters.',
        'Рослинне харчування працює: білка трохи більше (~2 г/кг), змішуй джерела (соя, тофу, сочевиця, сейтан, гороховий протеїн), приймай B12, а креатин допомагає навіть більше, ніж м’ясоїдам.',
      ),
  },
  {
    id: 'cheat_meal',
    all: [
      [
        'cheat*',
        'junk food',
        'fast food',
        'pizza',
        'читміл*',
        'читмил*',
        'зрив*',
        'фастфуд*',
        'піц*',
        'шкідлив* їж*',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'One big meal won’t undo a week. Enjoy it, get back to normal at the next meal — no “punishment” cardio.',
        'Один щедрий прийом не зіпсує тижня. Насолоджуйся й повертайся до звичного з наступного прийому — без «покарання» кардіо.',
      ),
  },
  {
    id: 'sugar',
    all: [
      [
        'sugar',
        'sweets',
        'dessert*',
        'candy',
        'chocolate',
        'цукор',
        'цукру',
        'солодк*',
        'сахар',
        'сладк*',
        'шоколад*',
        'десерт*',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Sugar isn’t poison — it’s easy calories. Keep most of your food whole, fit sweets into your calories, and a little around training even helps.',
        'Цукор — не отрута, а легкі калорії. Здебільшого їж цільну їжу, солодке вписуй у калорії, а трохи навколо тренування навіть допомагає.',
      ),
  },
  {
    id: 'late_eating',
    all: [
      ['eat', 'food', 'meal', 'їсти', 'їжа', 'есть', 'кушать'],
      [
        'night',
        'late',
        'evening',
        'before bed',
        'вечер*',
        'ніч*',
        'ночью',
        'на ніч',
        'перед сном',
        'пізно',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Eating late doesn’t make you fat — the day’s total does. A protein-rich meal before bed (cottage cheese, yoghurt) is even useful; just not so big it ruins sleep.',
        'Пізня їжа не робить товстим — робить загальна кількість за день. Білкова вечеря перед сном (сир, йогурт) навіть корисна; лише не така велика, щоб зіпсувати сон.',
      ),
  },
  {
    id: 'electrolytes',
    all: [
      [
        'electrolyt*',
        'salt',
        'sodium',
        'potassium',
        'magnesium',
        'сіль',
        'солі',
        'електроліт*',
        'натрі*',
        'магні*',
        'калі*',
        'соль',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        "Unless you sweat buckets or train over 90 min in heat, normal food covers it. Heavy sweaters: a pinch of salt in the bottle helps you hold on to fluid. Don't force down lots of plain water in long sessions. High blood pressure or kidney issues: ask your doctor before adding salt.",
        'Якщо не пітнієш відрами й не тренуєшся понад 90 хв у спеку, звичайна їжа все покриває. Кому пітно — дрібка солі в пляшку допомагає втримати воду. Не заливай у себе багато чистої води на довгих тренуваннях. Високий тиск чи проблеми з нирками — перед тим, як досолювати, спитай лікаря.',
      ),
  },
  {
    id: 'fiber',
    all: [
      [
        'fiber',
        'fibre',
        'vegetables',
        'veggies',
        'fruit*',
        'клітковин*',
        'овоч*',
        'фрукт*',
        'клетчатк*',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Aim for 25–35 g fibre: vegetables at two meals, fruit, oats, beans. Keeps you full on a cut and your gut happy on a bulk.',
        'Ціль — 25–35 г клітковини: овочі у двох прийомах, фрукти, вівсянка, бобові. На схудненні тримає ситість, на наборі — травлення в порядку.',
      ),
  },
];

/** "Tell me more" for intents from earlier parts (by id). */
export const MORES: Record<string, NonNullable<Intent['more']>> = {
  pain: (_c, p, L, depth) => painMore(p.words, p.phrase, depth, L),
  injury_status: (_c, p, L, depth) => painMore(p.words, p.phrase, depth, L),
  technique: (c, p, L, depth) => INTENTS_SIXTH[0].more!(c, p, L, depth),
};
