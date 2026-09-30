/** Gym amenities: catalog, detection from venue data, and the effective list. Pure. */
import type { Gym } from '../types';

export type AmenityId =
  | 'pool'
  | 'sauna'
  | 'steam'
  | 'jacuzzi'
  | 'coldPlunge'
  | 'juiceBar'
  | 'cafe'
  | 'massage'
  | 'stretchArea';

export interface AmenityDef {
  id: AmenityId;
  /** Key into the Icon registry (ui.tsx). */
  icon: string;
}

export const AMENITY_CATALOG: readonly AmenityDef[] = [
  { id: 'pool', icon: 'person-simple-swim' },
  { id: 'sauna', icon: 'flame' },
  { id: 'steam', icon: 'wind' },
  { id: 'jacuzzi', icon: 'drop' },
  { id: 'coldPlunge', icon: 'snowflake' },
  { id: 'juiceBar', icon: 'carrot' },
  { id: 'cafe', icon: 'fork-knife' },
  { id: 'massage', icon: 'hand-heart' },
  { id: 'stretchArea', icon: 'yoga' },
];

const IDS: ReadonlySet<string> = new Set(AMENITY_CATALOG.map((a) => a.id));

/** Letter-boundary wrapper that also works for Cyrillic (no \b). */
const kw = (...words: string[]): RegExp => new RegExp(`(?<![\\p{L}])(?:${words.join('|')})`, 'iu');

const NAME_RULES: Array<[AmenityId, RegExp]> = [
  [
    'pool',
    kw(
      'pools?(?![\\p{L}])',
      'swimming',
      'aquapark',
      'aqua park',
      'бассейн',
      'басейн',
      'плавательн',
      'basen',
      'pływalni',
      'baseinas',
      'baseinai',
      'bassein',
      'ujula',
    ),
  ],
  ['sauna', kw('saunas?(?![\\p{L}])', 'сауна', 'saunos', 'spa(?![\\p{L}])', 'спа(?![\\p{L}])')],
  [
    'steam',
    kw('steam room', 'steam bath', 'hammam', 'hamam', 'парна', 'паровая', 'garų', 'aurusaun'),
  ],
  ['jacuzzi', kw('jacuzzi', 'hot tub', 'whirlpool', 'джакузі', 'джакузи', 'džakuzi', 'jakuzi')],
  ['coldPlunge', kw('cold plunge', 'ice bath', 'холодна купіль', 'купель')],
  [
    'juiceBar',
    kw('juice', 'smoothie', 'protein bar', 'shake bar', 'сокобар', 'фреш', 'смузі', 'sulu baras'),
  ],
  [
    'cafe',
    kw(
      'café',
      'cafe(?![\\p{L}])',
      'coffee',
      'кафе',
      'кав.ярня',
      'кофейня',
      'kawiarnia',
      'kavinė',
      'kohvik',
    ),
  ],
  ['massage', kw('massage', 'масаж', 'masaż', 'masaz', 'masažas', 'massaaž')],
  ['stretchArea', kw('stretch', 'розтяжк', 'растяжк', 'rozciąg', 'tempimo', 'venitus')],
];

const yes = (v: string | undefined): boolean => {
  const s = (v ?? '').trim().toLowerCase();
  return s !== '' && s !== 'no' && s !== 'false' && s !== '0';
};

const hasSport = (tags: Record<string, string>, sport: string): boolean =>
  (tags.sport ?? '')
    .toLowerCase()
    .split(/[;,]/)
    .map((x) => x.trim())
    .includes(sport);

/** Detect amenities from OSM-style tags and/or a venue name. Catalog order, deduped. */
export function detectAmenities(input: {
  tags?: Record<string, string | undefined>;
  name?: string;
}): AmenityId[] {
  const found = new Set<AmenityId>();
  const tags = (input.tags ?? {}) as Record<string, string>;
  if (yes(tags.swimming_pool) || hasSport(tags, 'swimming') || tags.leisure === 'swimming_pool')
    found.add('pool');
  if (yes(tags.sauna) || tags.leisure === 'sauna') found.add('sauna');
  if (yes(tags.steam_room) || yes(tags['steam_bath'])) found.add('steam');
  if (yes(tags.jacuzzi) || yes(tags.hot_tub)) found.add('jacuzzi');
  if (yes(tags.massage) || tags.shop === 'massage' || tags.amenity === 'massage')
    found.add('massage');
  if (tags.amenity === 'cafe' || yes(tags.cafe) || tags.vending === 'drinks') found.add('cafe');
  if (input.name) for (const [id, re] of NAME_RULES) if (re.test(input.name)) found.add(id);
  return AMENITY_CATALOG.filter((a) => found.has(a.id)).map((a) => a.id);
}

/** Union of amenity lists, in catalog order (unknown ids dropped). */
export function unionAmenities(...lists: Array<readonly string[] | undefined>): AmenityId[] {
  const all = new Set(lists.flatMap((l) => l ?? []));
  return AMENITY_CATALOG.filter((a) => all.has(a.id)).map((a) => a.id);
}

export const isAmenityId = (id: string): id is AmenityId => IDS.has(id);

type GymLike = Pick<Gym, 'name'> & Partial<Pick<Gym, 'amenities' | 'amenitiesAuto'>>;

/** Confirmed list wins; else detected; else lazily detected from the name. */
export function effectiveAmenities(gym: GymLike): string[] {
  return gym.amenities ?? gym.amenitiesAuto ?? detectAmenities({ name: gym.name });
}

export function hasAmenity(gym: GymLike, id: AmenityId): boolean {
  return effectiveAmenities(gym).includes(id);
}

/** Detected list for a gym as shown in the "auto" hint / reset action. */
export function detectedAmenities(gym: GymLike): string[] {
  return gym.amenitiesAuto ?? detectAmenities({ name: gym.name });
}
