import { useT, type LocaleId } from './index';

/**
 * Words of the gym-search consent prompt and the "Gym search is off" states (SPO-293). English, Ukrainian and Polish;
 * Lithuanian and Estonian read the English text like the legal gate (`legalGate.ts`). uk/pl are machine translations
 * that need a native read before launch (`legal/pending.ts`). Wording follows the approved lab design and names only the
 * services the code actually calls (`data/gymProviders.ts`, `components/RouteMap.tsx`).
 */
export interface GeoConsentStrings {
  title: string;
  lead: string;
  factsLabel: string;
  sentLabel: string;
  sent: string;
  whoLabel: string;
  who: string;
  withoutLabel: string;
  without: string;
  primary: string;
  secondary: string;
  privacy: string;
  version: (v: string) => string;
  saveError: string;
  offTitle: string;
  offBody: string;
  turnOn: string;
  mapOff: string;
}

const en: GeoConsentStrings = {
  title: 'Search gyms with outside services?',
  lead: 'To find a gym near you, Spotter asks map services outside Spotter. Here is what they receive.',
  factsLabel: 'Details',
  sentLabel: 'What is sent',
  sent: 'The gym names you type; the names and coordinates of gyms, including gyms you saved (for logos and address and details lookups); the map area you view; and, if you allow location (your browser asks separately), your position, to find places and draw a route.',
  whoLabel: 'Who receives it',
  who: 'OpenStreetMap-based services (Photon, Overpass, Nominatim, OSRM) and map tiles from OpenStreetMap; gym logo lookups go to Wikidata and Wikimedia, address and details lookups for gyms (including saved ones) to Photon and Nominatim; the map library comes from unpkg. They see your IP address.',
  withoutLabel: 'Without it',
  without:
    'Gym search and maps stay off. Nothing is sent to these services. Gyms you already saved still show.',
  primary: 'Search with these services',
  secondary: 'Not now',
  privacy: 'Privacy Policy',
  version: (v) => `version ${v}`,
  saveError: 'Could not save your choice. Please try again.',
  offTitle: 'Gym search is off',
  offBody: 'Turn it on to search for gyms and see maps. Gyms you saved still show.',
  turnOn: 'Turn on',
  mapOff: 'Maps are off. Turn on gym search to see the map.',
};

const uk: GeoConsentStrings = {
  title: 'Шукати зали через зовнішні сервіси?',
  lead: 'Щоб знайти зал поруч, Spotter звертається до картографічних сервісів поза Spotter. Ось що вони отримують.',
  factsLabel: 'Подробиці',
  sentLabel: 'Що надсилається',
  sent: 'Назви залів, які ви вводите; назви й координати залів, зокрема збережених вами (для логотипів, адрес і подробиць); ділянка мапи, яку ви дивитесь; і, якщо дозволите геолокацію (браузер запитає окремо), ваше місцеперебування, щоб знайти місця й побудувати маршрут.',
  whoLabel: 'Хто отримує',
  who: 'Сервіси на основі OpenStreetMap (Photon, Overpass, Nominatim, OSRM) і плитки мапи OpenStreetMap; пошук логотипів залів іде до Wikidata та Wikimedia, пошук адрес і подробиць залів (зокрема збережених) до Photon і Nominatim; бібліотека мапи з unpkg. Вони бачать вашу IP-адресу.',
  withoutLabel: 'Без цього',
  without:
    'Пошук залів і мапи лишаються вимкненими. Цим сервісам нічого не надсилається. Зали, які ви вже зберегли, показуються й далі.',
  primary: 'Шукати через ці сервіси',
  secondary: 'Не зараз',
  privacy: 'Політика конфіденційності',
  version: (v) => `версія ${v}`,
  saveError: 'Не вдалося зберегти вибір. Спробуйте ще раз.',
  offTitle: 'Пошук залів вимкнено',
  offBody: 'Увімкніть, щоб шукати зали й бачити мапи. Збережені зали показуються й так.',
  turnOn: 'Увімкнути',
  mapOff: 'Мапи вимкнено. Увімкніть пошук залів, щоб бачити мапу.',
};

const pl: GeoConsentStrings = {
  title: 'Szukać siłowni przez zewnętrzne serwisy?',
  lead: 'Aby znaleźć siłownię w pobliżu, Spotter pyta serwisy map spoza Spottera. Oto, co otrzymują.',
  factsLabel: 'Szczegóły',
  sentLabel: 'Co jest wysyłane',
  sent: 'Nazwy siłowni, które wpisujesz; nazwy i współrzędne siłowni, także zapisanych przez Ciebie (do logotypów, adresów i szczegółów); obszar mapy, który oglądasz; oraz, jeśli pozwolisz na lokalizację (przeglądarka zapyta osobno), Twoja pozycja, aby znaleźć miejsca i wyznaczyć trasę.',
  whoLabel: 'Kto to otrzymuje',
  who: 'Serwisy oparte na OpenStreetMap (Photon, Overpass, Nominatim, OSRM) i kafelki map OpenStreetMap; wyszukiwanie logotypów siłowni trafia do Wikidata i Wikimedia, wyszukiwanie adresów i szczegółów siłowni (także zapisanych) do Photon i Nominatim; biblioteka map z unpkg. Widzą Twój adres IP.',
  withoutLabel: 'Bez tego',
  without:
    'Wyszukiwanie siłowni i mapy pozostają wyłączone. Nic nie jest wysyłane do tych serwisów. Zapisane już siłownie nadal się wyświetlają.',
  primary: 'Szukaj przez te serwisy',
  secondary: 'Nie teraz',
  privacy: 'Polityka prywatności',
  version: (v) => `wersja ${v}`,
  saveError: 'Nie udało się zapisać wyboru. Spróbuj ponownie.',
  offTitle: 'Wyszukiwanie siłowni jest wyłączone',
  offBody: 'Włącz, aby szukać siłowni i widzieć mapy. Zapisane siłownie nadal się wyświetlają.',
  turnOn: 'Włącz',
  mapOff: 'Mapy są wyłączone. Włącz wyszukiwanie siłowni, aby zobaczyć mapę.',
};

export const GEO_CONSENT_LOCALES: Partial<Record<LocaleId, GeoConsentStrings>> = { en, uk, pl };

export const geoConsentTexts = (locale: LocaleId): GeoConsentStrings =>
  GEO_CONSENT_LOCALES[locale] ?? en;

export function useGeoT(): GeoConsentStrings {
  return geoConsentTexts(useT().locale);
}
