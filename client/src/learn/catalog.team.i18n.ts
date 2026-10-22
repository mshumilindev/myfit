/** Team lessons (SPO-266), kept apart so catalog.i18n.ts does not grow. Merged into the lesson lookup. */
interface Tx {
  title: string;
  blurb: string;
}

export const TEAM_LESSON_TX: Record<'uk' | 'pl' | 'lt' | 'et', Record<string, Tx>> = {
  uk: {
    'team-add-manager': {
      title: 'Додайте менеджера',
      blurb:
        'Запросіть менеджера в розділі Team: один e-mail, посилання діє 7 днів, одне використання.',
    },
    'team-manager-access': {
      title: 'Що бачить менеджер',
      blurb:
        'Менеджер бачить розклад і контакти клієнтів, але не тренування, здоров’я, харчування, нотатки чи повідомлення.',
    },
    'team-waiting': {
      title: 'Очікуємо застосунок клієнта',
      blurb: 'Чому клієнт «чекає на застосунок» і що робити: клієнт має один раз відкрити Spotter.',
    },
    'team-remove': {
      title: 'Видалити менеджера або вийти',
      blurb:
        'Припиніть доступ менеджера одразу або вийдіть із команди самі; клієнтів це не торкається.',
    },
    'team-spotter': {
      title: 'Повідомлення Spotter',
      blurb:
        'Spotter — закріплений тред лише для читання із запитами й подіями команди; кнопки діють просто на картці.',
    },
    'team-privacy': {
      title: 'Хто бачив ваші дані',
      blurb: 'Що клієнт бачить про команду: сервер бачить час найближчих занять, але не їх вміст.',
    },
  },
  pl: {
    'team-add-manager': {
      title: 'Dodaj menedżera',
      blurb: 'Zaproś menedżera w sekcji Team: jeden e-mail, link ważny 7 dni, jedno użycie.',
    },
    'team-manager-access': {
      title: 'Co widzi menedżer',
      blurb:
        'Menedżer widzi grafik i kontakty klientów, ale nie treningi, zdrowie, odżywianie, notatki ani wiadomości.',
    },
    'team-waiting': {
      title: 'Czekamy na aplikację klienta',
      blurb: 'Dlaczego klient czeka na aplikację i co zrobić: klient raz otwiera Spotter.',
    },
    'team-remove': {
      title: 'Usuń menedżera lub wyjdź',
      blurb: 'Zakończ dostęp menedżera od razu albo opuść zespół sam; klientów to nie dotyczy.',
    },
    'team-spotter': {
      title: 'Wiadomości Spotter',
      blurb:
        'Spotter to przypięty wątek tylko do odczytu z prośbami i zdarzeniami zespołu; przyciski działają na karcie.',
    },
    'team-privacy': {
      title: 'Kto widział Twoje dane',
      blurb: 'Co klient widzi o zespole: serwer widzi czas zajęć, ale nie ich treść.',
    },
  },
  lt: {
    'team-add-manager': {
      title: 'Pridėkite vadybininką',
      blurb:
        'Pakvieskite vadybininką skiltyje Team: vienas el. paštas, nuoroda galioja 7 dienas, vienkartinė.',
    },
    'team-manager-access': {
      title: 'Ką mato vadybininkas',
      blurb:
        'Vadybininkas mato tvarkaraštį ir klientų kontaktus, bet ne treniruotes, sveikatą, mitybą, užrašus ar žinutes.',
    },
    'team-waiting': {
      title: 'Laukiame kliento programėlės',
      blurb:
        'Kodėl klientas laukia programėlės ir ką daryti: klientas vieną kartą atidaro Spotter.',
    },
    'team-remove': {
      title: 'Pašalinti vadybininką arba išeiti',
      blurb:
        'Nutraukite vadybininko prieigą iškart arba patys palikite komandą; klientų tai neliečia.',
    },
    'team-spotter': {
      title: 'Spotter žinutės',
      blurb:
        'Spotter yra prisegta tik skaitoma gija su užklausomis ir komandos įvykiais; mygtukai veikia kortelėje.',
    },
    'team-privacy': {
      title: 'Kas matė jūsų duomenis',
      blurb: 'Ką klientas mato apie komandą: serveris mato užsiėmimų laiką, bet ne turinį.',
    },
  },
  et: {
    'team-add-manager': {
      title: 'Lisa haldur',
      blurb: 'Kutsu haldur jaotises Team: üks e-post, link kehtib 7 päeva, ühekordne.',
    },
    'team-manager-access': {
      title: 'Mida haldur näeb',
      blurb:
        'Haldur näeb ajakava ja klientide kontakte, aga mitte treeninguid, tervist, toitumist, märkmeid ega sõnumeid.',
    },
    'team-waiting': {
      title: 'Ootame kliendi rakendust',
      blurb: 'Miks klient ootab rakendust ja mida teha: klient avab Spotteri ühe korra.',
    },
    'team-remove': {
      title: 'Eemalda haldur või lahku',
      blurb: 'Lõpeta halduri ligipääs kohe või lahku ise meeskonnast; kliente see ei mõjuta.',
    },
    'team-spotter': {
      title: 'Spotteri sõnumid',
      blurb:
        'Spotter on kinnitatud kirjutuskaitstud lõim päringute ja meeskonnasündmustega; nupud toimivad kaardil.',
    },
    'team-privacy': {
      title: 'Kes su andmeid nägi',
      blurb: 'Mida klient meeskonna kohta näeb: server näeb treeningute aega, mitte sisu.',
    },
  },
};
