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
  | 'selfharm'
  | 'cardiac'
  | 'neuro'
  | 'urgent'
  | 'faint'
  | 'starving'
  | 'bodyimage'
  | 'lifecrisis'
  | 'despair';

const re = (s: string) => new RegExp(s, 'u');

/** Order = priority (the first that matches wins). */
const SIGNALS: [SafetyKind, RegExp][] = [
  [
    'selfharm',
    re(
      '(chcę umrzeć|chce umrzec|nie chcę żyć|nie chce zyc|zabić się|zabic sie|samobój|samoboj|skończyć ze sobą|noriu mirti|nenoriu gyventi|nusižudyti|nusizudyti|savižud|savizud|tahan surra|ei taha elada|enesetap|tappa ennast|не хочу (більше |вже )?жити|не хочеться (більше |вже )?жити|(хочу|хочеться) (в|по)мерти|краще б (я |мене )?(помер|померла|вмер|вмерла|не було|не народив|не народила)|навіщо (мені )?(взагалі )?жити|нема(є)? сенсу жити|нема(є)? для чого жити|без мене (всім |усім )?(буде )?краще|(всім|усім) (буде )?краще без мене|покінчити (з|із) (собою|усім|всім|життям)|(вбити|убити) себе|суїцид|самогуб|(по)?різати себе|ріжу себе|(по)?різав себе|(по)?різала себе|завдаю собі (болю|шкоди)|хочу зникнути|хочу щоб мене не було|не хочу (більше )?прокидат|наковтатис. таблет|передозуван|kill myself|killing myself|suicid|end (it all|my life)|i.?m going to end it|(want|wanna) (to )?die|don.?t want to (live|be alive|exist|wake up)|better off without me|no reason to live|wish i (was|were) dead|wish i (wasn.?t|was not|weren.?t) here|want to disappear|(want|going|trying|tried) to (hurt|harm) myself|hurting myself on purpose|self.?harm|(i )?(have been|ve been|keep|started) cutting myself|overdose|не хочу жить|покончить с собой|убить себя|хочу умереть|суицид|не хочу просыпаться|хочу исчезнуть)',
    ),
  ],
  [
    'cardiac',
    re(
      [
        '(серц|сердц|heart)\\S*( \\S+){0,3} (біль|болить|болі|колить|пече|стискає|болит|колет|hurts?|pain|aches?)',
        '(біль|болить|колить|пече|болит|колет|pain)\\S*( \\S+){0,3} (серц|сердц|heart)',
        'інфаркт|инфаркт|heart attack|серцевий напад|стенокард|angina|zawał|zawal|infarkt\\S*|südamevalu',
        // chest pain with running / breathlessness / the left arm (pl / lt / et)
        '(klat\\S*|krūtin\\S*|krutin\\S*|rinnu\\S*|rind\\S*)( \\S+){0,5} (bieg\\S*|biega\\S*|kardio|cardio|schod\\S*|duszn\\S*|oddych\\S*|lew\\S* rę\\S*|bėg\\S*|beg\\S*|kvėp\\S*|kvep\\S*|jooks\\S*|hing\\S*|trepp\\S*|vasak\\S* käsi)',
        'аритмі|арітмі|перебої серця|серце (\\S+ )?(тисне|стискає|пече|зупиняється|збивається|вистрибує)|сердце (\\S+ )?(давит|сжимает|выпрыгивает)|heart (is )?(skipping|fluttering)',
        '(калатає|колотиться|скаче|бється|бьется|колотится|racing|pounding)( \\S+){0,6} (тисне|стискає|давит|болить|біль|задих|паморо|темніє|pain|pressure|tight|dizzy|faint|в спокої|в покое|at rest)',
        'heart (rate )?(is )?(racing|pounding)( \\S+){0,3} (at rest|in bed|lying down)',
        '(пульс|resting heart rate|heart rate)( \\S+){0,3} (1[4-9]\\d|2\\d\\d)( \\S+){0,2} (в спокої|у спокої|at rest|lying|лежачи)',
        '(груд|chest)(?!\\S* press)\\S*( \\S+){0,6} (задишк|задих|важко дихати|не можу дихати|одышк|трудно дышать|short of breath|breathless|can.?t breathe|віддає в (ліву )?руку|отдает в руку|left arm|jaw|щелеп|шию|neck)',
        '(тисне|давить|стискає|пече|печіння|сдавливает|жжет|pressure|tightness|squeez\\S*|burning) (\\S+ ){0,2}(в|у|in|on) (груд|my chest|the chest)',
        '(груд|chest)(?!\\S* press)\\S*( \\S+){0,6} (біль|болить|болі|pain|hurts?|тисне|pressure)( \\S+){0,4} (біг|бігу|бігаю|кардіо|сходи|сходах|ходьб|running|run|jog|cardio|stairs|walking|at rest|в спокої|вночі|at night|lying)',
        '(задишк|задих|важко дихати|одышк|short of breath|breathless|can.?t catch my breath|не можу віддихат)\\S*( \\S+){0,6} (груд|chest|в спокої|at rest|лежачи|lying|легк|light|walking|ходьб|сходи|stairs)',
        '(біль|болить|болі|pain|hurts?|тисне)\\S*( \\S+){0,3} (груд|chest)(?!\\S* press)\\S*( \\S+){0,4} (біг|кардіо|сходи|сходах|ходьб|running|run|jog|cardio|stairs|walking|at rest|в спокої|вночі|at night|lying)',
        'resting heart rate( \\S+){0,2} (1[4-9]\\d|2\\d\\d)',
        '(ліва|ліву|left) (рука|руку|arm)( \\S+){0,4} (щелеп|jaw|оніміл|німіє|numb)',
      ].join('|'),
    ),
  ],
  [
    'neuro',
    re(
      '(раптов|різк|найсильніш|нестерпн|жахлив|sudden|worst|severe|thunderclap|explosive|вибухов)\\S*( \\S+){0,3} (головн\\S* біль|головний|голова|headache)|голова (раптом )?(розколюється|вибухає|вибухнула)|headache( \\S+){0,3} (during|mid|while|in the middle of)|(перекосило|перекошен)\\S* (обличчя|рот)|face (is )?(drooping|droops)|(slurred|can.?t) (speech|speak)|(мова|язик) (\\S+ )?заплітається|(оніміла|онімів|німіє|оніміло) (половина|ліва|права|пів)|(вдарився|вдарилась|вдарила|вдарив) (\\S+ ){0,2}голов|hit my head|(удар|травм)\\S* голов|concussion|(обличч|face|лиц)\\S*( \\S+){0,2} (онім|німіє|numb)|(онім|німіє|numb)\\S*( \\S+){0,3} (обличч|face|половин|half)|(половин|ліва частина|права частина|одна сторона)\\S*( \\S+){0,2} (обличч|тіла|face|body)( \\S+){0,2} (онім|німіє)|(головн\\S* біль|голова болить|headache)( \\S+){0,3} (під час|посеред|при|during|mid|while) |струс мозку|втратив зір|двоїться в очах|double vision|vision loss',
    ),
  ],
  [
    'urgent',
    re(
      '(темна|коричнев|бура)\\S* сеч|сеч\\S*( \\S+){0,3} (кола|чай|коричнев|темн)|(dark|brown)( \\S+){0,2} (urine|pee)|(urine|pee)( \\S+){0,3} (cola|brown|tea|dark)|rhabdo|рабдо|(набрякл|опухл|swollen)( \\S+){0,6} (не можу розігнути|не розгинаю|can.?t straighten)|(не можу розігнути|can.?t straighten)( \\S+){0,4} (набрякл|опухл|swollen)|(онімін|німіє|оніміл|numb)\\S*( \\S+){0,3} (пах|промежин|сідниц|groin|crotch|saddle|between my legs)|(не можу|важко) (помочит|пописят|сходити в туалет)|can.?t (pee|urinate)|нетриман|lost (bladder|bowel) control|(литк|calf)\\S*( \\S+){0,4} (набрякл|опухл|гаряч|червон|swollen|red|hot|warm)|тепловий удар|heat ?stroke|перестав пітніти|stopped sweating|сплутан\\S* свідом|confused( \\S+){0,3} (heat|спек)',
    ),
  ],
  [
    'faint',
    re(
      '(zemdlał\\S*|zemdlal\\S*|zasłabł\\S*|kręci mi się w głowie|kreci mi sie w glowie|nualpau|nualpo|svaigsta galva|minestasin|pea käib ringi|запаморочен|паморочиться|(крутиться|паморочиться|йде обертом) голова|голова (\\S+ )?(крутиться|паморочиться|йде обертом)|(темніє|потемніло|темно) в очах|в очах (\\S+ )?(темніє|потемніло|потемніли|темно)|знепритом|втратив свідом|втратила свідом|головокружен|темнеет в глазах|потерял сознание|dizzy|dizziness|(feel|felt|feeling|nearly|almost|about to|going to) (\\S+ )?faint|fainted|fainting|passed out|(i |nearly |almost )blacked out|blacking out|lightheaded|light.headed|vision went (black|dark))',
    ),
  ],
  [
    'starving',
    re(
      '((не їм|не їв|не їла|не їсти|без їжі|голодую|не ем|не ел|не ела|голодаю|not eating|haven.?t eaten|stopped eating|starv\\S*)( (нічого|взагалі|зовсім|вже|уже|anything|at all|for|вже майже|already))* (\\d+ |два |дві |три |кілька |декілька |a few |two |three |several |a |\\S+(ий|ій|ой) )?(дн|ден|доб|тижд|тижн|дня|дней|недел|days?|weeks?))|((голодую|морю себе голодом|starving myself|не їм нічого|нічого не їм)( \\S+){0,4} (схуд|похуд|lose|cut|сушк))|((викликаю|спричиняю|викликала|викликав) блювот|блюю після (їжі|їди)|вырываю после|make myself (throw up|vomit|sick)|throw up after (eating|meals|i eat)|purg(e|ing)|проносн|слабительн|laxative|сечогінн|diuretic\\S* to (lose|cut))|(^|\\s)([1-9]\\d{1,2}) ?(ккал|калорій|калорий|kcal|calories|cal) (на день|в день|за день|a day|per day|daily)',
    ),
  ],
  [
    'bodyimage',
    re(
      '((^|\\s)(я|i.?m|i am) (такий |така |так |so |too |такой |такая )?(жирн|товст|страшн|потворн|огидн|бридк|нікчем|жалюгідн|толст|урод|(fat|ugly|disgusting|worthless|pathetic)(?! (loss|adapted|burn\\S*|free))(\\s|$)))|ніхто (мене )?не любить|nobody loves me|no one loves me|ненавиджу (своє|моє) тіло|ненавижу (своё|свое|моё|мое) тело|hate (my|the way i) (body|look)|(соромлюсь|соромлюся|соромно|стидно|стидаюсь)( \\S+){0,2} (тіла|тіло|за тіло)',
    ),
  ],
  [
    'lifecrisis',
    re(
      '((вигнали|звільнили|скоротили) з роботи|втратив роботу|втратила роботу|уволили|потерял работу|lost my job|got fired|got laid off|розлуч|розійшл|мене кинула|мене кинув|розстались|развод|расстались|divorc|broke up|breakup|(^|\\s)(помер|померла|померли|умер|умерла)(\\s|$)|похорон|passed away|(^|\\s)(my|our|his|her) (?!(phone|battery|laptop|car|app|watch|computer|pc|tv|headphones|earbuds|charger|plant|plants)\\s)\\S+( \\S+)? (died|has died|just died)|funeral|війна забрала|загинув|загинула)',
    ),
  ],
  [
    'despair',
    re(
      '(хочу все кинути|нічого не виходить|немає сенсу|нема сенсу|все марно|опускаються руки|я здаюсь|я здаюся|хочу все бросить|ничего не получается|нет смысла|опускаются руки|i want to give up|i give up|what.?s the point( anymore| of (it|anything|trying|even trying|all this|this))? $|nothing works|i want to quit everything|депрес|depress)',
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
    case 'neuro':
      return {
        text: L(
          "Stop training now. A sudden, severe headache during a lift, numbness or drooping on one side of the face or body, slurred speech or vision loss — or a hit to the head followed by headache, confusion, vomiting or drowsiness — needs emergency care: call 112 / 911. Don't drive yourself. After any head knock or concussion, no training until a doctor clears you.",
          'Зупинись і не тренуйся. Раптовий сильний головний біль під час підходу, оніміння чи «перекіс» однієї половини обличчя або тіла, нерозбірлива мова, втрата зору — або удар головою, після якого болить голова, нудить, плутаються думки чи хилить у сон, — це до швидкої: 103 або 112. Сам за кермо не сідай. Після удару головою чи струсу — без тренувань, доки лікар не дозволить.',
        ),
        chips: [],
      };
    case 'urgent':
      return {
        text: L(
          "Please don't wait on this one — get medical help today (112 / 911 if it's severe). Dark, cola-coloured urine with very sore, swollen muscles after a hard session; numbness in the groin or trouble peeing after back pain; a swollen, hot, painful calf; or confusion and no sweating in the heat — these need a doctor now, not rest at home. No training until you've been checked. If it's the heat: get into shade, cool down with water, and sip fluids while you wait.",
          'З цим не чекай — звернись по медичну допомогу сьогодні (якщо сильно — 103 або 112). Темна сеча кольору коли з дуже болючими, набряклими м’язами після важкого тренування; оніміння в паху чи проблеми із сечовипусканням на тлі болю в спині; набрякла, гаряча, болюча литка; сплутаність і відсутність поту в спеку — це до лікаря зараз, а не відпочинок удома. До огляду — без тренувань. Якщо перегрівся: у тінь, охолоджуйся водою й пий маленькими ковтками, поки чекаєш.',
        ),
        chips: [],
      };
    case 'faint':
      return {
        text: L(
          "Stop the set and sit or lie down with your legs up until it passes; sip water and eat something if you haven't (if you have diabetes, check your sugar). A brief head rush after a heavy squat or standing up fast can come from breath-holding. But fainting during effort, or dizziness with chest pain, palpitations, breathlessness or after a head knock — call 112 / 911. If you fainted at all, or it keeps coming back, see a doctor before training again.",
          'Зупини підхід, сядь або ляж, ноги трохи вгору, доки не мине; попий води й щось з’їж, якщо давно не їв (при діабеті — переміряй цукор). Коротке «потемніння» після важкого присіду чи різкого підйому буває від затримки дихання. Але непритомність просто під час навантаження або запаморочення з болем у грудях, перебоями серця, задишкою чи після удару головою — викликай швидку: 103 або 112. Якщо ти взагалі знепритомнів чи це повторюється — спершу до лікаря, потім у зал.',
        ),
        chips: [],
      };
    case 'starving':
      return {
        text: L(
          "I'm glad you said it. Going days without food or making yourself sick isn't cutting — it burns muscle, drains your strength and can be dangerous for your heart. Please eat something today, a normal meal. If food has started to feel out of your control, talk to a doctor or someone you trust — eating disorders are common and treatable, and help works best early.",
          'Добре, що ти про це написав. Кілька днів без їжі чи блювота після їжі — це не сушка: так горять м’язи, падає сила, і це буває небезпечно для серця. Будь ласка, поїж сьогодні — звичайну нормальну їжу. Якщо їжа стала чимось, що ти не контролюєш, поговори з лікарем чи з кимось, кому довіряєш: розлади харчування трапляються часто, добре лікуються, і що раніше — то легше.',
        ),
        chips: [],
      };
    case 'bodyimage':
      return {
        text: L(
          "That sounds heavy, and I'm not going to joke about it. How you look doesn't decide your worth — and for the record, you keep showing up, which is the hard part. If these thoughts stick around, it's worth talking to someone you trust or a professional. Want to focus on something that makes you feel strong?",
          'Звучить важко, і жартувати тут я не буду. Твоя цінність не вимірюється зовнішністю — а ти, до речі, приходиш і тренуєшся, і це найскладніше. Якщо такі думки не відпускають, варто поговорити з кимось близьким чи з фахівцем. Хочеш — подивимось, у чому ти вже сильніший, ніж був?',
        ),
        chips: [
          L('What are my best lifts?', 'Які мої рекорди?'),
          L('How do I lose fat safely?', 'Як безпечно схуднути?'),
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
          "Rough patch — it happens to everyone who trains long enough. Let's make it smaller: one short, easy session, no numbers to chase. Progress comes back faster than it feels right now. And if the heaviness is about more than the gym, or you've felt low for two weeks or more, talk to someone you trust or a doctor — depression is common and treatable.",
          'Важкий період — у всіх, хто тренується довго, таке буває. Давай зменшимо задачу: одне коротке легке тренування, без гонитви за цифрами. Прогрес повернеться швидше, ніж зараз здається. А якщо ця важкість не лише про зал або тобі погано вже два тижні й довше — поговори з кимось, кому довіряєш, чи з лікарем: депресія трапляється часто й добре лікується.',
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
