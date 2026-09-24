/**
 * Technique cards for the main lifts: 3 key cues, the common mistakes, why the
 * cues matter, and one deeper layer. Matched by name fragments against the
 * exercise library name. General coaching, not medical advice.
 */
type P = [string, string];
export interface TechCard {
  match: string[];
  cues: P;
  mistakes: P;
  why: P;
  deeper: P;
}

export const TECH: TechCard[] = [
  {
    match: ['bulgarian', 'split squat'],
    cues: [
      'Rear foot on a bench, front foot far enough that the knee stays over the foot, go straight down.',
      'Задня нога на лаві, передня стопа достатньо далеко, щоб коліно було над стопою, опускайся прямо вниз.',
    ],
    mistakes: [
      'Stance too short, front heel lifting, wobbling from a narrow line.',
      'Закоротка стійка, п’ята передньої ноги відривається, хитає через вузьку лінію.',
    ],
    why: [
      'One leg at a time fixes imbalances and loads the legs heavily with little spine load.',
      'По одній нозі — вирівнює дисбаланс і сильно навантажує ноги без навантаження на хребет.',
    ],
    deeper: [
      'Lean forward for glutes, upright for quads.',
      'Нахил уперед — сідниці, вертикально — квадрицепс.',
    ],
  },
  {
    match: ['dumbbell press', 'dumbbell bench'],
    cues: [
      'Kick the dumbbells up from the knees, shoulder blades back, lower to the chest line, press up and slightly in.',
      'Закинь гантелі з колін, лопатки зведені, опускай до лінії грудей, жми вгору й трохи всередину.',
    ],
    mistakes: [
      'Dropping too deep with shoulders rolling forward, clanking at the top.',
      'Занадто глибоко з плечима вперед, б’єш гантелі вгорі.',
    ],
    why: [
      'Free hands find the shoulder’s best path — usually kinder than a barbell.',
      'Вільні руки знаходять найкращу для плеча траєкторію — зазвичай м’якше за штангу.',
    ],
    deeper: ['Neutral grip if the shoulders complain.', 'Нейтральний хват, якщо скаржаться плечі.'],
  },
  {
    match: ['front squat'],
    cues: [
      'Bar on the front delts, elbows high, fingers just holding. Sit straight down between your heels, chest up.',
      'Гриф на передніх дельтах, лікті високо, пальці лише притримують. Сідай прямо вниз між п’ятами, груди вгору.',
    ],
    mistakes: [
      'Elbows dropping (the bar rolls forward), heels lifting, rounding at the bottom.',
      'Лікті падають (гриф котиться вперед), п’яти відриваються, спина круглиться внизу.',
    ],
    why: [
      'High elbows keep the bar on a shelf; an upright torso makes it a quad lift and spares the lower back.',
      'Високі лікті тримають гриф на «полиці»; вертикальний корпус — навантаження на квадрицепс, поперек відпочиває.',
    ],
    deeper: [
      'Wrist mobility limited? Use straps on the bar or the cross-arm grip. Squat shoes help depth.',
      'Бракує рухливості зап’ясть — лямки на грифі або хват навхрест. Штангетки допомагають з глибиною.',
    ],
  },
  {
    match: ['squat'],
    cues: [
      'Feet shoulder-width, toes slightly out. Big breath, brace, knees track over toes, hips back and down to at least parallel, drive up through mid-foot.',
      'Стопи на ширині плечей, носки трохи врозтіч. Вдих, напруж корпус, коліна за носками, таз назад і вниз мінімум до паралелі, вставай через середину стопи.',
    ],
    mistakes: [
      'Knees caving in, heels lifting, losing the brace at the bottom, cutting depth as the weight goes up.',
      'Коліна всередину, п’яти відриваються, корпус «розслабляється» внизу, глибина зменшується з вагою.',
    ],
    why: [
      'Knees out keeps the hips and adductors working and the knee joint aligned; bracing protects the spine under load.',
      'Коліна назовні — працюють таз і привідні, коліно в осі; напружений корпус захищає хребет під вагою.',
    ],
    deeper: [
      'Stuck out of the hole: pause squats at 70%. Folding forward: front squats or tempo squats. Film from the side every few weeks.',
      'Застрягаєш унизу — присід з паузою на 70%. Завалюєшся вперед — фронтальний або темповий присід. Знімай збоку раз на кілька тижнів.',
    ],
  },
  {
    match: ['romanian', 'stiff'],
    cues: [
      'Soft knees, push the hips back, bar slides down the thighs, stop when the hamstrings are stretched, back flat.',
      'Коліна м’які, таз назад, гриф ковзає по стегнах, зупинись, коли тягне задня поверхня, спина рівна.',
    ],
    mistakes: [
      'Squatting it down, rounding to reach the floor, the bar drifting away from the legs.',
      'Перетворюєш на присід, круглиш спину, щоб дістати підлогу, гриф відходить від ніг.',
    ],
    why: [
      'It’s a hip hinge: the range ends where your hamstrings do, not at the floor.',
      'Це нахил у тазу: амплітуда закінчується там, де задня поверхня, а не на підлозі.',
    ],
    deeper: [
      '3 s down, no bounce, 8–12 reps. Straps are fine — grip shouldn’t limit the hamstrings.',
      '3 с вниз, без відскоку, 8–12 повт. Лямки — нормально, хват не має обмежувати задню поверхню.',
    ],
  },
  {
    match: ['sumo'],
    cues: [
      'Wide stance, toes out, hands inside the knees, chest up, push the floor apart.',
      'Широка постановка, носки назовні, руки між колінами, груди вгору, «розштовхуй» підлогу.',
    ],
    mistakes: [
      'Hips shooting up first, knees caving, pulling with the arms.',
      'Таз злітає першим, коліна всередину, тягнеш руками.',
    ],
    why: [
      'A more upright back and shorter pull — more hips and quads, less lower back.',
      'Спина вертикальніша, амплітуда коротша — більше таз і квадрицепс, менше поперек.',
    ],
    deeper: [
      'Wedge in: pull the slack out of the bar before it leaves the floor.',
      'Вклинюйся: вибери слабину грифа до того, як він відірветься від підлоги.',
    ],
  },
  {
    match: ['deadlift'],
    cues: [
      'Bar over mid-foot, shins touch it, flat back, pull the slack out, push the floor away, bar stays on the legs, stand tall.',
      'Гриф над серединою стопи, гомілки торкаються, спина рівна, вибери слабину, відштовхни підлогу, гриф по ногах, випрямся.',
    ],
    mistakes: [
      'Jerking the bar, hips rising first, rounding the lower back, leaning back at lockout.',
      'Смикаєш гриф, таз піднімається першим, круглиш поперек, відхиляєшся назад угорі.',
    ],
    why: [
      'A bar close to the body is a shorter lever — less stress on the spine, more weight moved.',
      'Гриф близько до тіла — коротший важіль: менше навантаження на хребет, більше вага.',
    ],
    deeper: [
      'Slow off the floor: deficit pulls. Weak lockout: rack pulls or hip thrusts. Reset each rep until the form is automatic.',
      'Повільний відрив — тяга з дефіциту. Слабкий дотяг — тяга з плинтів чи сідничний міст. Перезапускай кожен повтор, поки техніка не стане автоматичною.',
    ],
  },
  {
    match: ['incline'],
    cues: [
      'Bench at 30°, shoulder blades pinned, bar to the upper chest, elbows ~60° from the body.',
      'Лава 30°, лопатки зведені, гриф до верху грудей, лікті ~60° від тулуба.',
    ],
    mistakes: [
      'Bench too steep (turns into a shoulder press), bouncing, flaring elbows.',
      'Занадто високий кут (стає жимом плечима), відбиваєш від грудей, лікті в сторони.',
    ],
    why: [
      '30° hits the upper chest; higher shifts it to the front delts.',
      '30° навантажує верх грудей; вище — вже передні дельти.',
    ],
    deeper: [
      'Dumbbells let the hands come closer at the top and are kinder to shoulders.',
      'Гантелі дають звести руки вгорі й м’якші до плечей.',
    ],
  },
  {
    match: ['bench press', 'bench'],
    cues: [
      'Eyes under the bar, shoulder blades squeezed and down, feet planted, bar to the lower chest, elbows ~45–70°, press up and slightly back.',
      'Очі під грифом, лопатки зведені й опущені, ноги впираються, гриф до низу грудей, лікті ~45–70°, жми вгору й трохи назад.',
    ],
    mistakes: [
      'Flared elbows, bouncing off the chest, butt off the bench, wrists bent back.',
      'Лікті в сторони, відбиваєш від грудей, таз відривається, зап’ястя загнуті назад.',
    ],
    why: [
      'Retracted shoulder blades give a stable base and keep the shoulder joint out of a bad position.',
      'Зведені лопатки — стабільна опора й безпечне положення плечового суглоба.',
    ],
    deeper: [
      'Stuck mid-way: pause bench and close-grip. Stuck off the chest: 1-s pause reps. Use safeties when alone.',
      'Застрягаєш посередині — жим з паузою й вузьким хватом. Внизу — паузи 1 с на грудях. Сам — лише зі страховочними упорами.',
    ],
  },
  {
    match: ['overhead', 'military', 'shoulder press', 'push press'],
    cues: [
      'Grip just outside shoulders, squeeze glutes, ribs down, press straight up, head through at the top.',
      'Хват трохи ширше плечей, сідниці напружені, ребра вниз, жми прямо вгору, голова «в вікно» вгорі.',
    ],
    mistakes: [
      'Leaning back into a standing incline press, flaring the ribs, pressing forward around the face.',
      'Відхиляєшся назад (виходить жим під кутом), ребра вперед, гриф іде по дузі від обличчя.',
    ],
    why: [
      'A braced trunk turns the whole body into a stable base; the straight bar path is the shortest one.',
      'Напружений корпус робить тіло стабільною опорою; пряма траєкторія — найкоротша.',
    ],
    deeper: [
      'Shoulders complain? Try landmine or neutral-grip dumbbell presses.',
      'Плечі скаржаться — жим «лендмайн» або гантелі нейтральним хватом.',
    ],
  },
  {
    match: ['bent over', 'barbell row', 'pendlay', 't-bar'],
    cues: [
      'Hinge to ~45°, flat back, pull the bar to the lower ribs, elbows back, squeeze the shoulder blades.',
      'Нахил ~45°, спина рівна, тягни гриф до низу ребер, лікті назад, зведи лопатки.',
    ],
    mistakes: [
      'Standing up as the weight gets heavy, jerking with the hips, rounding the back.',
      'Випрямляєшся, коли стає важко, ривок тазом, круглиш спину.',
    ],
    why: [
      'Keeping the angle keeps the lats and mid-back doing the work.',
      'Сталий кут тримає роботу на широчайших і середині спини.',
    ],
    deeper: [
      'Lower back tired? Chest-supported rows give the same back work without it.',
      'Втомлюється поперек — тяга з упором грудьми дає ту саму роботу спини без нього.',
    ],
  },
  {
    match: ['cable row', 'seated row'],
    cues: [
      'Tall chest, pull to the belly, elbows along the body, pause, let the shoulders stretch forward on the way back.',
      'Груди вгору, тягни до живота, лікті вздовж тіла, пауза, на поверненні дай плечам потягнутися вперед.',
    ],
    mistakes: [
      'Rocking the torso, shrugging, short range.',
      'Розгойдуєш корпус, піднімаєш плечі, коротка амплітуда.',
    ],
    why: [
      'The stretch forward and the squeeze back are where the back grows.',
      'Розтягнення вперед і зведення назад — саме там росте спина.',
    ],
    deeper: [
      'Wide bar for upper back, close handle for lats.',
      'Широка рукоять — верх спини, вузька — широчайші.',
    ],
  },
  {
    match: ['pulldown'],
    cues: [
      'Thighs locked, slight lean back, pull the bar to the upper chest, elbows down and back.',
      'Стегна зафіксовані, легкий нахил назад, тягни до верху грудей, лікті вниз і назад.',
    ],
    mistakes: [
      'Swinging, pulling behind the neck, stopping at the chin.',
      'Розгойдування, тяга за голову, зупинка на рівні підборіддя.',
    ],
    why: [
      'Elbows driving down (not hands pulling) puts the lats in charge.',
      'Лікті тягнуть униз (а не кисті) — тоді працюють широчайші.',
    ],
    deeper: [
      'A 1-s squeeze at the chest and 3 s up beats more weight.',
      '1 с утримання біля грудей і 3 с угору дають більше, ніж зайва вага.',
    ],
  },
  {
    match: ['chin'],
    cues: [
      'Underhand grip shoulder-width, from a dead hang, chest to the bar, control down.',
      'Зворотний хват на ширині плечей, з повного вису, груди до перекладини, контрольовано вниз.',
    ],
    mistakes: [
      'Half reps, kipping, neck craning to the bar.',
      'Пів-амплітуди, розгойдування, тягнешся шиєю.',
    ],
    why: [
      'Underhand brings the biceps in — usually a few more reps than pull-ups.',
      'Зворотний хват включає біцепс — зазвичай на кілька повторів більше за підтягування.',
    ],
    deeper: ['Elbows sore? Switch to neutral grip.', 'Болять лікті — нейтральний хват.'],
  },
  {
    match: ['pullup', 'pull-up', 'pull up'],
    cues: [
      'Overhand, a bit wider than shoulders, dead hang, pull the elbows to the ribs, chin over the bar, 2–3 s down.',
      'Прямий хват трохи ширше плечей, повний вис, лікті до ребер, підборіддя над перекладиною, 2–3 с вниз.',
    ],
    mistakes: [
      'Kipping, half reps, shrugging at the bottom.',
      'Розгойдування, пів-амплітуди, плечі до вух унизу.',
    ],
    why: [
      'Full range from a dead hang trains the lats through their whole length.',
      'Повна амплітуда з вису тренує широчайші по всій довжині.',
    ],
    deeper: [
      'Can’t do one yet: slow negatives 3×5, band-assisted sets, lat pulldown for volume.',
      'Ще не підтягуєшся — повільні негативи 3×5, з резинкою, тяга верхнього блока для обсягу.',
    ],
  },
  {
    match: ['dip'],
    cues: [
      'Lean slightly forward, elbows back, lower until the shoulders are just below the elbows, press up.',
      'Легкий нахил уперед, лікті назад, опускайся, поки плечі трохи нижче ліктів, вижми вгору.',
    ],
    mistakes: [
      'Going too deep with shoulders rolling forward, flaring elbows.',
      'Занадто глибоко з плечима вперед, лікті в сторони.',
    ],
    why: [
      'Depth past the shoulder’s comfort strains the front of the joint; the forward lean shifts it to the chest.',
      'Глибина понад комфорт плеча навантажує його передню частину; нахил переносить роботу на груди.',
    ],
    deeper: [
      'Shoulders sensitive? Swap for close-grip bench or weighted push-ups.',
      'Чутливі плечі — жим вузьким хватом або віджимання з вагою.',
    ],
  },
  {
    match: ['push-up', 'pushup', 'push up'],
    cues: [
      'Hands under shoulders, body a straight plank, elbows ~45°, chest to the floor.',
      'Долоні під плечима, тіло — рівна планка, лікті ~45°, груди до підлоги.',
    ],
    mistakes: [
      'Hips sagging, half reps, elbows straight out.',
      'Таз провисає, пів-амплітуди, лікті в сторони.',
    ],
    why: [
      'It’s a moving plank: the core work is part of the exercise.',
      'Це планка в русі: робота корпусу — частина вправи.',
    ],
    deeper: [
      'Too easy: feet up, a pause at the bottom, or a backpack. Too hard: hands on a bench.',
      'Легко — ноги на підвищенні, пауза внизу чи рюкзак. Важко — руки на лаву.',
    ],
  },
  {
    match: ['lunge'],
    cues: [
      'Long step, both knees ~90°, torso tall, push through the front heel.',
      'Довгий крок, обидва коліна ~90°, корпус рівно, відштовхуйся п’ятою передньої ноги.',
    ],
    mistakes: [
      'Short steps (knee far past toes), knee caving, slamming the back knee.',
      'Короткий крок (коліно далеко за носком), коліно всередину, б’єш заднім коліном об підлогу.',
    ],
    why: [
      'A longer step shares the work between quads and glutes and is easier on the knee.',
      'Довший крок ділить роботу між квадрицепсом і сідницями й м’якший до коліна.',
    ],
    deeper: [
      'Reverse lunges are the knee-friendliest version.',
      'Зворотні випади — найдружніші до колін.',
    ],
  },
  {
    match: ['leg press'],
    cues: [
      'Feet mid-platform, lower until the knees are ~90° without the lower back peeling off, push through the whole foot.',
      'Стопи посередині платформи, опускай до ~90° у колінах, поки поперек не відривається, тисни всією стопою.',
    ],
    mistakes: [
      'Going so deep the pelvis tucks, locking knees hard, bouncing.',
      'Так глибоко, що таз підкручується, різко блокуєш коліна, відбиваєш.',
    ],
    why: [
      'The range ends where your lower back stays flat on the pad.',
      'Амплітуда закінчується там, де поперек ще притиснутий.',
    ],
    deeper: [
      'Feet high and wide: more glutes; low and narrow: more quads.',
      'Стопи високо й широко — сідниці; низько й вузько — квадрицепс.',
    ],
  },
  {
    match: ['hip thrust', 'glute bridge'],
    cues: [
      'Upper back on the bench edge, bar on the hips (pad it), chin tucked, drive through the heels to a flat top, squeeze.',
      'Верх спини на краю лави, гриф на тазі (з м’якою накладкою), підборіддя прибране, тисни п’ятами до рівного верху, стисни сідниці.',
    ],
    mistakes: [
      'Arching the lower back at the top, feet too far, head thrown back.',
      'Прогинаєш поперек угорі, стопи задалеко, закидаєш голову.',
    ],
    why: [
      'Posterior pelvic tilt at the top keeps it a glute lift, not a lower-back one.',
      'Підкручений таз угорі — навантаження на сідниці, а не на поперек.',
    ],
    deeper: [
      '1-s squeeze at the top; shins vertical at lockout.',
      '1 с стискання вгорі; гомілки вертикальні у верхній точці.',
    ],
  },
  {
    match: ['leg curl'],
    cues: [
      'Hips pressed down, curl all the way, 2–3 s back.',
      'Таз притиснутий, згинай до кінця, 2–3 с назад.',
    ],
    mistakes: ['Hips lifting, swinging, half range.', 'Таз піднімається, ривки, пів-амплітуди.'],
    why: [
      'Hamstrings respond well to slow eccentrics.',
      'Задня поверхня добре відповідає на повільне опускання.',
    ],
    deeper: [
      'Seated curls train the hamstrings longer than lying ones.',
      'Сидячи — задня поверхня в більшому розтягу, ніж лежачи.',
    ],
  },
  {
    match: ['leg extension'],
    cues: [
      'Knee in line with the machine axis, extend fully, 1-s squeeze, slow down.',
      'Коліно на осі тренажера, розгинай повністю, 1 с утримання, повільно вниз.',
    ],
    mistakes: [
      'Kicking the weight, lifting the hips off the seat.',
      'Закидаєш вагу ривком, відриваєш таз від сидіння.',
    ],
    why: [
      'The only way to load the rectus femoris shortened — a good finisher.',
      'Єдиний спосіб навантажити прямий м’яз стегна у скороченні — добрий фініш.',
    ],
    deeper: [
      'Knees sensitive? Partial range, lighter, higher reps.',
      'Чутливі коліна — часткова амплітуда, легше, більше повторів.',
    ],
  },
  {
    match: ['calf'],
    cues: [
      'Full stretch at the bottom with a 1–2 s pause, all the way up on the big toe.',
      'Повне розтягнення внизу з паузою 1–2 с, вгору до кінця на великий палець.',
    ],
    mistakes: ['Bouncing short reps.', 'Короткі пружинні повтори.'],
    why: [
      'The Achilles is springy; the pause takes the bounce out and makes the calf work.',
      'Ахіллове сухожилля пружне; пауза прибирає відскок і змушує працювати литку.',
    ],
    deeper: [
      'Straight knee: gastrocnemius; bent (seated): soleus. Do both.',
      'Пряме коліно — литковий, зігнуте (сидячи) — камбалоподібний. Роби обидва.',
    ],
  },
  {
    match: ['hammer'],
    cues: [
      'Neutral grip, elbows pinned, curl without swinging.',
      'Нейтральний хват, лікті притиснуті, згинай без розгойдування.',
    ],
    mistakes: ['Swinging, elbows drifting forward.', 'Розгойдування, лікті йдуть уперед.'],
    why: [
      'Neutral grip hits the brachialis and forearm — thicker arms.',
      'Нейтральний хват працює на брахіаліс і передпліччя — руки товщі.',
    ],
    deeper: [
      'Cross-body version for a longer range.',
      'Навскіс до протилежного плеча — довша амплітуда.',
    ],
  },
  {
    match: ['curl'],
    cues: [
      'Elbows at your sides, curl up, squeeze, 2–3 s down, no swinging.',
      'Лікті біля боків, згинай угору, стисни, 2–3 с вниз, без розгойдування.',
    ],
    mistakes: [
      'Swinging the torso, elbows moving forward, dropping the weight.',
      'Розгойдуєш корпус, лікті йдуть уперед, кидаєш вагу вниз.',
    ],
    why: [
      'If the body helps, the biceps don’t — lighter and strict grows more.',
      'Якщо допомагає тіло, біцепс не працює — легше й чисто росте більше.',
    ],
    deeper: [
      'Incline curls stretch the long head; preacher curls hit the short one.',
      'Згинання на похилій лаві розтягує довгу голову, на лаві Скотта — коротку.',
    ],
  },
  {
    match: ['skull', 'lying triceps', 'french'],
    cues: [
      'Upper arms slightly back from vertical, lower to behind the head, extend.',
      'Плечі трохи відхилені за вертикаль, опускай за голову, розгинай.',
    ],
    mistakes: [
      'Elbows flaring, turning it into a press.',
      'Лікті розходяться, перетворюєш на жим.',
    ],
    why: [
      'Behind the head loads the long head of the triceps in a stretch.',
      'За голову — довга голова трицепса в розтягу.',
    ],
    deeper: ['Elbows complain? EZ bar or cables.', 'Скаржаться лікті — EZ-гриф або блок.'],
  },
  {
    match: ['pushdown', 'triceps extension', 'tricep'],
    cues: [
      'Elbows pinned to your sides, extend fully, control back.',
      'Лікті притиснуті до боків, розгинай повністю, контролюй назад.',
    ],
    mistakes: ['Elbows drifting, leaning over the weight.', 'Лікті гуляють, навалюєшся тілом.'],
    why: [
      'Fixed elbows make the triceps the only mover.',
      'Зафіксовані лікті — працює лише трицепс.',
    ],
    deeper: [
      'Overhead cable extensions add the long-head stretch.',
      'Розгинання з-за голови на блоці додають розтяг довгої голови.',
    ],
  },
  {
    match: ['lateral raise', 'side lateral'],
    cues: [
      'Slight lean forward, lead with the elbows, raise to shoulder height, pinkies not higher than thumbs.',
      'Легкий нахил уперед, веди ліктями, до висоти плечей, мізинці не вище великих пальців.',
    ],
    mistakes: [
      'Swinging, shrugging, going too heavy.',
      'Розгойдування, плечі до вух, завелика вага.',
    ],
    why: [
      'Side delts are small: clean reps at light weight beat heavy swings.',
      'Середні дельти маленькі: чисті повтори з легкою вагою кращі за важкі ривки.',
    ],
    deeper: [
      'Cables keep tension at the bottom; 12–20 reps work well.',
      'Блок тримає напругу внизу; 12–20 повт. працюють добре.',
    ],
  },
  {
    match: ['face pull'],
    cues: [
      'Rope at face height, pull to the eyes, elbows high, rotate the hands back.',
      'Канат на рівні обличчя, тягни до очей, лікті високо, розвертай кисті назад.',
    ],
    mistakes: ['Too heavy — turns into a row.', 'Завелика вага — виходить тяга.'],
    why: [
      'Rear delts and rotator cuff: good for shoulder health and posture.',
      'Задні дельти й ротатори: здоров’я плечей і постава.',
    ],
    deeper: ['2–3 sets of 15–20, most sessions.', '2–3 підходи по 15–20 майже кожне тренування.'],
  },
  {
    match: ['shrug'],
    cues: [
      'Straight up toward the ears, 1-s hold, straight down.',
      'Прямо вгору до вух, 1 с утримання, прямо вниз.',
    ],
    mistakes: ['Rolling the shoulders, bending the elbows.', 'Крутиш плечима, згинаєш лікті.'],
    why: [
      'The traps move up and down; rolling adds nothing but strain.',
      'Трапеції рухаються вгору-вниз; обертання — лише зайве навантаження.',
    ],
    deeper: [
      'Straps let you load it without grip failing first.',
      'Лямки дають навантажити без відмови хвату.',
    ],
  },
  {
    match: ['plank'],
    cues: [
      'Elbows under shoulders, squeeze glutes and quads, ribs down, breathe.',
      'Лікті під плечима, напруж сідниці й стегна, ребра вниз, дихай.',
    ],
    mistakes: [
      'Sagging hips, butt high, holding the breath.',
      'Таз провисає, таз задертий, затримуєш дихання.',
    ],
    why: [
      'Full-body tension for 20–40 s beats a lazy 2 minutes.',
      'Повна напруга 20–40 с краще, ніж ліниві 2 хвилини.',
    ],
    deeper: [
      'Progress with RKC planks, side planks, or ab-wheel rollouts.',
      'Ускладнюй: RKC-планка, бічна планка, ролик.',
    ],
  },
  {
    match: ['good morning'],
    cues: [
      'Bar on the back, soft knees, hips back until the torso is near parallel, flat back.',
      'Гриф на спині, коліна м’які, таз назад до майже паралелі корпусу, спина рівна.',
    ],
    mistakes: ['Rounding, going too heavy.', 'Круглиш спину, завелика вага.'],
    why: [
      'It strengthens the hinge and the lower back — light and strict.',
      'Зміцнює нахил і поперек — легко й чисто.',
    ],
    deeper: ['Keep it 3×8–10, well below your deadlift.', '3×8–10, значно легше за станову.'],
  },
  {
    match: ['kettlebell swing', 'swing'],
    cues: [
      'Hike the bell back, snap the hips, arms just ride along, stand tall and squeeze glutes.',
      'Закинь гирю назад між ніг, різко розігни таз, руки лише ведуть, стань рівно й стисни сідниці.',
    ],
    mistakes: [
      'Squatting it, lifting with the arms, leaning back at the top.',
      'Присідаєш, піднімаєш руками, відхиляєшся вгорі.',
    ],
    why: [
      'It’s a hip hinge done fast — power and conditioning in one.',
      'Це нахил у тазу, але швидко — сила й кондиції разом.',
    ],
    deeper: [
      'Bell to chest height is enough; 10–20 reps, rest, repeat.',
      'До рівня грудей достатньо; 10–20 повт., відпочинок, повтор.',
    ],
  },
  {
    match: ['fly', 'flye', 'pec deck'],
    cues: [
      'Slight bend in the elbows, open wide to a stretch, hug a tree back.',
      'Легкий згин у ліктях, розводь до розтягу, «обійми дерево».',
    ],
    mistakes: [
      'Bending the elbows into a press, going too deep.',
      'Згинаєш лікті — виходить жим, заглибоко.',
    ],
    why: [
      'The stretch under load is what makes flys worth doing.',
      'Розтягнення під вагою — саме те, заради чого роблять розведення.',
    ],
    deeper: [
      'Cables or pec deck keep tension where dumbbells lose it.',
      'Блок чи «бабочка» тримають напругу там, де гантелі її втрачають.',
    ],
  },
];

export function techFor(name: string): TechCard | null {
  const n = name.toLowerCase();
  return TECH.find((t) => t.match.some((m) => n.includes(m))) ?? null;
}
