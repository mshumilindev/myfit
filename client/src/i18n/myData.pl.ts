import type { MyDataStrings } from './myData';

export const myDataPl: MyDataStrings = {
  title: 'Co Spotter wie o Tobie',
  sub: 'Wszystko, co jest przechowywane dla Twojego konta, prostymi słowami',
  hubSub: 'Co jest przechowywane, gdzie i kto to widzi',
  notice:
    'Prosta lista tego, co Spotter przechowuje dla Twojego konta. Otwórz dowolną część, aby zobaczyć, gdzie jest przechowywana, kto ją widzi i jak długo.',
  groupData: 'Twoje dane',
  groupTake: 'Zabierz ze sobą',
  takeLabel: 'Pobierz kopię wszystkiego',
  takeFoot: 'Plik ZIP tworzony na tym urządzeniu z tego, co Spotter może dla Ciebie odczytać.',
  groupDelete: 'Usuwanie',
  areas: {
    account: {
      title: 'Konto i logowanie',
      sub: 'Nazwa użytkownika, imię, zdjęcie, klucze dostępu, urządzenia, z których się logowano',
    },
    training: { title: 'Trening', sub: 'Sesje, serie, ciężary, programy, notatki' },
    sleepbody: { title: 'Ciało, sen i odżywianie', sub: 'Waga, pomiary, noce, posiłki' },
    health: { title: 'Zdrowie', sub: 'Schorzenia, kontuzje, nikotyna, alkohol, suplementy, cykl' },
    atlas: { title: 'Czat z Atlasem', sub: 'Wiadomości na tym urządzeniu i to, co wysyła czat AI' },
    gyms: {
      title: 'Siłownie i lokalizacja',
      sub: 'Twoje siłownie i wizyty, wyszukiwania wysłane do usług map',
    },
    sharing: { title: 'Udostępnianie trenerowi', sub: 'Co może widzieć Twój trener' },
    chat: { title: 'Wiadomości z trenerem', sub: 'Twoja rozmowa z trenerem' },
    device: {
      title: 'Przechowywane na tym urządzeniu',
      sub: 'Ustawienia, kopia offline, klucze i pamięci podręczne',
    },
    notifications: {
      title: 'Powiadomienia i przypomnienia',
      sub: 'Urządzenia, które dostają przypomnienia',
    },
    consents: { title: 'Historia zgód', sub: 'Na co się zgodziłeś i kiedy' },
  },
  pages: {
    account: {
      who: 'Ty. Trener widzi Twoje imię i zdjęcie.',
      where:
        'Na Twoim koncie u naszego dostawcy chmury (Google Firebase). Hasło jest przechowywane tylko jako skrót.',
      keep: 'Dopóki istnieje konto.',
    },
    training: {
      who: 'Ty. Trener widzi dane treningowe w zakresie, który udostępnisz w „Prywatność i udostępnianie”.',
      where:
        'Na Twoim koncie, w postaci zaszyfrowanej. Klucz używany przez Twoje urządzenie przechowują nasze serwery, więc to ochrona w przechowywaniu, a nie szyfrowanie end-to-end. Kopia do pracy offline jest też na tym urządzeniu.',
      keep: 'Dopóki tego nie usuniesz albo nie usuniesz konta.',
    },
    sleepbody: {
      who: 'Ty. Trener widzi tylko to, co udostępnisz w „Prywatność i udostępnianie”.',
      where:
        'Na Twoim koncie, w postaci zaszyfrowanej. Klucz używany przez Twoje urządzenie przechowują nasze serwery, więc to ochrona w przechowywaniu, a nie szyfrowanie end-to-end.',
      keep: 'Dopóki tego nie usuniesz albo nie usuniesz konta.',
    },
    health: {
      who: 'Ty. Trener widzi tylko to, co udostępnisz w „Prywatność i udostępnianie”.',
      where:
        'Na Twoim koncie, w postaci zaszyfrowanej. Klucz używany przez Twoje urządzenie przechowują nasze serwery, więc to ochrona w przechowywaniu, a nie szyfrowanie end-to-end.',
      keep: 'Dopóki tego tu nie usuniesz albo nie usuniesz konta.',
      note: 'Dane o zdrowiu są przetwarzane tylko za Twoją zgodą, udzielaną osobno dla każdej funkcji.',
    },
    atlas: {
      who: 'Ty, na tym urządzeniu.',
      where:
        'Wiadomości zostają na tym urządzeniu. Gdy czat AI jest włączony, Twoje pytanie i podsumowanie treningów trafiają do Google (Gemini) oraz, tylko jeśli na to pozwolisz, do Puter. To, co zachowują, wynika z ich własnych warunków.',
      keep: 'Wiadomości, dopóki ich nie wyczyścisz albo nie usuniesz danych tego urządzenia.',
    },
    gyms: {
      who: 'Ty.',
      where:
        'Siłownie i wizyty: na Twoim koncie. Jeśli zgodziłeś się na wyszukiwanie siłowni, Twoje wyszukiwania i zapytania o trasę trafiają do usług map, a Spotter ich nie przechowuje.',
      keep: 'Dopóki ich nie usuniesz albo nie usuniesz konta.',
    },
    sharing: {
      who: 'Ty decydujesz dla każdego obszaru w „Prywatność i udostępnianie”.',
      where: 'Twoje wybory są zapisane na Twoim koncie.',
      keep: 'Dopóki ich nie zmienisz albo nie usuniesz konta.',
    },
    chat: {
      who: 'Ty i Twój trener.',
      where:
        'Na Twoim koncie. Wiadomości są zapieczętowane kluczem wspólnym dla Ciebie i trenera; klucz wydaje nasz serwer, więc to ochrona w przechowywaniu, a nie szyfrowanie end-to-end.',
      keep: 'Dopóki razem pracujecie.',
      note: 'Wiadomości są zapieczętowane, więc ta strona nie może ich policzyć.',
    },
    notifications: {
      who: 'Ty.',
      where:
        'Token każdego urządzenia, które dostaje przypomnienia, jest przechowywany na Twoim koncie. Przypomnienia dostarcza usługa push Twojego urządzenia.',
      keep: 'Dopóki nie wyłączysz przypomnień albo nie usuniesz konta.',
    },
  },
  lines: {
    accProfile: { label: 'Konto', sub: 'Nazwa użytkownika, wyświetlana nazwa, zdjęcie, język' },
    accSignin: { label: 'Logowanie', sub: 'Skrót hasła, klucze dostępu, urządzenia i sesje' },
    accLogs: { label: 'Dzienniki techniczne', sub: 'Próby logowania i przypomnienia' },
    trSessions: { label: 'Sesje', sub: 'Treningi, które zapisałeś' },
    trSets: { label: 'Serie', sub: 'Ćwiczenia, ciężary, powtórzenia i czasy w tych sesjach' },
    trActivities: { label: 'Cardio i regeneracja', sub: 'Aktywności, które zapisałeś' },
    trRest: { label: 'Okresy odpoczynku', sub: 'Zaplanowany odpoczynek, regeneracja i urlop' },
    trPrograms: { label: 'Programy i notatki', sub: 'Twoje i te przypisane przez trenera' },
    sbWeighIns: { label: 'Ważenia', sub: 'Wpisy wagi; pomiary są przechowywane razem z nimi' },
    sbNights: { label: 'Noce', sub: 'Sen, który zapisałeś' },
    sbNutrition: { label: 'Odżywianie', sub: 'Posiłki i jedzenie, które zapisujesz' },
    hInjuries: { label: 'Kontuzje', sub: 'Daty, część ciała, etapy rehabilitacji' },
    hConditions: { label: 'Przewlekłe schorzenia', sub: 'Nazwy i notatki, które dodałeś' },
    hCycle: { label: 'Cykl', sub: 'Ustawienia i wpisy' },
    hNicotine: { label: 'Nikotyna', sub: 'Produkty i wpisy' },
    hAlcohol: { label: 'Alkohol', sub: 'Napoje i wpisy' },
    hSupplements: { label: 'Suplementy', sub: 'Co przyjmujesz i odhaczenia' },
    atChat: { label: 'Historia czatu', sub: 'Ostatnie 100 wiadomości, tylko na tym urządzeniu' },
    atAi: {
      label: 'Czat AI',
      sub: 'Twoje pytanie i podsumowanie treningów trafiają do Google za każdym razem, gdy pytasz',
    },
    gyGyms: { label: 'Twoje siłownie', sub: 'Nazwy i miejsca, które dodałeś' },
    gyVisits: { label: 'Wizyty', sub: 'Kiedy byłeś na siłowni' },
    gySearch: { label: 'Wyszukiwanie siłowni', sub: 'Wysyłane do usług map tylko za Twoją zgodą' },
    shTrainer: { label: 'Twój trener', sub: 'Czy do konta jest przypisany trener' },
    shSee: {
      label: 'Co może widzieć',
      sub: 'Ustawiane dla każdego obszaru w „Prywatność i udostępnianie”',
    },
    chMessages: { label: 'Wiadomości', sub: 'Co napisałeś Ty i Twój trener' },
    noDevice: {
      label: 'Przypomnienia na tym urządzeniu',
      sub: 'Czy to urządzenie dostaje włączone przez Ciebie przypomnienia',
    },
  },
  has: 'Są wpisy',
  none: 'Nic nie zapisano',
  on: 'Wł.',
  off: 'Wył.',
  given: 'Zezwolono',
  notGiven: 'Nie zezwolono',
  hStored: 'Co jest przechowywane',
  hWho: 'Kto to widzi',
  hWhere: 'Gdzie i jak długo',
  hKeep: 'Jak długo',
  hOptions: 'Co możesz zrobić',
  whereLabel: 'Gdzie',
  keepLabel: 'Jak długo',
  noActions:
    'Aby usunąć te dane, usuń wpisy tam, gdzie je utworzyłeś w aplikacji, albo usuń konto.',
  delFeature: (f) => `Usuń dane: ${f}`,
  delFailed: 'Nie udało się usunąć wszystkiego. Spróbuj ponownie.',
  clearChat: 'Wyczyść historię czatu',
  clearChatTitle: 'Wyczyścić historię czatu?',
  clearChatBody: 'Wiadomości na tym urządzeniu zostaną usunięte. Atlas nadal działa.',
  clearChatConfirm: 'Wyczyść',
  cancel: 'Anuluj',
  openSharing: 'Prywatność i udostępnianie',
  openSharingSub: 'Wybierz, co może widzieć Twój trener',
  openDevice: 'Przechowywane na tym urządzeniu',
  histSub: 'Kiedy udzieliłeś lub wycofałeś każdą zgodę',
  histHeader: 'Rejestr',
  histFoot: 'Ten rejestr jest przechowywany, abyśmy mogli pokazać, na co się zgodziłeś i kiedy.',
  histEmpty: 'Nie zapisano jeszcze żadnych zgód.',
  histGiven: (w) => `${w} · udzielona`,
  histWithdrawn: (w) => `${w} · wycofana`,
  histVersion: (v, d) => `Wersja ${v} · ${d}`,
  histTrainerTerms: 'Warunki dla trenerów',
  histTerms: 'Warunki korzystania',
  histPolicy: 'Polityka prywatności',
  histAge: 'Wiek 18 lat lub więcej',
  devSub: 'Co Spotter trzyma tutaj. To nie ciasteczka.',
  devNotice:
    'To nie dotyczy ciasteczek. Lista pokazuje, co Spotter trzyma w tej przeglądarce lub aplikacji na tym urządzeniu, aby działać offline i nie prosić o ponowne logowanie. Pokazano tylko to, co naprawdę znaleziono.',
  devHeadNeeded: 'Potrzebne do działania Spottera',
  devHeadOptional: 'Tylko jeśli korzystasz z funkcji',
  devHeadOther: 'Inne',
  devHeadClear: 'Czyszczenie',
  devLoading: 'Sprawdzamy to urządzenie…',
  devMeasure: (kb) => `około ${kb}`,
  devItems: (n) => `Elementów: ${n}`,
  devMessages: (n) => `Wiadomości: ${n}`,
  devTotal: (s) => `Ta przeglądarka podaje łącznie około ${s} dla tej witryny.`,
  devNoList:
    'Ta przeglądarka nie podaje listy swoich baz danych, więc tych elementów nie można pokazać.',
  devClear: 'Wyczyść urządzenie i wyloguj',
  devClearFoot:
    'Wylogowuje z tego urządzenia. Konto i jego dane zostają. Wszystko, co jeszcze się nie zsynchronizowało, zostanie utracone.',
  devClearTitle: 'Wyczyścić to urządzenie?',
  devClearBody:
    'Zostaniesz wylogowany, a to, co Spotter tu trzymał, zostanie usunięte: klucze, kopia offline, ustawienia i czat z Atlasem. Język i zgoda na powiadomienia zostają. Twoje konto i jego dane nie są usuwane. Wszystko, co jeszcze się nie zsynchronizowało, zostanie utracone.',
  devClearConfirm: 'Wyczyść i wyloguj',
  devClearFailed: 'Nie udało się wyczyścić urządzenia. Spróbuj ponownie.',
  device: {
    signin: {
      label: 'Logowanie i lista kont',
      sub: 'Utrzymuje zalogowanie; które konta są na tym urządzeniu',
    },
    offline: {
      label: 'Kopia offline Twoich danych',
      sub: 'Treningi i wpisy, aby aplikacja działała bez połączenia',
    },
    cache: { label: 'Pamięć podręczna odczytu', sub: 'Kopie danych odczytanych wcześniej' },
    settings: { label: 'Ustawienia', sub: 'Język, jednostki, układ, co już zamknąłeś' },
    atlas: { label: 'Czat z Atlasem', sub: 'Ostatnie 100 wiadomości, tylko na tym urządzeniu' },
    consent: { label: 'Kolejka zgód', sub: 'Zgody czekające na wysłanie, tylko rodzaje i wersje' },
    reminders: {
      label: 'Przypomnienia',
      sub: 'Pozwala temu urządzeniu dostawać włączone przez Ciebie przypomnienia',
    },
    gymsearch: {
      label: 'Wyniki wyszukiwania siłowni',
      sub: 'Miejsca i adresy znalezione wcześniej oraz Twoja ostatnia pozycja',
    },
    other: { label: 'Inne elementy tej witryny', sub: 'Od innych bibliotek lub starszych wersji' },
    idbCoachChat: {
      label: 'Magazyn rozmowy z trenerem',
      sub: 'Zapieczętowana kopia Twojej rozmowy z trenerem',
    },
    idbSigner: {
      label: 'Podpisywacz urządzenia',
      sub: 'Zapieczętowany klucz potwierdzający, że wiadomości pochodzą z tego urządzenia',
    },
    idbAvatars: { label: 'Zdjęcia profilowe', sub: 'Kopie awatarów, aby pokazywały się od razu' },
    idbVault: {
      label: 'Klucz szyfrowania',
      sub: 'Pozwala temu urządzeniu otwierać Twoje zaszyfrowane dane',
    },
    idbPrefs: {
      label: 'Kopia godzin ciszy',
      sub: 'Aby przypomnienia respektowały Twoje godziny ciszy',
    },
    idbFirestore: {
      label: 'Baza danych offline',
      sub: 'Twoje dane w pamięci podręcznej bazy, aby aplikacja działała offline',
    },
    idbOther: { label: 'Inne bazy danych', sub: 'Od innych bibliotek lub starszych wersji' },
    appFiles: {
      label: 'Pliki i obrazy aplikacji',
      sub: 'Pobrane raz, aby aplikacja otwierała się szybko i offline',
    },
  },
};
