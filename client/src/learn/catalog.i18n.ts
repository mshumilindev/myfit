/**
 * Localised Learn catalog copy. catalog.ts holds the English source (also the
 * shot-list); this file translates every topic and lesson title + blurb into the
 * suite's other four languages. Anything missing falls back to English.
 *
 * Keyed by the stable topic id / lesson id from catalog.ts.
 */
import type { LearnTopicId } from './catalog';

type Lang = 'uk' | 'pl' | 'lt' | 'et';
export interface Tx {
  title: string;
  blurb: string;
}

export const TOPIC_TX: Record<Lang, Record<LearnTopicId, Tx>> = {
  uk: {
    basics: { title: 'Основи', blurb: 'Додаток, перше тренування та лог' },
    logging: { title: 'Логування', blurb: 'Підходи, суперсети, таймер відпочинку' },
    activities: {
      title: 'Кардіо та відновлення',
      blurb: 'Активності з таймером, зусилля, дні відпочинку',
    },
    programs: { title: 'Програми', blurb: 'Шаблони Playbook, тижні, призначення' },
    progress: { title: 'Прогрес і графіки', blurb: 'Обсяг, тренди, рекорди, метрики тіла' },
    exercises: { title: 'Вправи', blurb: 'Бібліотека, власні вправи, історія' },
    gyms: { title: 'Зали', blurb: 'Додати зал, обладнання, гумки' },
    apex: { title: 'Apex і челенджі', blurb: 'Гейміфікація, ранги, нагороди, стрічка' },
    people: { title: 'Люди', blurb: 'Профіль, клієнти, користувачі та ролі' },
    account: { title: 'Акаунт і застосунок', blurb: 'Налаштування, офлайн, встановлення, вхід' },
  },
  pl: {
    basics: { title: 'Podstawy', blurb: 'Aplikacja, pierwszy trening i wpis' },
    logging: { title: 'Zapisywanie', blurb: 'Serie, superserie, timer przerw' },
    activities: {
      title: 'Cardio i regeneracja',
      blurb: 'Aktywności z timerem, wysiłek, dni wolne',
    },
    programs: { title: 'Programy', blurb: 'Szablony Playbook, tygodnie, przypisania' },
    progress: { title: 'Postępy i wykresy', blurb: 'Objętość, trendy, rekordy, pomiary ciała' },
    exercises: { title: 'Ćwiczenia', blurb: 'Biblioteka, własne ćwiczenia, historia' },
    gyms: { title: 'Siłownie', blurb: 'Dodaj siłownię, sprzęt, gumy' },
    apex: { title: 'Apex i wyzwania', blurb: 'Grywalizacja, rangi, nagrody, aktualności' },
    people: { title: 'Ludzie', blurb: 'Profil, klienci, użytkownicy i role' },
    account: { title: 'Konto i aplikacja', blurb: 'Ustawienia, offline, instalacja, logowanie' },
  },
  lt: {
    basics: { title: 'Pagrindai', blurb: 'Programa, pirma treniruotė ir įrašas' },
    logging: { title: 'Žymėjimas', blurb: 'Serijos, supersetai, poilsio laikmatis' },
    activities: {
      title: 'Kardio ir atsigavimas',
      blurb: 'Veiklos su laikmačiu, pastangos, poilsio dienos',
    },
    programs: { title: 'Programos', blurb: 'Playbook šablonai, savaitės, priskyrimai' },
    progress: {
      title: 'Pažanga ir grafikai',
      blurb: 'Apimtis, tendencijos, rekordai, kūno rodikliai',
    },
    exercises: { title: 'Pratimai', blurb: 'Biblioteka, savi pratimai, istorija' },
    gyms: { title: 'Salės', blurb: 'Pridėti salę, įranga, gumos' },
    apex: { title: 'Apex ir iššūkiai', blurb: 'Žaidybinimas, rangai, apdovanojimai, srautas' },
    people: { title: 'Žmonės', blurb: 'Profilis, klientai, naudotojai ir rolės' },
    account: {
      title: 'Paskyra ir programa',
      blurb: 'Nustatymai, neprisijungus, diegimas, prisijungimas',
    },
  },
  et: {
    basics: { title: 'Põhitõed', blurb: 'Rakendus, esimene treening ja sissekanne' },
    logging: { title: 'Logimine', blurb: 'Seeriad, supersetid, puhketaimer' },
    activities: {
      title: 'Kardio ja taastumine',
      blurb: 'Taimeriga tegevused, pingutus, puhkepäevad',
    },
    programs: { title: 'Programmid', blurb: 'Playbook mallid, nädalad, määramised' },
    progress: { title: 'Edenemine ja graafikud', blurb: 'Maht, trendid, rekordid, keha näitajad' },
    exercises: { title: 'Harjutused', blurb: 'Teek, oma harjutused, ajalugu' },
    gyms: { title: 'Jõusaalid', blurb: 'Lisa jõusaal, varustus, kummid' },
    apex: { title: 'Apex ja väljakutsed', blurb: 'Mängustamine, auastmed, autasud, voog' },
    people: { title: 'Inimesed', blurb: 'Profiil, kliendid, kasutajad ja rollid' },
    account: { title: 'Konto ja rakendus', blurb: 'Seaded, ühenduseta, paigaldus, sisselogimine' },
  },
};

export const LESSON_TX: Record<Lang, Record<string, Tx>> = {
  uk: {
    'take-the-tour': {
      title: 'Старт за 3 хвилини',
      blurb:
        'Швидкий огляд чотирьох вкладок — Today, Progress, Programs, Gyms — і перемикача додатків.',
    },
    'the-shell': {
      title: 'Перемикання між додатками',
      blurb: 'Відкрийте перемикач і переходьте між Gym, Apex, People та Learn.',
    },
    'today-screen': {
      title: 'Екран Today',
      blurb: 'Читаємо Today: план, серія, швидкі дії та блок активного тренування.',
    },
    'first-workout': {
      title: 'Налаштуйте перше тренування',
      blurb: 'Почніть сесію з шаблону, замініть вправу й задайте цільові підходи.',
    },
    'log-first-set': {
      title: 'Швидке логування підходу',
      blurb: 'Введіть вагу й повтори, позначте розминку і завершіть підхід за секунди.',
    },
    'install-app': {
      title: 'Встановіть Spotter на телефон',
      blurb: 'Додайте Spotter на головний екран — відкривається на весь екран і працює офлайн.',
    },
    language: {
      title: 'Зміна мови',
      blurb:
        'Перемикайте Spotter між англійською, українською, польською, литовською та естонською.',
    },
    'sets-reps': {
      title: 'Підходи, повтори і вага',
      blurb: 'Рядок підходу: вага, повтори, RPE і як наступний підхід підставляється з минулого.',
    },
    'edit-delete-set': {
      title: 'Редагувати чи видалити підхід',
      blurb: 'Виправте помилковий підхід, видаліть його або змініть порядок підходів.',
    },
    warmups: {
      title: 'Розминкові підходи',
      blurb: 'Позначайте розминку, щоб вона зараховувалась у сесію, але не в робочий обсяг.',
    },
    prs: {
      title: 'Рекорди під час тренування',
      blurb: 'Дивіться, як новий рекорд визначається і відзначається прямо під час логування.',
    },
    supersets: {
      title: 'Суперсети й колові',
      blurb: 'Обʼєднуйте вправи в суперсет і логуйте їх коло за колом.',
    },
    'rest-timer': {
      title: 'Таймер відпочинку',
      blurb: 'Авто-відпочинок між підходами, зміна тривалості й сповіщення про завершення.',
    },
    'swap-exercise': {
      title: 'Заміна вправи під час сесії',
      blurb: 'Замініть вправу на льоту, зберігши цільові підходи.',
    },
    'add-exercise-session': {
      title: 'Додати вправу до сесії',
      blurb: 'Додайте ще одну вправу в сьогоднішнє тренування з бібліотеки.',
    },
    'load-entry': {
      title: 'Гумки, ланцюги й асистування',
      blurb: 'Логуйте резинки, ланцюги та асистовані повтори за допомогою помічника навантаження.',
    },
    'plate-math': {
      title: 'Розрахунок млинців',
      blurb: 'Нехай Spotter порахує млинці з кожного боку для цільової ваги.',
    },
    'set-notes': {
      title: 'Нотатки до підходу чи сесії',
      blurb: 'Додайте коротку нотатку до підходу або всієї сесії.',
    },
    backfill: {
      title: 'Залогувати минуле тренування',
      blurb: 'Внесіть тренування, яке було раніше — задайте дату, час і зусилля постфактум.',
    },
    'finish-review': {
      title: 'Завершити й переглянути сесію',
      blurb: 'Завершіть сесію, перегляньте обсяг і рекорди та прочитайте підсумок.',
    },
    'history-list': {
      title: 'Історія ваших сесій',
      blurb: 'Переглядайте минулі сесії, відкривайте їх знову й дивіться, що робили.',
    },
    'log-activity': {
      title: 'Кардіо або відновлення',
      blurb: 'Запустіть таймер для бігу, ходьби чи розтяжки або внесіть із тривалістю.',
    },
    'activity-timeline': {
      title: 'Час початку і тривалість',
      blurb: 'Задайте, коли була активність і скільки тривала, на шкалі часу.',
    },
    'effort-gauge': {
      title: 'Зусилля на шкалі',
      blurb: 'Виставте зусилля від легкого до важкого і дивіться, як змінюється оцінка.',
    },
    'activity-calories': {
      title: 'Як рахуються калорії',
      blurb: 'Дивіться, як калорії масштабуються за типом активності та інтенсивністю.',
    },
    'rest-periods': {
      title: 'Відпочинок і відпустки',
      blurb: 'Позначте період відпочинку, щоб перерва не рахувалась як пропущений день.',
    },
    'rest-day-streak': {
      title: 'Дні відпочинку і серія',
      blurb: 'Як зарахування днів відпочинку зберігає вашу серію активності.',
    },
    playbook: {
      title: 'Огляд Playbook',
      blurb: 'Досліджуйте готові шаблони програм і виберіть той, що пасує вашій меті.',
    },
    'playbook-categories': {
      title: 'Знайти потрібний шаблон',
      blurb: 'Фільтруйте Playbook за метою, днями на тиждень і досвідом.',
    },
    'start-program': {
      title: 'Почати програму',
      blurb: 'Розпочніть програму, побачте активний тиждень і почніть сьогодні за планом.',
    },
    'active-week': {
      title: 'Активний тиждень і сьогодні',
      blurb: 'Читайте поточний тиждень, відмічайте дні й переходьте до сьогоднішньої сесії.',
    },
    'program-week': {
      title: 'Скласти тиждень програми',
      blurb: 'Побудуйте тиждень: додайте дні, вправи й задайте цільові підходи та повтори.',
    },
    'edit-program': {
      title: 'Редагувати й упорядкувати програму',
      blurb: 'Перейменуйте, змініть порядок днів, замініть вправи й дублюйте тиждень.',
    },
    templates: {
      title: 'Зберегти сесію як шаблон',
      blurb: 'Перетворіть вподобану сесію на багаторазовий шаблон.',
    },
    'assign-program': {
      title: 'Призначити програму',
      blurb: 'Призначте програму учаснику, зберігаючи один активний план на людину.',
    },
    'import-program': {
      title: 'Імпорт програми з CSV',
      blurb: 'Масово створіть програму, імпортувавши CSV із днями, вправами й підходами.',
    },
    'export-program': {
      title: 'Експорт і поширення програми',
      blurb: 'Експортуйте програму в CSV для резервної копії чи передачі іншому тренеру.',
    },
    'first-chart': {
      title: 'Читаємо перший графік',
      blurb: 'Зрозумійте графік обсягу на Progress і що означає кожен стовпчик.',
    },
    'volume-lens': {
      title: 'Обсяг, підходи й тоннаж',
      blurb: 'Перемикайте лінзу прогресу між підходами, повторами й тоннажем.',
    },
    'progress-range': {
      title: 'Тиждень, місяць і весь час',
      blurb: 'Змінюйте діапазон часу, щоб читати коротко- і довгострокове навантаження.',
    },
    trends: {
      title: 'Тренди в часі',
      blurb: 'Читайте тренди — тижневий обсяг, частоту й серію активності.',
    },
    records: {
      title: 'Ваші рекорди',
      blurb: 'Де живуть рекорди й як побачити найкращий підхід у вправі.',
    },
    'one-rm': {
      title: 'Оцінка 1ПМ',
      blurb: 'Як Spotter оцінює ваш одноповторний максимум і чому він змінюється.',
    },
    'muscle-map': {
      title: 'Історія мʼязів і карта',
      blurb: 'Дивіться обсяг за групами мʼязів і читайте мʼязову карту.',
    },
    'weak-points': {
      title: 'Знайти слабкі місця',
      blurb: 'Знаходьте недотреновані мʼязи й балансуйте тиждень.',
    },
    'body-metrics': {
      title: 'Метрики тіла і зважування',
      blurb: 'Логуйте вагу, зріст і склад тіла та читайте тренд метрик.',
    },
    'weigh-in-reminder': {
      title: 'Нагадування про зважування',
      blurb: 'Отримуйте нагадування зважитись і відкладайте його на день.',
    },
    'exercise-library': {
      title: 'Бібліотека вправ',
      blurb: 'Шукайте в каталозі й фільтруйте за мʼязами та обладнанням.',
    },
    'exercise-favorites': {
      title: 'Улюблені й закріплені вправи',
      blurb: 'Закріпіть вправи, якими користуєтесь найчастіше, щоб вони були зверху.',
    },
    'custom-exercise': {
      title: 'Створити власну вправу',
      blurb: 'Додайте свою вправу з мʼязами й обладнанням, щоб вона зʼявлялась усюди.',
    },
    'exercise-detail': {
      title: 'Деталі вправи й історія',
      blurb: 'Відкрийте вправу, щоб побачити історію підходів, рекорди й тренд.',
    },
    'exercise-catalog-admin': {
      title: 'Курувати спільний каталог',
      blurb: 'Додавайте чи редагуйте вправи у спільному каталозі, яким користуються всі.',
    },
    'add-gym': {
      title: 'Додати зал',
      blurb: 'Збережіть зал з локацією, щоб Spotter пропонував його автоматично.',
    },
    'gym-suggest': {
      title: 'Автопідказки залу',
      blurb: 'Як Spotter визначає зал, у якому ви є, і як це перевизначити.',
    },
    equipment: {
      title: 'Облік обладнання',
      blurb: 'Позначте наявне обладнання, щоб попередження показувались лише про відсутнє.',
    },
    'band-library': {
      title: 'Бібліотека гумок',
      blurb: 'Задайте орієнтовний опір кожного кольору гумки один раз на зал.',
    },
    'apex-overview': {
      title: 'Що таке Apex?',
      blurb: 'Огляд Apex — як тренування перетворюється на ранги, нагороди й челенджі.',
    },
    'apex-home': {
      title: 'Головна Apex',
      blurb: 'Читайте огляд Apex: ранг, активні челенджі й останні досягнення.',
    },
    challenges: {
      title: 'Приєднатися до челенджу',
      blurb: 'Знайдіть активний челендж, приєднайтесь і відстежуйте позицію.',
    },
    ranks: {
      title: 'Ранги й силові стандарти',
      blurb: 'Як ваші вправи відповідають силовим стандартам і як здобуваються ранги.',
    },
    awards: {
      title: 'Нагороди й досягнення',
      blurb: 'Досягнення, які можна відкрити, і де живуть ваші нагороди.',
    },
    feed: {
      title: 'Сповіщення й стрічка',
      blurb: 'Читайте стрічку Apex і дзвіночок — що і чому вас сповіщає.',
    },
    'your-profile': {
      title: 'Ваш профіль',
      blurb: 'Редагуйте імʼя, аватар і базові дані тіла в додатку People.',
    },
    avatar: {
      title: 'Встановіть фото',
      blurb: 'Завантажте й обріжте аватар, щоб він показувався по всьому suite.',
    },
    'clients-roster': {
      title: 'Список ваших клієнтів',
      blurb: 'Переглядайте учасників, шукайте у списку й відкривайте клієнта.',
    },
    'client-detail': {
      title: 'Тренування клієнта',
      blurb: 'Відкрийте учасника, щоб переглянути тренування й призначити програму.',
    },
    'trainer-notes': {
      title: 'Нотатки тренера',
      blurb: 'Залишайте приватні нотатки про учасника, які бачать лише тренери.',
    },
    'users-admin': {
      title: 'Керування користувачами',
      blurb: 'Переглядайте всі акаунти, шукайте й відкривайте користувача як адмін.',
    },
    roles: {
      title: 'Ролі й доступ',
      blurb: 'Що можуть учасник, тренер і адмін та як змінити роль.',
    },
    invites: {
      title: 'Запросити людей',
      blurb: 'Створіть посилання-запрошення, щоб нова людина могла приєднатись.',
    },
    audit: {
      title: 'Доступ і журнал аудиту',
      blurb: 'Читайте журнал того, хто переглядав дані учасника.',
    },
    'offline-sync': {
      title: 'Офлайн і синхронізація',
      blurb: 'Як Spotter працює офлайн і синхронізується, коли зʼявляється мережа.',
    },
    'sync-conflict': {
      title: 'Коли синхронізацію заблоковано',
      blurb: 'Що означає картка блокування синхронізації і як повторити чи відхилити.',
    },
    'app-update': {
      title: 'Оновити застосунок',
      blurb: 'Як працює плашка оновлення й оновлення до останньої версії.',
    },
    notifications: {
      title: 'Сповіщення й нагадування',
      blurb: 'Де зʼявляються сповіщення і як на них реагувати.',
    },
    'sign-out': {
      title: 'Вийти й змінити акаунт',
      blurb: 'Вийдіть безпечно, зокрема що стається з несинхронізованими даними.',
    },
    'settings-flags': {
      title: 'Налаштування й фіча-флаги',
      blurb: 'Вмикайте чи вимикайте ранні функції в адмін-налаштуваннях.',
    },
  },
  pl: {
    'take-the-tour': {
      title: 'Start w 3 minuty',
      blurb:
        'Szybki przegląd czterech kart — Today, Progress, Programs, Gyms — i przełącznika aplikacji.',
    },
    'the-shell': {
      title: 'Przełączanie aplikacji',
      blurb: 'Otwórz przełącznik i przechodź między Gym, Apex, People i Learn.',
    },
    'today-screen': {
      title: 'Ekran Today',
      blurb: 'Czytaj Today: plan, seria, szybkie akcje i panel aktywnego treningu.',
    },
    'first-workout': {
      title: 'Ustaw pierwszy trening',
      blurb: 'Zacznij sesję z szablonu, zamień ćwiczenie i ustaw docelowe serie.',
    },
    'log-first-set': {
      title: 'Szybkie zapisanie serii',
      blurb: 'Wpisz ciężar i powtórzenia, oznacz rozgrzewkę i zakończ serię w sekundy.',
    },
    'install-app': {
      title: 'Zainstaluj Spotter na telefonie',
      blurb: 'Dodaj Spotter do ekranu głównego — otwiera się na pełnym ekranie i działa offline.',
    },
    language: {
      title: 'Zmiana języka',
      blurb: 'Przełączaj Spotter między angielskim, ukraińskim, polskim, litewskim i estońskim.',
    },
    'sets-reps': {
      title: 'Serie, powtórzenia i ciężar',
      blurb:
        'Wiersz serii: ciężar, powtórzenia, RPE i jak następna seria wypełnia się z poprzedniej.',
    },
    'edit-delete-set': {
      title: 'Edytuj lub usuń serię',
      blurb: 'Popraw błędną serię, usuń ją albo zmień kolejność serii.',
    },
    warmups: {
      title: 'Serie rozgrzewkowe',
      blurb: 'Oznacz rozgrzewkę, aby liczyła się do sesji, ale nie do objętości roboczej.',
    },
    prs: {
      title: 'Rekordy podczas treningu',
      blurb: 'Zobacz, jak nowy rekord jest wykrywany i świętowany w chwili zapisu.',
    },
    supersets: {
      title: 'Superserie i obwody',
      blurb: 'Grupuj ćwiczenia w superserię i zapisuj je runda po rundzie.',
    },
    'rest-timer': {
      title: 'Timer przerw',
      blurb: 'Auto-przerwa między seriami, zmiana czasu i powiadomienie o końcu.',
    },
    'swap-exercise': {
      title: 'Zamiana ćwiczenia w sesji',
      blurb: 'Zamień ćwiczenie w locie, zachowując docelowe serie.',
    },
    'add-exercise-session': {
      title: 'Dodaj ćwiczenie do sesji',
      blurb: 'Dodaj dodatkowe ćwiczenie do dzisiejszego treningu z biblioteki.',
    },
    'load-entry': {
      title: 'Gumy, łańcuchy i asysta',
      blurb: 'Zapisuj gumy, łańcuchy i powtórzenia z asystą przy pomocy asystenta obciążenia.',
    },
    'plate-math': {
      title: 'Obliczanie talerzy',
      blurb: 'Niech Spotter obliczy talerze na stronę dla docelowego ciężaru.',
    },
    'set-notes': {
      title: 'Notatki do serii lub sesji',
      blurb: 'Dodaj krótką notatkę do serii lub całej sesji.',
    },
    backfill: {
      title: 'Zapisz przeszły trening',
      blurb: 'Uzupełnij trening zrobiony wcześniej — ustaw datę, czas i wysiłek po fakcie.',
    },
    'finish-review': {
      title: 'Zakończ i przejrzyj sesję',
      blurb: 'Zakończ sesję, przejrzyj objętość i rekordy oraz przeczytaj podsumowanie.',
    },
    'history-list': {
      title: 'Historia twoich sesji',
      blurb: 'Przeglądaj przeszłe sesje, otwieraj je ponownie i zobacz, co robiłeś.',
    },
    'log-activity': {
      title: 'Cardio lub regeneracja',
      blurb: 'Uruchom timer dla biegu, spaceru czy rozciągania albo uzupełnij z czasem.',
    },
    'activity-timeline': {
      title: 'Czas startu i trwanie',
      blurb: 'Ustaw, kiedy była aktywność i jak długo trwała, na osi czasu.',
    },
    'effort-gauge': {
      title: 'Wysiłek na skali',
      blurb: 'Ustaw wysiłek od lekkiego do ciężkiego i patrz, jak zmienia się szacunek.',
    },
    'activity-calories': {
      title: 'Jak liczone są kalorie',
      blurb: 'Zobacz, jak kalorie skalują się według typu aktywności i intensywności.',
    },
    'rest-periods': {
      title: 'Odpoczynek i urlopy',
      blurb: 'Oznacz okres odpoczynku, aby przerwa nie liczyła się jako opuszczony dzień.',
    },
    'rest-day-streak': {
      title: 'Dni odpoczynku i seria',
      blurb: 'Jak liczenie dni odpoczynku utrzymuje twoją serię.',
    },
    playbook: {
      title: 'Przegląd Playbook',
      blurb: 'Poznaj gotowe szablony programów i wybierz pasujący do celu.',
    },
    'playbook-categories': {
      title: 'Znajdź właściwy szablon',
      blurb: 'Filtruj Playbook według celu, dni w tygodniu i doświadczenia.',
    },
    'start-program': {
      title: 'Rozpocznij program',
      blurb: 'Zacznij program, zobacz aktywny tydzień i zacznij dziś według planu.',
    },
    'active-week': {
      title: 'Aktywny tydzień i dziś',
      blurb: 'Czytaj bieżący tydzień, oznaczaj dni i przechodź do dzisiejszej sesji.',
    },
    'program-week': {
      title: 'Zbuduj tydzień programu',
      blurb: 'Zbuduj tydzień: dodaj dni, ćwiczenia i ustaw docelowe serie oraz powtórzenia.',
    },
    'edit-program': {
      title: 'Edytuj i uporządkuj program',
      blurb: 'Zmień nazwę, kolejność dni, zamień ćwiczenia i zduplikuj tydzień.',
    },
    templates: {
      title: 'Zapisz sesję jako szablon',
      blurb: 'Zamień lubianą sesję w szablon wielokrotnego użytku.',
    },
    'assign-program': {
      title: 'Przypisz program',
      blurb: 'Przypisz program uczestnikowi, zachowując jeden aktywny plan na osobę.',
    },
    'import-program': {
      title: 'Import programu z CSV',
      blurb: 'Zbuduj program masowo, importując CSV z dniami, ćwiczeniami i seriami.',
    },
    'export-program': {
      title: 'Eksport i udostępnianie programu',
      blurb: 'Eksportuj program do CSV, aby zrobić kopię lub przekazać innemu trenerowi.',
    },
    'first-chart': {
      title: 'Czytaj pierwszy wykres',
      blurb: 'Zrozum wykres objętości na Progress i co oznacza każdy słupek.',
    },
    'volume-lens': {
      title: 'Objętość, serie i tonaż',
      blurb: 'Przełączaj soczewkę postępu między seriami, powtórzeniami i tonażem.',
    },
    'progress-range': {
      title: 'Tydzień, miesiąc i cały czas',
      blurb: 'Zmieniaj zakres czasu, aby czytać krótko- i długoterminowe obciążenie.',
    },
    trends: {
      title: 'Trendy w czasie',
      blurb: 'Czytaj trendy — tygodniową objętość, częstotliwość i serię.',
    },
    records: {
      title: 'Twoje rekordy',
      blurb: 'Gdzie żyją rekordy i jak zobaczyć najlepszą serię w ćwiczeniu.',
    },
    'one-rm': {
      title: 'Szacowane 1RM',
      blurb: 'Jak Spotter szacuje twój ciężar maksymalny i dlaczego się zmienia.',
    },
    'muscle-map': {
      title: 'Historia mięśni i mapa',
      blurb: 'Zobacz objętość według grup mięśni i czytaj mapę mięśni.',
    },
    'weak-points': {
      title: 'Znajdź słabe punkty',
      blurb: 'Znajdź niedotrenowane mięśnie i zbalansuj tydzień.',
    },
    'body-metrics': {
      title: 'Pomiary ciała i ważenia',
      blurb: 'Zapisuj wagę, wzrost i skład ciała oraz czytaj trend pomiarów.',
    },
    'weigh-in-reminder': {
      title: 'Przypomnienia o ważeniu',
      blurb: 'Otrzymuj przypomnienia o ważeniu i odkładaj je na dzień.',
    },
    'exercise-library': {
      title: 'Biblioteka ćwiczeń',
      blurb: 'Przeszukuj katalog i filtruj według mięśni i sprzętu.',
    },
    'exercise-favorites': {
      title: 'Ulubione i przypięte ćwiczenia',
      blurb: 'Przypnij ćwiczenia, których używasz najczęściej, aby były na górze.',
    },
    'custom-exercise': {
      title: 'Utwórz własne ćwiczenie',
      blurb: 'Dodaj własne ćwiczenie z mięśniami i sprzętem, aby pojawiało się wszędzie.',
    },
    'exercise-detail': {
      title: 'Szczegóły ćwiczenia i historia',
      blurb: 'Otwórz ćwiczenie, aby zobaczyć historię serii, rekordy i trend.',
    },
    'exercise-catalog-admin': {
      title: 'Kuruj wspólny katalog',
      blurb: 'Dodawaj lub edytuj ćwiczenia we wspólnym katalogu używanym przez wszystkich.',
    },
    'add-gym': {
      title: 'Dodaj siłownię',
      blurb: 'Zapisz siłownię z lokalizacją, aby Spotter proponował ją automatycznie.',
    },
    'gym-suggest': {
      title: 'Automatyczne podpowiedzi siłowni',
      blurb: 'Jak Spotter wybiera siłownię, w której jesteś, i jak to nadpisać.',
    },
    equipment: {
      title: 'Inwentarz sprzętu',
      blurb: 'Zaznacz sprzęt, który ma siłownia, aby ostrzeżenia dotyczyły tylko braków.',
    },
    'band-library': {
      title: 'Biblioteka gum',
      blurb: 'Ustaw szacowany opór każdego koloru gumy raz na siłownię.',
    },
    'apex-overview': {
      title: 'Czym jest Apex?',
      blurb: 'Przegląd Apex — jak trening zmienia się w rangi, nagrody i wyzwania.',
    },
    'apex-home': {
      title: 'Ekran główny Apex',
      blurb: 'Czytaj przegląd Apex: ranga, aktywne wyzwania i ostatnie osiągnięcia.',
    },
    challenges: {
      title: 'Dołącz do wyzwania',
      blurb: 'Znajdź aktywne wyzwanie, dołącz i śledź swoją pozycję.',
    },
    ranks: {
      title: 'Rangi i standardy siły',
      blurb: 'Jak twoje ćwiczenia odpowiadają standardom siły i jak zdobywa się rangi.',
    },
    awards: {
      title: 'Nagrody i osiągnięcia',
      blurb: 'Osiągnięcia do odblokowania i gdzie żyją twoje nagrody.',
    },
    feed: {
      title: 'Powiadomienia i aktualności',
      blurb: 'Czytaj aktualności Apex i dzwonek — co i dlaczego cię powiadamia.',
    },
    'your-profile': {
      title: 'Twój profil',
      blurb: 'Edytuj imię, awatar i podstawy ciała w aplikacji People.',
    },
    avatar: {
      title: 'Ustaw zdjęcie',
      blurb: 'Prześlij i przytnij awatar, aby pokazywał się w całym suite.',
    },
    'clients-roster': {
      title: 'Lista twoich klientów',
      blurb: 'Przeglądaj uczestników, szukaj na liście i otwieraj klienta.',
    },
    'client-detail': {
      title: 'Trenuj klienta',
      blurb: 'Otwórz uczestnika, aby przejrzeć trening i przypisać program.',
    },
    'trainer-notes': {
      title: 'Notatki trenera',
      blurb: 'Zostawiaj prywatne notatki o uczestniku, widoczne tylko dla trenerów.',
    },
    'users-admin': {
      title: 'Zarządzaj użytkownikami',
      blurb: 'Przeglądaj wszystkie konta, szukaj i otwieraj użytkownika jako admin.',
    },
    roles: {
      title: 'Role i dostęp',
      blurb: 'Co mogą uczestnik, trener i admin oraz jak zmienić rolę.',
    },
    invites: {
      title: 'Zaproś ludzi',
      blurb: 'Utwórz link z zaproszeniem, aby nowa osoba mogła dołączyć.',
    },
    audit: {
      title: 'Dostęp i dziennik audytu',
      blurb: 'Czytaj dziennik tego, kto oglądał dane uczestnika.',
    },
    'offline-sync': {
      title: 'Offline i synchronizacja',
      blurb: 'Jak Spotter działa offline i synchronizuje się po powrocie sieci.',
    },
    'sync-conflict': {
      title: 'Gdy synchronizacja jest zablokowana',
      blurb: 'Co oznacza karta blokady synchronizacji i jak ponowić lub odrzucić.',
    },
    'app-update': {
      title: 'Zaktualizuj aplikację',
      blurb: 'Jak działa pasek aktualizacji i odświeżenie do najnowszej wersji.',
    },
    notifications: {
      title: 'Powiadomienia i przypomnienia',
      blurb: 'Gdzie pojawiają się powiadomienia i jak na nie reagować.',
    },
    'sign-out': {
      title: 'Wyloguj i zmień konto',
      blurb: 'Wyloguj się bezpiecznie, w tym co dzieje się z niezsynchronizowanymi danymi.',
    },
    'settings-flags': {
      title: 'Ustawienia i flagi funkcji',
      blurb: 'Włączaj lub wyłączaj wczesne funkcje w ustawieniach admina.',
    },
  },
  lt: {
    'take-the-tour': {
      title: 'Pradžia per 3 minutes',
      blurb:
        'Greita keturių kortelių apžvalga — Today, Progress, Programs, Gyms — ir programų perjungiklis.',
    },
    'the-shell': {
      title: 'Perjungimas tarp programų',
      blurb: 'Atverkite perjungiklį ir judėkite tarp Gym, Apex, People ir Learn.',
    },
    'today-screen': {
      title: 'Today ekranas',
      blurb: 'Skaitykite Today: planą, seriją, greitus veiksmus ir aktyvios treniruotės bloką.',
    },
    'first-workout': {
      title: 'Nustatykite pirmą treniruotę',
      blurb: 'Pradėkite sesiją iš šablono, pakeiskite pratimą ir nustatykite tikslines serijas.',
    },
    'log-first-set': {
      title: 'Greitas serijos žymėjimas',
      blurb:
        'Įveskite svorį ir pakartojimus, pažymėkite apšilimą ir užbaikite seriją per sekundes.',
    },
    'install-app': {
      title: 'Įdiekite Spotter telefone',
      blurb:
        'Pridėkite Spotter į pradžios ekraną — atsidaro visame ekrane ir veikia neprisijungus.',
    },
    language: {
      title: 'Kalbos keitimas',
      blurb: 'Perjunkite Spotter tarp anglų, ukrainiečių, lenkų, lietuvių ir estų kalbų.',
    },
    'sets-reps': {
      title: 'Serijos, pakartojimai ir svoris',
      blurb:
        'Serijos eilutė: svoris, pakartojimai, RPE ir kaip kita serija užsipildo iš praėjusios.',
    },
    'edit-delete-set': {
      title: 'Redaguoti ar ištrinti seriją',
      blurb: 'Pataisykite klaidingą seriją, ištrinkite ją ar pakeiskite serijų tvarką.',
    },
    warmups: {
      title: 'Apšilimo serijos',
      blurb: 'Pažymėkite apšilimą, kad jis skaičiuotųsi sesijoje, bet ne darbinėje apimtyje.',
    },
    prs: {
      title: 'Rekordai treniruotės metu',
      blurb: 'Matykite, kaip naujas rekordas aptinkamas ir pažymimas iškart įrašius.',
    },
    supersets: {
      title: 'Supersetai ir ratai',
      blurb: 'Grupuokite pratimus į supersetą ir žymėkite juos ratas po rato.',
    },
    'rest-timer': {
      title: 'Poilsio laikmatis',
      blurb: 'Automatinis poilsis tarp serijų, trukmės keitimas ir pranešimas apie pabaigą.',
    },
    'swap-exercise': {
      title: 'Pratimo keitimas sesijoje',
      blurb: 'Pakeiskite pratimą tuoj pat, išlaikydami tikslines serijas.',
    },
    'add-exercise-session': {
      title: 'Pridėti pratimą į sesiją',
      blurb: 'Pridėkite papildomą pratimą į šiandienos treniruotę iš bibliotekos.',
    },
    'load-entry': {
      title: 'Gumos, grandinės ir pagalba',
      blurb: 'Žymėkite gumas, grandines ir su pagalba atliktus pakartojimus per apkrovos padėjėją.',
    },
    'plate-math': {
      title: 'Svarsčių skaičiavimas',
      blurb: 'Leiskite Spotter apskaičiuoti svarsčius kiekvienoje pusėje tiksliniam svoriui.',
    },
    'set-notes': {
      title: 'Pastabos serijai ar sesijai',
      blurb: 'Pridėkite trumpą pastabą serijai arba visai sesijai.',
    },
    backfill: {
      title: 'Įrašyti praėjusią treniruotę',
      blurb:
        'Įrašykite anksčiau atliktą treniruotę — nustatykite datą, laiką ir pastangas po fakto.',
    },
    'finish-review': {
      title: 'Užbaigti ir peržiūrėti sesiją',
      blurb: 'Užbaikite sesiją, peržiūrėkite apimtį ir rekordus bei perskaitykite santrauką.',
    },
    'history-list': {
      title: 'Jūsų sesijų istorija',
      blurb: 'Naršykite praėjusias sesijas, atverkite jas iš naujo ir matykite, ką darėte.',
    },
    'log-activity': {
      title: 'Kardio ar atsigavimas',
      blurb: 'Paleiskite laikmatį bėgimui, ėjimui ar tempimui arba įrašykite su trukme.',
    },
    'activity-timeline': {
      title: 'Pradžios laikas ir trukmė',
      blurb: 'Nustatykite, kada vyko veikla ir kiek truko, laiko juostoje.',
    },
    'effort-gauge': {
      title: 'Pastangos skalėje',
      blurb: 'Nustatykite pastangas nuo lengvų iki sunkių ir stebėkite, kaip keičiasi įvertis.',
    },
    'activity-calories': {
      title: 'Kaip skaičiuojamos kalorijos',
      blurb: 'Matykite, kaip kalorijos keičiasi pagal veiklos tipą ir intensyvumą.',
    },
    'rest-periods': {
      title: 'Poilsis ir atostogos',
      blurb: 'Pažymėkite poilsio laikotarpį, kad pertrauka nebūtų laikoma praleista diena.',
    },
    'rest-day-streak': {
      title: 'Poilsio dienos ir serija',
      blurb: 'Kaip poilsio dienų įskaitymas išlaiko jūsų seriją.',
    },
    playbook: {
      title: 'Playbook apžvalga',
      blurb: 'Naršykite paruoštus programų šablonus ir pasirinkite tinkamą tikslui.',
    },
    'playbook-categories': {
      title: 'Raskite tinkamą šabloną',
      blurb: 'Filtruokite Playbook pagal tikslą, dienas per savaitę ir patirtį.',
    },
    'start-program': {
      title: 'Pradėti programą',
      blurb: 'Pradėkite programą, matykite aktyvią savaitę ir pradėkite šiandien pagal planą.',
    },
    'active-week': {
      title: 'Aktyvi savaitė ir šiandien',
      blurb: 'Skaitykite dabartinę savaitę, žymėkite dienas ir eikite į šiandienos sesiją.',
    },
    'program-week': {
      title: 'Sukurti programos savaitę',
      blurb:
        'Sukurkite savaitę: pridėkite dienas, pratimus ir nustatykite tikslines serijas bei pakartojimus.',
    },
    'edit-program': {
      title: 'Redaguoti ir pertvarkyti programą',
      blurb: 'Pervadinkite, keiskite dienų tvarką, keiskite pratimus ir dubliuokite savaitę.',
    },
    templates: {
      title: 'Išsaugoti sesiją kaip šabloną',
      blurb: 'Paverskite mėgstamą sesiją daugkartiniu šablonu.',
    },
    'assign-program': {
      title: 'Priskirti programą',
      blurb: 'Priskirkite programą nariui, išlaikydami vieną aktyvų planą asmeniui.',
    },
    'import-program': {
      title: 'Importuoti programą iš CSV',
      blurb: 'Sukurkite programą masiškai importuodami CSV su dienomis, pratimais ir serijomis.',
    },
    'export-program': {
      title: 'Eksportuoti ir dalintis programa',
      blurb: 'Eksportuokite programą į CSV atsarginei kopijai ar perdavimui kitam treneriui.',
    },
    'first-chart': {
      title: 'Skaitykite pirmą grafiką',
      blurb: 'Supraskite apimties grafiką Progress ir ką reiškia kiekvienas stulpelis.',
    },
    'volume-lens': {
      title: 'Apimtis, serijos ir tonažas',
      blurb: 'Perjunkite pažangos lęšį tarp serijų, pakartojimų ir tonažo.',
    },
    'progress-range': {
      title: 'Savaitė, mėnuo ir visas laikas',
      blurb: 'Keiskite laiko intervalą, kad skaitytumėte trumpalaikę ir ilgalaikę apkrovą.',
    },
    trends: {
      title: 'Tendencijos laikui bėgant',
      blurb: 'Skaitykite tendencijas — savaitės apimtį, dažnį ir seriją.',
    },
    records: {
      title: 'Jūsų rekordai',
      blurb: 'Kur gyvena rekordai ir kaip pamatyti geriausią pratimo seriją.',
    },
    'one-rm': {
      title: 'Įvertintas 1RM',
      blurb: 'Kaip Spotter įvertina jūsų vieno pakartojimo maksimumą ir kodėl jis kinta.',
    },
    'muscle-map': {
      title: 'Raumenų istorija ir žemėlapis',
      blurb: 'Matykite apimtį pagal raumenų grupes ir skaitykite raumenų žemėlapį.',
    },
    'weak-points': {
      title: 'Raskite silpnas vietas',
      blurb: 'Raskite nepakankamai treniruotus raumenis ir subalansuokite savaitę.',
    },
    'body-metrics': {
      title: 'Kūno rodikliai ir svėrimai',
      blurb: 'Žymėkite svorį, ūgį ir kūno sudėtį bei skaitykite rodiklių tendenciją.',
    },
    'weigh-in-reminder': {
      title: 'Svėrimo priminimai',
      blurb: 'Gaukite priminimus pasisverti ir atidėkite juos dienai.',
    },
    'exercise-library': {
      title: 'Pratimų biblioteka',
      blurb: 'Ieškokite kataloge ir filtruokite pagal raumenis ir įrangą.',
    },
    'exercise-favorites': {
      title: 'Mėgstami ir prisegti pratimai',
      blurb: 'Prisekite dažniausiai naudojamus pratimus, kad jie būtų viršuje.',
    },
    'custom-exercise': {
      title: 'Sukurti savo pratimą',
      blurb: 'Pridėkite savo pratimą su raumenimis ir įranga, kad jis rodytųsi visur.',
    },
    'exercise-detail': {
      title: 'Pratimo informacija ir istorija',
      blurb: 'Atverkite pratimą, kad matytumėte serijų istoriją, rekordus ir tendenciją.',
    },
    'exercise-catalog-admin': {
      title: 'Tvarkyti bendrą katalogą',
      blurb: 'Pridėkite ar redaguokite pratimus bendrame kataloge, kurį naudoja visi.',
    },
    'add-gym': {
      title: 'Pridėti salę',
      blurb: 'Išsaugokite salę su vieta, kad Spotter siūlytų ją automatiškai.',
    },
    'gym-suggest': {
      title: 'Automatiniai salės pasiūlymai',
      blurb: 'Kaip Spotter parenka salę, kurioje esate, ir kaip tai perrašyti.',
    },
    equipment: {
      title: 'Įrangos inventorius',
      blurb: 'Pažymėkite salės įrangą, kad įspėjimai rodytųsi tik dėl trūkstamos.',
    },
    'band-library': {
      title: 'Gumų biblioteka',
      blurb: 'Nustatykite kiekvienos gumos spalvos apytikslį pasipriešinimą kartą salėje.',
    },
    'apex-overview': {
      title: 'Kas yra Apex?',
      blurb: 'Apex apžvalga — kaip treniruotės virsta rangais, apdovanojimais ir iššūkiais.',
    },
    'apex-home': {
      title: 'Apex pradžia',
      blurb: 'Skaitykite Apex apžvalgą: rangą, aktyvius iššūkius ir naujausius pasiekimus.',
    },
    challenges: {
      title: 'Prisijunkite prie iššūkio',
      blurb: 'Raskite aktyvų iššūkį, prisijunkite ir stebėkite savo poziciją.',
    },
    ranks: {
      title: 'Rangai ir jėgos standartai',
      blurb: 'Kaip jūsų pratimai atitinka jėgos standartus ir kaip pelnomi rangai.',
    },
    awards: {
      title: 'Apdovanojimai ir pasiekimai',
      blurb: 'Pasiekimai, kuriuos galima atrakinti, ir kur gyvena jūsų apdovanojimai.',
    },
    feed: {
      title: 'Pranešimai ir srautas',
      blurb: 'Skaitykite Apex srautą ir skambutį — kas ir kodėl jus praneša.',
    },
    'your-profile': {
      title: 'Jūsų profilis',
      blurb: 'Redaguokite vardą, avatarą ir kūno pagrindus People programoje.',
    },
    avatar: {
      title: 'Nustatykite nuotrauką',
      blurb: 'Įkelkite ir apkarpykite avatarą, kad jis rodytųsi visame suite.',
    },
    'clients-roster': {
      title: 'Jūsų klientų sąrašas',
      blurb: 'Peržiūrėkite narius, ieškokite sąraše ir atverkite klientą.',
    },
    'client-detail': {
      title: 'Treniruokite klientą',
      blurb: 'Atverkite narį, kad peržiūrėtumėte treniruotes ir priskirtumėte programą.',
    },
    'trainer-notes': {
      title: 'Trenerio pastabos',
      blurb: 'Palikite privačias pastabas apie narį, matomas tik treneriams.',
    },
    'users-admin': {
      title: 'Tvarkyti naudotojus',
      blurb: 'Peržiūrėkite visas paskyras, ieškokite ir atverkite naudotoją kaip administratorius.',
    },
    roles: {
      title: 'Rolės ir prieiga',
      blurb: 'Ką gali narys, treneris ir administratorius ir kaip pakeisti rolę.',
    },
    invites: {
      title: 'Pakviesti žmones',
      blurb: 'Sukurkite pakvietimo nuorodą, kad naujas žmogus galėtų prisijungti.',
    },
    audit: {
      title: 'Prieiga ir audito žurnalas',
      blurb: 'Skaitykite žurnalą, kas peržiūrėjo nario duomenis.',
    },
    'offline-sync': {
      title: 'Neprisijungus ir sinchronizacija',
      blurb: 'Kaip Spotter veikia neprisijungus ir sinchronizuojasi grįžus ryšiui.',
    },
    'sync-conflict': {
      title: 'Kai sinchronizacija užblokuota',
      blurb: 'Ką reiškia sinchronizacijos blokavimo kortelė ir kaip kartoti ar atmesti.',
    },
    'app-update': {
      title: 'Atnaujinti programą',
      blurb: 'Kaip veikia atnaujinimo juosta ir atnaujinimas į naujausią versiją.',
    },
    notifications: {
      title: 'Pranešimai ir priminimai',
      blurb: 'Kur rodomi pranešimai ir kaip į juos reaguoti.',
    },
    'sign-out': {
      title: 'Atsijungti ir keisti paskyrą',
      blurb: 'Atsijunkite saugiai, įskaitant kas nutinka nesinchronizuotiems duomenims.',
    },
    'settings-flags': {
      title: 'Nustatymai ir funkcijų vėliavos',
      blurb: 'Įjunkite ar išjunkite ankstyvas funkcijas administratoriaus nustatymuose.',
    },
  },
  et: {
    'take-the-tour': {
      title: 'Alusta 3 minutiga',
      blurb:
        'Kiire ülevaade neljast vahekaardist — Today, Progress, Programs, Gyms — ja rakenduste vahetaja.',
    },
    'the-shell': {
      title: 'Rakenduste vahetamine',
      blurb: 'Ava vahetaja ja liigu Gym, Apex, People ja Learn vahel.',
    },
    'today-screen': {
      title: 'Today ekraan',
      blurb: 'Loe Today: plaan, seeria, kiirtoimingud ja aktiivse treeningu plokk.',
    },
    'first-workout': {
      title: 'Seadista esimene treening',
      blurb: 'Alusta seanssi mallist, vaheta harjutus ja määra sihtseeriad.',
    },
    'log-first-set': {
      title: 'Kiire seeria logimine',
      blurb: 'Sisesta raskus ja kordused, märgi soojendus ja lõpeta seeria sekunditega.',
    },
    'install-app': {
      title: 'Paigalda Spotter telefoni',
      blurb: 'Lisa Spotter avaekraanile — avaneb täisekraanil ja töötab ühenduseta.',
    },
    language: {
      title: 'Keele muutmine',
      blurb: 'Vaheta Spotter inglise, ukraina, poola, leedu ja eesti keele vahel.',
    },
    'sets-reps': {
      title: 'Seeriad, kordused ja raskus',
      blurb:
        'Seeria rida: raskus, kordused, RPE ja kuidas järgmine seeria eeltäidetakse eelmisest.',
    },
    'edit-delete-set': {
      title: 'Muuda või kustuta seeria',
      blurb: 'Paranda valesti sisestatud seeria, kustuta see või muuda seeriate järjekorda.',
    },
    warmups: {
      title: 'Soojendusseeriad',
      blurb: 'Märgi soojendus, et see loeks seanssi, kuid mitte töömahtu.',
    },
    prs: {
      title: 'Rekordid treeningu ajal',
      blurb: 'Näe, kuidas uus rekord tuvastatakse ja tähistatakse kohe logimisel.',
    },
    supersets: {
      title: 'Supersetid ja ringid',
      blurb: 'Rühmita harjutused supersetiks ja logi neid ring ringi haaval.',
    },
    'rest-timer': {
      title: 'Puhketaimer',
      blurb: 'Automaatne puhkus seeriate vahel, kestuse muutmine ja teavitus lõppemisest.',
    },
    'swap-exercise': {
      title: 'Harjutuse vahetus seansil',
      blurb: 'Vaheta harjutus käigu pealt, säilitades sihtseeriad.',
    },
    'add-exercise-session': {
      title: 'Lisa harjutus seanssi',
      blurb: 'Lisa täiendav harjutus tänasesse treeningusse teegist.',
    },
    'load-entry': {
      title: 'Kummid, ketid ja abistus',
      blurb: 'Logi kummid, ketid ja abistatud kordused koormuse abilisega.',
    },
    'plate-math': {
      title: 'Kettade arvutus',
      blurb: 'Lase Spotteril arvutada kettad ühele poolele sihtraskuse jaoks.',
    },
    'set-notes': {
      title: 'Märkmed seeriale või seansile',
      blurb: 'Lisa kiire märge seeriale või kogu seansile.',
    },
    backfill: {
      title: 'Logi möödunud treening',
      blurb: 'Täida varem tehtud treening — määra kuupäev, kellaaeg ja pingutus tagantjärele.',
    },
    'finish-review': {
      title: 'Lõpeta ja vaata seanss üle',
      blurb: 'Lõpeta seanss, vaata maht ja rekordid üle ning loe kokkuvõtet.',
    },
    'history-list': {
      title: 'Sinu seansside ajalugu',
      blurb: 'Sirvi möödunud seansse, ava need uuesti ja näe, mida tegid.',
    },
    'log-activity': {
      title: 'Kardio või taastumine',
      blurb: 'Käivita taimer jooksuks, kõnniks või venituseks või täida see kestusega.',
    },
    'activity-timeline': {
      title: 'Algusaeg ja kestus',
      blurb: 'Määra ajajoonel, millal tegevus toimus ja kui kaua kestis.',
    },
    'effort-gauge': {
      title: 'Pingutus skaalal',
      blurb: 'Sea pingutus kergest raskeni ja jälgi, kuidas hinnang muutub.',
    },
    'activity-calories': {
      title: 'Kuidas kaloreid hinnatakse',
      blurb: 'Näe, kuidas kalorid skaleeruvad tegevuse tüübi ja intensiivsuse järgi.',
    },
    'rest-periods': {
      title: 'Puhkus ja puhkused',
      blurb: 'Märgi puhkeperiood, et paus ei loeks vahelejäänud päevaks.',
    },
    'rest-day-streak': {
      title: 'Puhkepäevad ja seeria',
      blurb: 'Kuidas puhkepäevade arvestamine hoiab su seeriat.',
    },
    playbook: {
      title: 'Playbook ülevaade',
      blurb: 'Uuri valmis programmimalle ja vali eesmärgile sobiv.',
    },
    'playbook-categories': {
      title: 'Leia õige mall',
      blurb: 'Filtreeri Playbooki eesmärgi, nädalapäevade ja kogemuse järgi.',
    },
    'start-program': {
      title: 'Alusta programmi',
      blurb: 'Alusta programmi, näe aktiivset nädalat ja alusta täna selle plaani järgi.',
    },
    'active-week': {
      title: 'Aktiivne nädal ja täna',
      blurb: 'Loe praegust nädalat, märgi päevi ja hüppa tänasesse seanssi.',
    },
    'program-week': {
      title: 'Ehita programmi nädal',
      blurb: 'Ehita nädal: lisa päevi, harjutusi ja määra sihtseeriad ja kordused.',
    },
    'edit-program': {
      title: 'Muuda ja korrasta programm',
      blurb: 'Nimeta ümber, muuda päevade järjekorda, vaheta harjutusi ja dubleeri nädal.',
    },
    templates: {
      title: 'Salvesta seanss mallina',
      blurb: 'Muuda meeldiv seanss korduvkasutatavaks malliks.',
    },
    'assign-program': {
      title: 'Määra programm',
      blurb: 'Määra programm liikmele, hoides ühe aktiivse plaani inimese kohta.',
    },
    'import-program': {
      title: 'Impordi programm CSV-st',
      blurb: 'Ehita programm hulgi, importides CSV päevade, harjutuste ja seeriatega.',
    },
    'export-program': {
      title: 'Ekspordi ja jaga programm',
      blurb: 'Ekspordi programm CSV-sse varukoopiaks või teisele treenerile andmiseks.',
    },
    'first-chart': {
      title: 'Loe oma esimest graafikut',
      blurb: 'Mõista mahugraafikut Progressis ja mida iga tulp tähendab.',
    },
    'volume-lens': {
      title: 'Maht, seeriad ja tonnaaž',
      blurb: 'Vaheta edenemise lääts seeriate, korduste ja tonnaaži vahel.',
    },
    'progress-range': {
      title: 'Nädal, kuu ja kogu aeg',
      blurb: 'Muuda ajavahemikku, et lugeda lühi- ja pikaajalist koormust.',
    },
    trends: { title: 'Trendid ajas', blurb: 'Loe trende — nädalamaht, sagedus ja seeria.' },
    records: {
      title: 'Sinu rekordid',
      blurb: 'Kus rekordid elavad ja kuidas näha harjutuse parimat seeriat.',
    },
    'one-rm': {
      title: 'Hinnanguline 1RM',
      blurb: 'Kuidas Spotter hindab su ühe korduse maksimumi ja miks see muutub.',
    },
    'muscle-map': {
      title: 'Lihaste ajalugu ja kaart',
      blurb: 'Näe mahtu lihasgruppide kaupa ja loe lihaste kaarti.',
    },
    'weak-points': {
      title: 'Leia nõrgad kohad',
      blurb: 'Leia alatreenitud lihased ja tasakaalusta nädal.',
    },
    'body-metrics': {
      title: 'Keha näitajad ja kaalumised',
      blurb: 'Logi kaal, pikkus ja koostis ning loe näitajate trendi.',
    },
    'weigh-in-reminder': {
      title: 'Kaalumise meeldetuletused',
      blurb: 'Saa meeldetuletusi end kaaluda ja lükka need päevaks edasi.',
    },
    'exercise-library': {
      title: 'Harjutuste teek',
      blurb: 'Otsi kataloogist ja filtreeri lihaste ja varustuse järgi.',
    },
    'exercise-favorites': {
      title: 'Lemmikud ja kinnitatud harjutused',
      blurb: 'Kinnita kõige sagedamini kasutatavad harjutused, et need oleksid ees.',
    },
    'custom-exercise': {
      title: 'Loo oma harjutus',
      blurb: 'Lisa oma harjutus lihaste ja varustusega, et see ilmuks kõikjal.',
    },
    'exercise-detail': {
      title: 'Harjutuse detailid ja ajalugu',
      blurb: 'Ava harjutus, et näha seeriate ajalugu, rekordeid ja trendi.',
    },
    'exercise-catalog-admin': {
      title: 'Halda ühist kataloogi',
      blurb: 'Lisa või muuda harjutusi ühises kataloogis, mida kõik kasutavad.',
    },
    'add-gym': {
      title: 'Lisa jõusaal',
      blurb: 'Salvesta jõusaal asukohaga, et Spotter pakuks seda automaatselt.',
    },
    'gym-suggest': {
      title: 'Automaatsed jõusaali soovitused',
      blurb: 'Kuidas Spotter valib jõusaali, kus oled, ja kuidas seda üle kirjutada.',
    },
    equipment: {
      title: 'Varustuse inventar',
      blurb: 'Märgi jõusaali varustus, et hoiatused näitaksid vaid puuduvat.',
    },
    'band-library': {
      title: 'Kummide teek',
      blurb: 'Määra iga kummivärvi hinnanguline takistus korra jõusaali kohta.',
    },
    'apex-overview': {
      title: 'Mis on Apex?',
      blurb: 'Apexi ülevaade — kuidas treening muutub auastmeteks, autasudeks ja väljakutseteks.',
    },
    'apex-home': {
      title: 'Apexi avaleht',
      blurb: 'Loe Apexi ülevaadet: auaste, aktiivsed väljakutsed ja hiljutised saavutused.',
    },
    challenges: {
      title: 'Liitu väljakutsega',
      blurb: 'Leia aktiivne väljakutse, liitu ja jälgi oma seisu.',
    },
    ranks: {
      title: 'Auastmed ja jõustandardid',
      blurb: 'Kuidas su tõsted vastavad jõustandarditele ja kuidas auastmeid teenitakse.',
    },
    awards: {
      title: 'Autasud ja saavutused',
      blurb: 'Saavutused, mida avada, ja kus su autasud elavad.',
    },
    feed: {
      title: 'Teavitused ja voog',
      blurb: 'Loe Apexi voogu ja kella — mis ja miks sind teavitab.',
    },
    'your-profile': {
      title: 'Sinu profiil',
      blurb: 'Muuda nime, avatari ja keha põhiandmeid People rakenduses.',
    },
    avatar: {
      title: 'Määra oma foto',
      blurb: 'Laadi üles ja kärbi avatar, et see näiks kogu suite ulatuses.',
    },
    'clients-roster': {
      title: 'Sinu klientide nimekiri',
      blurb: 'Vaata liikmeid, otsi nimekirjast ja ava klient.',
    },
    'client-detail': {
      title: 'Treeni klienti',
      blurb: 'Ava liige, et vaadata treeninguid ja määrata programm.',
    },
    'trainer-notes': {
      title: 'Treeneri märkmed',
      blurb: 'Jäta liikme kohta privaatseid märkmeid, mida näevad vaid treenerid.',
    },
    'users-admin': {
      title: 'Halda kasutajaid',
      blurb: 'Vaata kõiki kontosid, otsi ja ava kasutaja administraatorina.',
    },
    roles: {
      title: 'Rollid ja juurdepääs',
      blurb: 'Mida liige, treener ja administraator saavad ning kuidas rolli muuta.',
    },
    invites: { title: 'Kutsu inimesi', blurb: 'Loo kutselink, et uus inimene saaks liituda.' },
    audit: {
      title: 'Juurdepääs ja auditipäevik',
      blurb: 'Loe päevikut, kes liikme andmeid vaatas.',
    },
    'offline-sync': {
      title: 'Ühenduseta ja sünkroonimine',
      blurb: 'Kuidas Spotter töötab ühenduseta ja sünkroonib, kui võrk naaseb.',
    },
    'sync-conflict': {
      title: 'Kui sünkroonimine on blokeeritud',
      blurb: 'Mida sünkroonimise blokeeringu kaart tähendab ja kuidas korrata või tühistada.',
    },
    'app-update': {
      title: 'Uuenda rakendus',
      blurb: 'Kuidas uendusriba töötab ja värskendamine uusimale versioonile.',
    },
    notifications: {
      title: 'Teavitused ja meeldetuletused',
      blurb: 'Kus teavitused ilmuvad ja kuidas neile reageerida.',
    },
    'sign-out': {
      title: 'Logi välja ja vaheta konto',
      blurb: 'Logi turvaliselt välja, sh mis juhtub sünkroonimata andmetega.',
    },
    'settings-flags': {
      title: 'Seaded ja funktsioonilipud',
      blurb: 'Lülita varajasi funktsioone sisse või välja administraatori seadetes.',
    },
  },
};

export type { Lang as LearnLang };

// --- Localisation helpers ---------------------------------------------------
import type { Topic, Lesson, LearnTopicId as _TopicId } from './catalog';
import { topicTitle as catalogTopicTitle } from './catalog';

/** Any of the five supported locales (English = source, no translation). */
type AnyLang = 'en' | Lang;

function isTx(lang: AnyLang): lang is Lang {
  return lang === 'uk' || lang === 'pl' || lang === 'lt' || lang === 'et';
}

/** Localised title/blurb for a topic id, falling back to the English source. */
export function localizeTopic(topic: Topic, lang: AnyLang): Topic {
  if (!isTx(lang)) return topic;
  const tx = TOPIC_TX[lang][topic.id as _TopicId];
  const lessons = topic.lessons.map((l) => localizeLesson(l, lang));
  if (!tx) return { ...topic, lessons };
  return { ...topic, title: tx.title, blurb: tx.blurb, lessons };
}

/** Localised title/blurb for a lesson, falling back to the English source. */
export function localizeLesson(lesson: Lesson, lang: AnyLang): Lesson {
  if (!isTx(lang)) return lesson;
  const tx = LESSON_TX[lang][lesson.id];
  if (!tx) return lesson;
  return { ...lesson, title: tx.title, blurb: tx.blurb };
}

/** Localised topic list. */
export function localizeTopics(topics: Topic[], lang: AnyLang): Topic[] {
  if (!isTx(lang)) return topics;
  return topics.map((t) => localizeTopic(t, lang));
}

/** Localised title for a topic id, falling back to the English catalog title. */
export function localTopicTitle(id: _TopicId, lang: AnyLang): string {
  if (isTx(lang)) {
    const tx = TOPIC_TX[lang][id];
    if (tx) return tx.title;
  }
  return catalogTopicTitle(id);
}
