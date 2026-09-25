/**
 * The safety net — checked before anything else Atlas does. Some messages are
 * not training questions even when they look like one: chest pain with
 * breathlessness, fainting, starving yourself to cut, hating your body, a life
 * falling apart, thoughts of not wanting to live. For those Atlas drops the
 * act in every temper (no jokes, no swearing, no roasting), answers plainly
 * and points to real help. It never diagnoses.
 *
 * Also: questions about somebody else ("my dad is 65…") — Atlas must not file
 * those facts under YOU.
 */
import { normalize } from './nlu';
import type { Tr } from './intentKit';

export type SafetyKind =
  'selfharm' | 'cardiac' | 'faint' | 'starving' | 'bodyimage' | 'lifecrisis' | 'despair';

const re = (s: string) => new RegExp(s, 'u');

/** Order = priority (the first that matches wins). */
const SIGNALS: [SafetyKind, RegExp][] = [
  [
    'selfharm',
    re(
      '(не хочу жити|хочу зникнути|хочу щоб мене не було|не хочу прокидатися|не хочу більше прокидатись|want to disappear|wish i was(n.?t| not) here|wish i were dead|don.?t want to wake up|хочу исчезнуть|не хочу просыпаться|не хочеться жити|покінчити з собою|вбити себе|убити себе|суїцид|самогуб|хочу померти|краще б мене не було|порізати себе|різати себе|не хочу жить|покончить с собой|убить себя|хочу умереть|суицид|kill myself|killing myself|suicid|end it all|want to die|don.?t want to live|hurt myself|self.?harm|cut myself)',
    ),
  ],
  [
    'cardiac',
    re(
      [
        // the heart itself hurting / misbehaving
        '(серц|сердц|heart)\\S*( \\S+){0,3} (біль|болить|болі|колить|пече|стискає|болит|колет|hurts?|pain|aches?)',
        '(біль|болить|колить|пече|болит|колет|pain)\\S*( \\S+){0,3} (серц|сердц|heart)',
        'аритмі|арітмі|перебої серця|серце (\\S+ )?(тисне|стискає|пече|зупиняється|збивається|вистрибує)|сердце (\\S+ )?(давит|сжимает|выпрыгивает)|heart (is )?(skipping|fluttering)',
        // a racing heart is normal after cardio — not with pressure, pain, dizziness, or at rest
        '(калатає|колотиться|скаче|колотится|racing|pounding)( \\S+){0,6} (тисне|стискає|давит|болить|біль|задих|паморо|темніє|pain|pressure|tight|dizzy|faint|в спокої|в покое|at rest)',
        'heart (is )?(racing|pounding)( \\S+){0,3} (at rest|in bed|lying down)',
        // chest + breathlessness / pressure / spreading — not plain sore pecs
        '(груд|chest)\\S*( \\S+){0,6} (задишк|задих|важко дихати|не можу дихати|одышк|трудно дышать|short of breath|breathless|can.?t breathe|тисне|давить|стискає|сдавливает|pressure|tightness|віддає в (ліву )?руку|отдает в руку|left arm)',
        '(задишк|задих|важко дихати|одышк|short of breath|breathless|тисне|давить|стискає|pressure)\\S*( \\S+){0,6} (груд|chest)',
      ].join('|'),
    ),
  ],
  [
    'faint',
    re(
      '(запаморочен|паморочиться|крутиться голова|темніє в очах|потемніло в очах|знепритом|втратив свідом|втратила свідом|мало не знепритом|головокружен|темнеет в глазах|потерял сознание|dizzy|dizziness|faint|passed out|black(ed)? out|lightheaded|light.headed|vision went black)',
    ),
  ],
  [
    'starving',
    re(
      '((не їм|не їв|не їла|не їсти|без їжі|голодую|голоду(ю|вати|вання)|не ем|не ел|не ела|голодаю|not eating|haven.?t eaten|stopped eating|starv)\\S*( \\S+){0,6} (дн|день|дні|днів|тижд|тижн|дня|дней|недел|days?|weeks?|схуд|сушит|сушк|похуд|lose|cut))|((викликаю|спричиняю) блювот|блюю після|вырываю после|make myself (throw up|vomit)|purg(e|ing))|(\\d{2,3}) (ккал|калорій|калорий|kcal|calories) (на день|в день|a day|per day)',
    ),
  ],
  [
    'bodyimage',
    re(
      '((^|\\s)(я|i.?m|i am) (такий |така |так |so |too |такой |такая )?(жирн|товст|страшн|потворн|огидн|бридк|нікчем|жалюгідн|толст|урод|(fat|ugly|disgusting|worthless|pathetic)(\\s|$)))|ніхто (мене )?не любить|nobody loves me|no one loves me|ненавиджу (своє|моє) тіло|ненавижу (своё|свое|моё|мое) тело|hate (my|the way i) (body|look)|соромлюсь свого тіла|стидно за (своє|своє) тіло',
    ),
  ],
  [
    'lifecrisis',
    re(
      '((вигнали|звільнили|скоротили) з роботи|втратив роботу|втратила роботу|уволили|потерял работу|lost my job|got fired|got laid off|розлуч|розійшл|мене кинула|мене кинув|розстались|развод|расстались|divorc|broke up|breakup|(^|\\s)(помер|померла|померли|умер|умерла)(\\s|$)|похорон|passed away| died|funeral|війна забрала|загинув|загинула)',
    ),
  ],
  [
    'despair',
    re(
      '(хочу все кинути|нічого не виходить|немає сенсу|нема сенсу|все марно|опускаються руки|я здаюсь|я здаюся|хочу все бросить|ничего не получается|нет смысла|опускаются руки|i want to give up|i give up|what.?s the point( anymore| of (it|anything|trying|even trying|all this|this))? $|nothing works|i want to quit everything|депресі|депресс|depress)',
    ),
  ],
];

export function safetySignal(question: string): SafetyKind | null {
  const ph = ` ${normalize(question)} `;
  for (const [k, r] of SIGNALS) if (r.test(ph)) return k;
  return null;
}

/** What Atlas says — plainly, whatever the temper. Never a diagnosis. */
export function safetyReply(kind: SafetyKind, L: Tr): { text: string; chips: string[] } {
  switch (kind) {
    case 'selfharm':
      return {
        text: L(
          "I'm really glad you told me. You don't have to carry this alone — please reach out right now: call your local emergency number or a crisis line (in the US, 988; in the EU, 112; in Ukraine, Lifeline Ukraine 7333). If you can, tell someone you trust how you feel today.",
          'Добре, що ти це написав. Ти не маєш нести це сам — будь ласка, звернись просто зараз: Lifeline Ukraine — 7333 (цілодобово, безкоштовно) або 112. Якщо можеш, розкажи сьогодні комусь, кому довіряєш, як ти почуваєшся.',
        ),
        chips: [],
      };
    case 'cardiac':
      return {
        text: L(
          'Stop training right now. Chest pain or pressure — especially with shortness of breath, sweating, nausea, or pain spreading to the arm, neck or jaw — needs a doctor immediately: call emergency services (112 / 911). Don\'t "push through" or drive yourself.',
          'Зупинись просто зараз. Біль чи тиск у грудях — особливо із задишкою, пітливістю, нудотою або якщо віддає в руку, шию чи щелепу — це до лікаря негайно: викликай швидку (103 або 112). Не «дотискай» і не сідай сам за кермо.',
        ),
        chips: [],
      };
    case 'faint':
      return {
        text: L(
          "Stop the set and sit or lie down with your legs up until it passes; drink water and eat something if you haven't. A brief head rush after a heavy squat can happen from breath-holding, but if you faint, it keeps coming back, or it comes with chest pain, palpitations or a head knock — see a doctor before training again.",
          "Зупини підхід, сядь або ляж, ноги трохи вгору, доки не мине; попий води й щось з'їж, якщо давно не їв. Коротке «потемніння» після важкого присіду буває від затримки дихання, але якщо ти знепритомнів, це повторюється або є біль у грудях, перебої серця чи удар головою — спершу до лікаря, потім у зал.",
        ),
        chips: [],
      };
    case 'starving':
      return {
        text: L(
          "Not eating for days isn't cutting — it burns muscle, wrecks your training and can be dangerous. Eat today: a normal meal with protein. A safe cut is a small deficit, about 0.5–1% of bodyweight a week. If food has started to feel out of your control, please talk to a doctor — eating disorders are common and treatable.",
          "Кілька днів без їжі — це не сушка: так горять м'язи, падають тренування, і це буває небезпечно. Поїж сьогодні — нормально, з білком. Безпечна сушка — невеликий дефіцит, ~0,5–1% ваги на тиждень. Якщо їжа стала чимось, що ти не контролюєш, поговори з лікарем — розлади харчування трапляються часто й добре лікуються.",
        ),
        chips: [L('How do I cut safely?', 'Як безпечно сушитися?')],
      };
    case 'bodyimage':
      return {
        text: L(
          "That sounds heavy, and I'm not going to joke about it. How you look doesn't decide your worth — and for the record, you keep showing up, which is the hard part. If these thoughts stick around, it's worth talking to someone you trust or a professional. Want to focus on something that makes you feel strong?",
          'Звучить важко, і жартувати тут я не буду. Твоя цінність не вимірюється зовнішністю — а ти, до речі, приходиш і тренуєшся, і це найскладніше. Якщо такі думки не відпускають, варто поговорити з кимось близьким чи з фахівцем. Хочеш — подивимось, у чому ти вже сильніший, ніж був?',
        ),
        chips: [
          L('What are my best lifts?', 'Які мої рекорди?'),
          L('How have I progressed?', 'Як я прогресую?'),
        ],
      };
    case 'lifecrisis':
      return {
        text: L(
          "I'm sorry — that's a lot to deal with. Training can wait or be whatever helps: a walk, a light session to clear your head, or nothing at all this week. Your streak and plan will be fine — I can pause them for a week. I'm here when you want to get back to it.",
          'Мені шкода — це важко. Тренування може почекати або бути тим, що допомагає: прогулянка, легке тренування, щоб розвантажити голову, чи взагалі пауза цього тижня. З планом і серією все буде гаразд — можу поставити їх на паузу на тиждень. Я тут, коли захочеш повернутися.',
        ),
        chips: [L('Something light for today', 'Щось легке на сьогодні')],
      };
    case 'despair':
      return {
        text: L(
          "Rough patch — it happens to everyone who trains long enough. Let's make it smaller: one short, easy session, no numbers to chase. Progress comes back faster than it feels right now. And if this heaviness is about more than the gym, talking to someone you trust really helps.",
          'Важкий період — у всіх, хто тренується довго, таке буває. Давай зменшимо задачу: одне коротке легке тренування, без гонитви за цифрами. Прогрес повернеться швидше, ніж зараз здається. А якщо ця важкість не лише про зал — поговори з кимось, кому довіряєш, це справді допомагає.',
        ),
        chips: [
          L('Something light for today', 'Щось легке на сьогодні'),
          L('How have I progressed?', 'Як я прогресую?'),
        ],
      };
  }
}

/**
 * The question is about somebody else ("my dad", "a friend", "my girlfriend"),
 * so nothing in it describes you — Atlas mustn't remember it as yours.
 */
export function aboutSomeoneElse(question: string): boolean {
  return (
    re(
      '(^|\\s)(мій|моя|моєму|моїй|мого|моєї|мої|моїм|для|у|в|моему|моей|моя|мой|моего|для моего|для моей|my|for my|a|his|her)\\s+(друг\\S*|подруг\\S*|батьк\\S*|тат\\S*|мам\\S*|мат(і|ері|ір)|брат\\S*|сестр\\S*|дружин\\S*|чолові\\S*|хлоп\\S*|дівчин\\S*|син\\S*|сина|донь\\S*|доч\\S*|клієнт\\S*|колег\\S*|бабус\\S*|дідус\\S*|дитин\\S*|жен\\S*|муж\\S*|отц\\S*|отец|папы|мамы|сестры|брата|friend|dad|father|mom|mum|mother|brother|sister|wife|husband|boyfriend|girlfriend|partner|son|daughter|kid|child|client|coworker|colleague|grandma|grandpa|grandfather|grandmother)(\\s|$)',
    ).test(` ${normalize(question)} `) ||
    re('(^|\\s)(в нього|у нього|в неї|у неї|він|вона|his|her|he|she)\\s').test(
      ` ${normalize(question)} `,
    )
  );
}
