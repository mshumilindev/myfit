/**
 * Fourth HELD-OUT set (blind): written after the robustness round on holdout3, before
 * running the analyser on it, and scored once. Same format and conventions as gold.ts
 * and holdout3.ts. It measures how well the round's general mechanisms transfer to
 * sentences they were never shown.
 *
 * BLIND RESULT (first and only run, analyser at commit ce10c19; overall 95.8 %), and
 * for comparison the analyser from before the round (commit 4e6fe22) on the same
 * sentences (overall 89.3 %) — % correct, new / old:
 *
 * | field        | en (40)     | uk (40)     | ru+ (20)    | pl (17)     | lt (17)     | et (16)     |
 * |--------------|-------------|-------------|-------------|-------------|-------------|-------------|
 * | lang         | 100 / 100   | 100 / 100   | 100 / 100   | 100 / 100   | 100 / 100   | 100 / 100   |
 * | type         | 100 / 97.5  | 95.0 / 92.5 | 100 / 95.0  | 94.1 / 94.1 | 100 / 88.2  | 100 / 93.8  |
 * | questionKind | 100 / 95.0  | 92.5 / 90.0 | 100 / 95.0  | 94.1 / 94.1 | 100 / 94.1  | 100 / 100   |
 * | whWord       | 100 / 97.5  | 90.0 / 90.0 | 90.0 / 90.0 | 88.2 / 88.2 | 94.1 / 88.2 | 100 / 100   |
 * | clauses      | 90.0 / 77.5 | 82.5 / 80.0 | 95.0 / 85.0 | 82.4 / 76.5 | 88.2 / 64.7 | 81.3 / 62.5 |
 * | pred         | 100 / 87.5  | 97.5 / 92.5 | 90.0 / 85.0 | 88.2 / 70.6 | 88.2 / 52.9 | 81.3 / 62.5 |
 * | subject      | 97.5 / 95.0 | 97.5 / 92.5 | 95.0 / 90.0 | 100 / 70.6  | 94.1 / 58.8 | 87.5 / 81.3 |
 * | tense        | 100 / 90.0  | 100 / 95.0  | 85.0 / 80.0 | 88.2 / 64.7 | 94.1 / 64.7 | 87.5 / 68.8 |
 * | negation     | 100 / 100   | 100 / 100   | 100 / 100   | 100 / 100   | 100 / 88.2  | 93.8 / 81.3 |
 * | person       | 97.5 / 95.0 | 97.5 / 92.5 | 95.0 / 90.0 | 100 / 70.6  | 94.1 / 58.8 | 87.5 / 81.3 |
 * | quantities   | 100 / 100   | 100 / 100   | 100 / 95.0  | 94.1 / 94.1 | 100 / 94.1  | 100 / 93.8  |
 * | timeRef      | 100 / 100   | 97.5 / 97.5 | 100 / 100   | 100 / 100   | 100 / 100   | 100 / 100   |
 *
 * Written by the same author who tuned the round, so it may share blind spots with it;
 * the old-vs-new comparison on identical sentences is the fairest measure of the gain.
 */
import type { GoldRow } from './gold';

export const HOLDOUT4: GoldRow[] = [
  // ───────────────────────── English (40) ─────────────────────────
  [
    'en',
    'the program my trainer wrote for me has way too much volume',
    's | main,sub:rel | have other present - 3 | |',
  ],
  [
    'en',
    'Should I have stretched before I went running this morning',
    'q/yesno | main,sub:temp | stretch user past - 1 | | this_morning',
  ],
  [
    'en',
    'my wife thinks I spend too much time at the gym',
    's | main,sub:comp | think other present - 3 | |',
  ],
  [
    'en',
    'How many push ups should a beginner be able to do',
    'q/wh/how_many | main | do other present - 3 | |',
  ],
  [
    'en',
    "I haven't been to the gym since my son was born",
    's | main,sub:temp | be user past + 1 | |',
  ],
  [
    'en',
    'Please log the 12 km bike ride I did on Saturday',
    'c | main,sub:rel | log atlas none - 2 | 12 km | sat',
  ],
  [
    'en',
    'If the weather is bad tomorrow I will train indoors',
    's | sub:cond,main | train user future - 1 | | tomorrow',
  ],
  [
    'en',
    'My back started hurting after I lifted my daughter',
    's | main,sub:temp | start other past - 3 | |',
  ],
  ['en', 'Were you able to count my yoga session', 'q/yesno | main | count atlas past - 2 | |'],
  [
    'en',
    'What exercises would you recommend for a weak lower back',
    'q/wh/what | main | recommend atlas present - 2 | |',
  ],
  [
    'en',
    "I've been feeling tired all week and my lifts are going down",
    's | main,coord | feel user past - 1 | |',
  ],
  [
    'en',
    'Do you know why my calories are so high today',
    'q/wh/why | main,sub:comp | know atlas present - 2 | | today',
  ],
  [
    'en',
    'Tell me what I should eat before a morning run',
    'c//what | main,sub:comp | tell atlas none - 2 | |',
  ],
  [
    'en',
    'The guy who spotted me said my form looked fine',
    's | main,sub:rel,sub:comp | say other past - 3 | |',
  ],
  ['en', 'It took me 25 minutes to run 5 km', 's | main | take other past - 3 | 25 min, 5 km |'],
  [
    'en',
    "I can't believe I ran a whole marathon",
    's | main,sub:comp | believe user present + 1 | |',
  ],
  [
    'en',
    'Would it help if I drank more water',
    'q/yesno | main,sub:cond | help other present - 3 | |',
  ],
  ['en', 'Nobody at my gym does deadlifts', 's | main | do other present + 3 | |'],
  ['en', "Why haven't you updated my plan yet", 'q/wh/why | main | update atlas past + 2 | |'],
  [
    'en',
    'I planned to train today but I got called into work',
    's | main,coord | plan user past - 1 | | today',
  ],
  [
    'en',
    'How long have you been tracking my runs',
    'q/wh/how_long | main | track atlas past - 2 | |',
  ],
  [
    'en',
    'Make the next session shorter because I only have 40 minutes',
    'c | main,sub:caus | make atlas none - 2 | 40 min |',
  ],
  [
    'en',
    'Is there anything I can do about shin splints',
    'q/yesno | main,sub:rel | be other present - 3 | |',
  ],
  ['en', 'Running uphill makes my calves burn', 's | main | make other present - 3 | |'],
  [
    'en',
    'my shoulder clicks every time i raise my arm above my head',
    's | main,sub:temp | click other present - 3 | |',
  ],
  [
    'en',
    'Could you remind me to drink water every hour',
    'q/yesno | main | remind atlas present - 2 | |',
  ],
  ['en', "We're doing a charity run next Sunday", 's | main | do user present - 1 | | sun'],
  ['en', 'I lift better when I sleep more', 's | main,sub:temp | lift user present - 1 | |'],
  [
    'en',
    'Did the app save my workout from yesterday',
    'q/yesno | main | save other past - 3 | | yesterday',
  ],
  ['en', 'I want you to add more pull exercises', 's | main | want user present - 1 | |'],
  [
    'en',
    'Which is healthier brown rice or white rice',
    'q/wh/which | main | be other present - 3 | |',
  ],
  [
    'en',
    "She's been lifting for ten years and still loves it",
    's | main | lift other past - 3 | 10 year |',
  ],
  [
    'en',
    'Let me know when my next deload week is',
    'c//when | main,sub:comp | let atlas none - 2 | |',
  ],
  [
    'en',
    'I think I pulled a muscle doing lunges',
    's | main,sub:comp | think user present - 1 | |',
  ],
  ['en', 'Why do I get headaches after heavy squats', 'q/wh/why | main | get user present - 1 | |'],
  [
    'en',
    'If you were me would you skip leg day',
    'q/yesno | sub:cond,main | skip atlas present - 2 | |',
  ],
  [
    'en',
    'Stop suggesting cardio when I ask about strength',
    'c | main,sub:temp | stop atlas none - 2 | |',
  ],
  [
    'en',
    'My personal best on bench went from 80 to 95 kg this year',
    's | main | go other past - 3 | 95 kg | this_year',
  ],
  [
    'en',
    'How come you never ask how I slept',
    'q/wh/why | main,sub:comp | ask atlas present + 2 | |',
  ],
  [
    'en',
    'After three weeks of rest my knee feels a lot better',
    's | main | feel other present - 3 | 3 week |',
  ],

  // ───────────────────────── Ukrainian (40) ─────────────────────────
  [
    'uk',
    'Програма, яку склав мій тренер, має забагато обсягу',
    's | main,sub:rel | мати other present - 3 | |',
  ],
  [
    'uk',
    'Чи варто було розтягнутися перед тим, як я пішов бігати',
    'q/yesno | main,sub:temp | розтягнутися none past - 0 | |',
  ],
  [
    'uk',
    'Дружина вважає, що я забагато часу проводжу в залі',
    's | main,sub:comp | вважати other present - 3 | |',
  ],
  [
    'uk',
    'Скільки віджимань має робити початківець',
    'q/wh/how_many | main | робити other present - 3 | |',
  ],
  ['uk', 'Я не був у залі відтоді, як народився син', 's | main,sub:temp | бути user past + 1 | |'],
  [
    'uk',
    'Запиши, будь ласка, 12 км на велосипеді, які я проїхав у суботу',
    'c | main,sub:rel | записати atlas none - 2 | 12 km | sat',
  ],
  [
    'uk',
    'Якщо завтра буде погана погода, тренуватимусь удома',
    's | sub:cond,main | тренуватися user future - 1 | | tomorrow',
  ],
  [
    'uk',
    'Спина почала боліти після того, як я підняв доньку',
    's | main,sub:temp | почати other past - 3 | |',
  ],
  ['uk', 'Ти зміг зарахувати моє заняття йогою?', 'q/yesno | main | зарахувати atlas past - 2 | |'],
  [
    'uk',
    'Які вправи ти порадиш для слабкого попереку',
    'q/wh/which | main | порадити atlas future - 2 | |',
  ],
  [
    'uk',
    'Весь тиждень почуваюся втомленим, а ваги падають',
    's | main,coord | почуватися user present - 1 | |',
  ],
  [
    'uk',
    'Ти знаєш, чому в мене сьогодні так багато калорій?',
    'q/wh/why | main,sub:comp | знати atlas present - 2 | | today',
  ],
  [
    'uk',
    'Скажи, що мені їсти перед ранковою пробіжкою',
    'c//what | main,sub:comp | сказати atlas none - 2 | |',
  ],
  [
    'uk',
    'Хлопець, який мене страхував, сказав, що техніка нормальна',
    's | main,sub:rel,sub:comp | сказати other past - 3 | |',
  ],
  [
    'uk',
    'У мене пішло 25 хвилин, щоб пробігти 5 км',
    's | main,sub:purp | піти other past - 3 | 25 min, 5 km |',
  ],
  [
    'uk',
    'Не можу повірити, що пробіг цілий марафон',
    's | main,sub:comp | повірити user present + 1 | |',
  ],
  [
    'uk',
    'Чи допоможе, якщо я питиму більше води',
    'q/yesno | main,sub:cond | допомогти other future - 3 | |',
  ],
  ['uk', 'У моєму залі ніхто не робить станову', 's | main | робити other present + 3 | |'],
  ['uk', 'Чому ти досі не оновив мій план', 'q/wh/why | main | оновити atlas past + 2 | |'],
  [
    'uk',
    'Я планував потренуватися сьогодні, але мене викликали на роботу',
    's | main,coord | планувати user past - 1 | | today',
  ],
  [
    'uk',
    'Скільки часу ти вже рахуєш мої пробіжки',
    'q/wh/how_long | main | рахувати atlas present - 2 | |',
  ],
  [
    'uk',
    'Зроби наступне тренування коротшим, бо в мене лише 40 хвилин',
    'c | main,sub:caus | зробити atlas none - 2 | 40 min |',
  ],
  [
    'uk',
    'Чи можна щось зробити з болем у гомілках',
    'q/yesno | main | зробити none present - 0 | |',
  ],
  ['uk', 'Біг вгору змушує литки горіти', 's | main | змушувати other present - 3 | |'],
  [
    'uk',
    'плече клацає щоразу коли я піднімаю руку над головою',
    's | main,sub:temp | клацати other present - 3 | |',
  ],
  [
    'uk',
    'Можеш нагадувати мені пити воду щогодини',
    'q/yesno | main | нагадувати atlas present - 2 | |',
  ],
  [
    'uk',
    'Наступної неділі ми біжимо благодійний забіг',
    's | main | бігти user present - 1 | | sun',
  ],
  [
    'uk',
    'Я краще тренуюся, коли більше сплю',
    's | main,sub:temp | тренуватися user present - 1 | |',
  ],
  [
    'uk',
    'Застосунок зберіг моє вчорашнє тренування?',
    'q/yesno | main | зберегти other past - 3 | | yesterday',
  ],
  [
    'uk',
    'Я хочу, щоб ти додав більше тягових вправ',
    's | main,sub:comp | хотіти user present - 1 | |',
  ],
  [
    'uk',
    "Що краще для здоров'я, бурий рис чи білий",
    'q/wh/what | main | краще other present - 3 | |',
  ],
  [
    'uk',
    'Вона тягає залізо вже десять років і досі прогресує',
    's | main | тягати other present - 3 | 10 year |',
  ],
  [
    'uk',
    'Дай знати, коли в мене наступний тиждень розвантаження',
    'c//when | main,sub:comp | дати atlas none - 2 | |',
  ],
  [
    'uk',
    "Здається, я потягнув м'яз, коли робив випади",
    's | main,sub:comp,sub:temp | здаватися none present - 0 | |',
  ],
  [
    'uk',
    'Чому в мене болить голова після важких присідань',
    'q/wh/why | main | боліти other present - 3 | |',
  ],
  [
    'uk',
    'Якби ти був на моєму місці, ти б пропустив день ніг?',
    'q/yesno | sub:cond,main | пропустити atlas past - 2 | |',
  ],
  [
    'uk',
    'Перестань пропонувати кардіо, коли я питаю про силу',
    'c | main,sub:temp | перестати atlas none - 2 | |',
  ],
  [
    'uk',
    'Мій рекорд у жимі за цей рік виріс з 80 до 95 кг',
    's | main | вирости other past - 3 | 95 kg |',
  ],
  [
    'uk',
    'Чого ти ніколи не питаєш, як я спав',
    'q/wh/why | main,sub:comp | питати atlas present + 2 | |',
  ],
  [
    'uk',
    'Після трьох тижнів відпочинку коліно почувається набагато краще',
    's | main | почуватися other present - 3 | 3 week |',
  ],

  // ─────────────── Russian / surzhyk / transliteration (20) ───────────────
  [
    'ru',
    'Программа, которую написал тренер, слишком тяжелая',
    's | main,sub:rel | тяжелый other present - 3 | |',
  ],
  [
    'ru',
    'Если завтра будет дождь, я буду тренироваться дома',
    's | sub:cond,main | тренироваться user future - 1 | | tomorrow',
  ],
  [
    'ru',
    'Почему ты до сих пор не обновил мой план',
    'q/wh/why | main | обновить atlas past + 2 | |',
  ],
  [
    'ru',
    'Мне кажется, я потянул мышцу на выпадах',
    's | main,sub:comp | казаться user present - 1 | |',
  ],
  [
    'ru',
    'Сколько отжиманий должен делать новичок',
    'q/wh/how_many | main | делать other present - 3 | |',
  ],
  [
    'ru',
    'Запиши 12 км на велосипеде, которые я проехал в субботу',
    'c | main,sub:rel | записать atlas none - 2 | 12 km | sat',
  ],
  [
    'ru',
    'Я не могу поверить, что пробежал марафон',
    's | main,sub:comp | поверить user present + 1 | |',
  ],
  [
    'ru',
    'После трех недель отдыха колено болит намного меньше',
    's | main | болеть other present - 3 | 3 week |',
  ],
  [
    'sz',
    'шо мені їсти перед тренькой шоб були сили',
    'q/wh/what | main,sub:purp | їсти user none - 1 | |',
  ],
  [
    'sz',
    'вчора так забив ноги шо сьодні ходити не можу',
    's | main,sub:res | забити user past - 1 | | yesterday',
  ],
  [
    'sz',
    'тренер сказав шо мені нада менше кардіо',
    's | main,sub:comp | сказати other past - 3 | |',
  ],
  ['sz', 'чого ти не зарахував мою тренірофку', 'q/wh/why | main | зарахувати atlas past + 2 | |'],
  [
    'sz',
    'завтра буду качать ноги якшо нічо не болітиме',
    's | main,sub:cond | качати user future - 1 | | tomorrow',
  ],
  [
    'uk-tr',
    'chomu u mene bolyt golova pislia prysidan',
    'q/wh/why | main | боліти other present - 3 | |',
  ],
  [
    'uk-tr',
    'skazhy shcho meni yisty pered bigom',
    'c//what | main,sub:comp | сказати atlas none - 2 | |',
  ],
  [
    'uk-tr',
    'ya vchora ne trenuvavsia bo buv khvoryi',
    's | main,sub:caus | тренуватися user past + 1 | | yesterday',
  ],
  ['uk-tr', 'zavtra pobizhu 10 km', 's | main | побігти user future - 1 | 10 km | tomorrow'],
  [
    'ru-tr',
    'pochemu ty ne zaschital moyu probezhku',
    'q/wh/why | main | засчитать atlas past + 2 | |',
  ],
  ['ru-tr', 'ya ustal i hochu segodnya otdohnut', 's | main | устать user past - 1 | | today'],
  ['ru-tr', 'skolko belka nuzhno est v den', 'q/wh/how_much | main | есть none present - 0 | |'],

  // ───────────────────────── Polish (17) ─────────────────────────
  [
    'pl',
    'Plan, który napisał mój trener, ma za dużo objętości',
    's | main,sub:rel | mieć other present - 3 | |',
  ],
  [
    'pl',
    'Jeśli jutro będzie brzydka pogoda, będę trenować w domu',
    's | sub:cond,main | trenować user future - 1 | | tomorrow',
  ],
  [
    'pl',
    'Dlaczego jeszcze nie zaktualizowałeś mojego planu',
    'q/wh/why | main | zaktualizować atlas past + 2 | |',
  ],
  [
    'pl',
    'Wydaje mi się, że naciągnąłem mięsień',
    's | main,sub:comp | wydawać user present - 1 | |',
  ],
  [
    'pl',
    'Ile pompek powinien robić początkujący',
    'q/wh/how_many | main | robić other present - 3 | |',
  ],
  [
    'pl',
    'Zapisz 12 km na rowerze, które przejechałem w sobotę',
    'c | main,sub:rel | zapisać atlas none - 2 | 12 km | sat',
  ],
  [
    'pl',
    'Nie mogę uwierzyć, że przebiegłem maraton',
    's | main,sub:comp | uwierzyć user present + 1 | |',
  ],
  [
    'pl',
    'Po trzech tygodniach odpoczynku kolano boli dużo mniej',
    's | main | boleć other present - 3 | 3 week |',
  ],
  [
    'pl',
    'Co powinienem jeść przed porannym bieganiem',
    'q/wh/what | main | jeść user present - 1 | |',
  ],
  [
    'pl',
    'Wczoraj tak zmęczyłem nogi, że dziś nie mogę chodzić',
    's | main,sub:res | zmęczyć user past - 1 | | yesterday',
  ],
  [
    'pl',
    'Trener powiedział, że potrzebuję mniej cardio',
    's | main,sub:comp | powiedzieć other past - 3 | |',
  ],
  ['pl', 'Czemu nie zaliczyłeś mojego treningu', 'q/wh/why | main | zaliczyć atlas past + 2 | |'],
  [
    'pl',
    'Jutro będę ćwiczyć nogi, jeśli nic mnie nie będzie boleć',
    's | main,sub:cond | ćwiczyć user future - 1 | | tomorrow',
  ],
  [
    'pl',
    'Dlaczego po przysiadach boli mnie głowa',
    'q/wh/why | main | boleć other present - 3 | |',
  ],
  [
    'pl',
    'Powiedz mi, jak poprawić technikę martwego ciągu',
    'c//how | main,sub:comp | powiedzieć atlas none - 2 | |',
  ],
  ['pl', 'Jestem zmęczony i dziś chcę odpocząć', 's | main | być user present - 1 | | today'],
  ['pl', 'Ile białka trzeba jeść dziennie', 'q/wh/how_much | main | jeść none present - 0 | |'],

  // ───────────────────────── Lithuanian (17) ─────────────────────────
  [
    'lt',
    'Planas, kurį parašė mano treneris, turi per daug apimties',
    's | main,sub:rel | turėti other present - 3 | |',
  ],
  [
    'lt',
    'Jei rytoj bus blogas oras, treniruosiuosi namuose',
    's | sub:cond,main | treniruotis user future - 1 | | tomorrow',
  ],
  [
    'lt',
    'Kodėl vis dar neatnaujinai mano plano',
    'q/wh/why | main | atnaujinti atlas past + 2 | |',
  ],
  ['lt', 'Man atrodo, kad patempiau raumenį', 's | main,sub:comp | atrodyti user present - 1 | |'],
  [
    'lt',
    'Kiek atsispaudimų turėtų daryti pradedantysis',
    'q/wh/how_many | main | daryti other present - 3 | |',
  ],
  [
    'lt',
    'Užrašyk 12 km dviračiu, kuriuos nuvažiavau šeštadienį',
    'c | main,sub:rel | užrašyti atlas none - 2 | 12 km | sat',
  ],
  [
    'lt',
    'Negaliu patikėti, kad nubėgau maratoną',
    's | main,sub:comp | patikėti user present + 1 | |',
  ],
  [
    'lt',
    'Po trijų savaičių poilsio kelį skauda daug mažiau',
    's | main | skaudėti none present - 0 | 3 week |',
  ],
  [
    'lt',
    'Ką turėčiau valgyti prieš rytinį bėgimą',
    'q/wh/what | main | valgyti user present - 1 | |',
  ],
  [
    'lt',
    'Vakar taip pavargau, kad šiandien negaliu vaikščioti',
    's | main,sub:res | pavargti user past - 1 | | yesterday',
  ],
  [
    'lt',
    'Treneris pasakė, kad man reikia mažiau kardio',
    's | main,sub:comp | pasakyti other past - 3 | |',
  ],
  ['lt', 'Kodėl neįskaitei mano treniruotės', 'q/wh/why | main | įskaityti atlas past + 2 | |'],
  [
    'lt',
    'Rytoj treniruosiu kojas, jei niekas neskaudės',
    's | main,sub:cond | treniruoti user future - 1 | | tomorrow',
  ],
  ['lt', 'Kodėl po pritūpimų man skauda galvą', 'q/wh/why | main | skaudėti user present - 1 | |'],
  [
    'lt',
    'Pasakyk, kaip pagerinti mirties traukos techniką',
    'c//how | main,sub:comp | pasakyti atlas none - 2 | |',
  ],
  ['lt', 'Esu pavargęs ir šiandien noriu pailsėti', 's | main | būti user present - 1 | | today'],
  [
    'lt',
    'Kiek baltymų reikia suvalgyti per dieną',
    'q/wh/how_much | main | suvalgyti none present - 0 | |',
  ],

  // ───────────────────────── Estonian (16) ─────────────────────────
  [
    'et',
    'Plaan, mille mu treener kirjutas, on liiga mahukas',
    's | main,sub:rel | olema other present - 3 | |',
  ],
  [
    'et',
    'Kui homme on halb ilm, treenin kodus',
    's | sub:cond,main | treenima user present - 1 | | tomorrow',
  ],
  ['et', 'Miks sa pole veel mu plaani uuendanud', 'q/wh/why | main | uuendama atlas past + 2 | |'],
  [
    'et',
    'Mulle tundub, et venitasin lihase ära',
    's | main,sub:comp | tunduma user present - 1 | |',
  ],
  [
    'et',
    'Mitu kätekõverdust peaks algaja tegema',
    'q/wh/how_many | main | tegema other present - 3 | |',
  ],
  [
    'et',
    'Pane kirja 12 km rattasõitu, mille ma laupäeval tegin',
    'c | main,sub:rel | panema atlas none - 2 | 12 km | sat',
  ],
  [
    'et',
    'Ma ei suuda uskuda, et jooksin maratoni',
    's | main,sub:comp | uskuma user present + 1 | |',
  ],
  [
    'et',
    'Pärast kolme nädalat puhkust valutab põlv palju vähem',
    's | main | valutama other present - 3 | 3 week |',
  ],
  [
    'et',
    'Mida ma peaksin enne hommikust jooksu sööma',
    'q/wh/what | main | sööma user present - 1 | |',
  ],
  [
    'et',
    'Eile väsitasin jalad nii ära, et täna ei saa kõndida',
    's | main,sub:res | väsitama user past - 1 | | yesterday',
  ],
  [
    'et',
    'Treener ütles, et mul on vaja vähem kardiot',
    's | main,sub:comp | ütlema other past - 3 | |',
  ],
  ['et', 'Miks sa mu trenni arvesse ei võtnud', 'q/wh/why | main | võtma atlas past + 2 | |'],
  [
    'et',
    'Homme treenin jalgu, kui miski ei valuta',
    's | main,sub:cond | treenima user present - 1 | | tomorrow',
  ],
  ['et', 'Miks mul pärast kükke pea valutab', 'q/wh/why | main | valutama other present - 3 | |'],
  [
    'et',
    'Ütle, kuidas jõutõmbe tehnikat parandada',
    'c//how | main,sub:comp | ütlema atlas none - 2 | |',
  ],
  ['et', 'Olen väsinud ja täna tahan puhata', 's | main | olema user present - 1 | | today'],
];
