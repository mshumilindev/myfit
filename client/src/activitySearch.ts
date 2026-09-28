/**
 * Log activity search (design m05): matches the activity name in the current
 * locale, the English name, the names in the other app locales and a synonym
 * list ("bouldering" → Climbing, "jog" → Run, "ping pong" → Table tennis,
 * "bjj" → Martial arts, and common uk/pl/lt/et words), case- and
 * diacritic-insensitive. Results carry a highlight range so the UI can mark
 * the matched letters, and whether the hit came from a synonym (shown as a
 * "“Bouldering”" badge). Pure — the caller passes the locale name tables.
 */
import { ACTIVITY_TYPES } from './activities';

/** Extra words people type for each type (all lowercase). */
export const ACTIVITY_SYNONYMS: Record<string, string[]> = {
  run: [
    'jog',
    'jogging',
    'running',
    'sprint',
    'trail run',
    'treadmill',
    'пробіжка',
    'бігати',
    'джогінг',
    'bieganie',
    'jogging',
    'bėgimas',
    'jooks',
    'sörkjooks',
    'бег',
  ],
  cycle: [
    'bike',
    'biking',
    'cycling',
    'spinning',
    'spin',
    'mtb',
    'велик',
    'вело',
    'веложим',
    'rower',
    'kolarstwo',
    'dviratis',
    'rattasõit',
    'jalgratas',
    'велосипед',
  ],
  swim: [
    'swimming',
    'pool',
    'laps',
    'плавати',
    'басейн',
    'pływanie',
    'basen',
    'plaukimas',
    'baseinas',
    'ujumine',
    'bassein',
  ],
  row: [
    'rowing',
    'erg',
    'rower machine',
    'kayak',
    'canoe',
    'гребля',
    'байдарка',
    'wioślarstwo',
    'kajak',
    'irklavimas',
    'sõudmine',
    'süstasõit',
  ],
  walk: [
    'walking',
    'stroll',
    'steps',
    'dog walk',
    'прогулянка',
    'гуляти',
    'spacer',
    'chodzenie',
    'ėjimas',
    'pasivaikščiojimas',
    'kõndimine',
    'jalutuskäik',
  ],
  hiit: [
    'intervals',
    'tabata',
    'crossfit',
    'circuit',
    'інтервали',
    'кросфіт',
    'interwały',
    'intervalai',
    'intervallid',
  ],
  dance: [
    'dancing',
    'zumba',
    'salsa',
    'bachata',
    'ballet',
    'танцювати',
    'сальса',
    'бачата',
    'taniec',
    'šokiai',
    'tants',
    'tantsimine',
  ],
  cardio: ['aerobics', 'conditioning', 'аеробіка', 'aerobik', 'aerobika', 'aeroobika'],
  hike: [
    'hike',
    'hiking',
    'trekking',
    'mountain walk',
    'похід',
    'гори',
    'трекінг',
    'wędrówka',
    'trekking',
    'žygis',
    'matk',
    'matkamine',
  ],
  elliptical: [
    'cross trainer',
    'orbitrek',
    'орбітрек',
    'еліпс',
    'elipsa',
    'orbitrekas',
    'elliptiline',
  ],
  stairs: [
    'stairmaster',
    'stair climber',
    'steps machine',
    'сходи',
    'степер',
    'schody',
    'laiptai',
    'trepid',
  ],
  jumprope: ['skipping', 'jump rope', 'rope', 'скакалка', 'skakanka', 'šokdynė', 'hüppenöör'],
  pilates: ['reformer', 'barre', 'пілатес', 'pilatesas'],
  football: ['soccer', 'futsal', 'футбол', 'piłka nożna', 'futbolas', 'jalgpall'],
  basketball: ['hoops', 'баскетбол', 'koszykówka', 'krepšinis', 'korvpall'],
  volleyball: ['beach volleyball', 'волейбол', 'siatkówka', 'tinklinis', 'võrkpall'],
  tennis: ['теніс', 'tenis', 'tenisas', 'tennis'],
  padel: ['падел', 'padelis'],
  badminton: ['shuttlecock', 'бадмінтон', 'badmintonas', 'sulgpall'],
  tabletennis: [
    'ping pong',
    'ping-pong',
    'pingpong',
    'пінг-понг',
    'пінгпонг',
    'tenis stołowy',
    'stalo tenisas',
    'lauatennis',
  ],
  boxing: [
    'kickboxing',
    'kick boxing',
    'muay thai',
    'sparring',
    'бокс',
    'кікбоксинг',
    'boks',
    'kikboksing',
    'boksas',
    'poks',
    'kikpoks',
  ],
  martial: [
    'bjj',
    'jiu jitsu',
    'jiu-jitsu',
    'mma',
    'judo',
    'karate',
    'taekwondo',
    'wrestling',
    'aikido',
    'kung fu',
    'дзюдо',
    'карате',
    'боротьба',
    'єдиноборства',
    'тхеквондо',
    'sztuki walki',
    'zapasy',
    'kovos menai',
    'imtynės',
    'võitluskunstid',
    'maadlus',
  ],
  climbing: [
    'rock climbing',
    'outdoor climbing',
    'crag',
    'multi-pitch',
    'скелелазіння',
    'скелі',
    'скалолазание',
    'wspinaczka',
    'wspinaczka skałkowa',
    'laipiojimas',
    'uolų laipiojimas',
    'ronimine',
    'kaljuronimine',
  ],
  climbgym: [
    'climbing gym',
    'climbing wall',
    'indoor climbing',
    'bouldering',
    'boulder',
    'wall',
    'скеледром',
    'боулдеринг',
    'скалодром',
    'ścianka',
    'ścianka wspinaczkowa',
    'laipiojimo sienelė',
    'boulderingas',
    'ronimissein',
    'boulderdamine',
  ],
  hockey: ['ice hockey', 'field hockey', 'хокей', 'hokej', 'ledo ritulys', 'jäähoki', 'hoki'],
  ski: [
    'skiing',
    'cross-country',
    'xc ski',
    'лижі',
    'лижний',
    'narty',
    'narciarstwo',
    'slidinėjimas',
    'suusatamine',
    'suusad',
  ],
  snowboard: ['snowboarding', 'сноуборд', 'snowboarding', 'snieglentė', 'lumelaud'],
  golf: ['гольф', 'golfas'],
  sport: ['other', 'game', 'match', 'інше', 'гра', 'inny', 'kita', 'muu'],
  yoga: ['yin', 'vinyasa', 'hatha', 'stretch', 'йога', 'joga', 'jooga'],
  mobility: [
    'stretching',
    'foam roll',
    'foam rolling',
    'flexibility',
    'розтяжка',
    'розминка',
    'rozciąganie',
    'tempimas',
    'venitus',
    'liikuvus',
  ],
  massage: ['massage', 'physio', 'масаж', 'masaż', 'masažas', 'massaaž'],
  sauna: ['steam', 'banya', 'hammam', 'сауна', 'баня', 'лазня', 'sauna', 'pirtis', 'saun'],
  cold: [
    'ice bath',
    'cold shower',
    'plunge',
    'cryo',
    'моржування',
    'крижана',
    'холодний душ',
    'morsowanie',
    'lodowa kąpiel',
    'ledinė vonia',
    'jäävann',
    'talisuplus',
  ],
};

/** Fold one character: lowercase, no diacritics (ą→a, ė→e, õ→o, ł→l), dashes → space. */
function fold(c: string): string {
  if (/[\s’'`-]/.test(c)) return ' ';
  return c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/ё/g, 'е');
}

/** Case/diacritic-insensitive form used for matching. */
export function normalize(s: string): string {
  return [...s].map(fold).join('').replace(/\s+/g, ' ').trim();
}

/**
 * Where the (normalized) query occurs in `text`, as a range over the ORIGINAL
 * string (each folded char maps back to its source index), or null. Prefers a
 * match at a word start.
 */
function findMatch(
  text: string,
  q: string,
): { start: number; end: number; prefix: boolean } | null {
  const chars = [...text];
  let hay = '';
  const map: number[] = [];
  chars.forEach((c, i) => {
    for (const ch of fold(c)) {
      hay += ch;
      map.push(i);
    }
  });
  let idx = -1;
  let prefix = false;
  let from = 0;
  while ((from = hay.indexOf(q, from)) !== -1) {
    const atWord = from === 0 || hay[from - 1] === ' ';
    if (atWord) {
      idx = from;
      prefix = true;
      break;
    }
    if (idx === -1) idx = from;
    from += 1;
  }
  if (idx === -1) return null;
  // Ranges are in UTF-16 units of the original (chars here are code points; all
  // activity names are BMP, so the two agree).
  const start = map[idx];
  const end = map[idx + q.length - 1] + 1;
  return { start, end, prefix };
}

export interface SearchHit {
  key: string;
  /** Where the query matched the displayed (current-locale) name, if it did. */
  range: [number, number] | null;
  /** Set when the match came through another name / synonym. */
  via: string | null;
  /** Highlight range inside `via`. */
  viaRange: [number, number] | null;
  score: number;
}

export interface SearchOptions {
  /** Current-locale names by key. */
  names: Record<string, string>;
  /** Names from the other locales (English first) — also searchable. */
  otherNames?: Array<Record<string, string>>;
  /** Pinned keys sort first… */
  pinned?: string[];
  /** …then recently logged (key → last startedAt). */
  lastAt?: ReadonlyMap<string, number>;
  /** Limit the search to these keys (in-category search). */
  keys?: string[];
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function searchActivities(query: string, opts: SearchOptions): SearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  const pinned = new Set(opts.pinned ?? []);
  const last = opts.lastAt ?? new Map<string, number>();
  const allow = opts.keys ? new Set(opts.keys) : null;
  const hits: SearchHit[] = [];
  for (const type of ACTIVITY_TYPES) {
    if (allow && !allow.has(type.key)) continue;
    const name = opts.names[type.key] ?? type.key;
    const direct = findMatch(name, q);
    if (direct) {
      hits.push({
        key: type.key,
        range: [direct.start, direct.end],
        via: null,
        viaRange: null,
        score: direct.prefix ? 3 : 2,
      });
      continue;
    }
    const alt = [
      ...(opts.otherNames ?? []).map((n) => n[type.key]).filter((x): x is string => !!x),
      ...(ACTIVITY_SYNONYMS[type.key] ?? []),
    ];
    let best: SearchHit | null = null;
    for (const word of alt) {
      if (normalize(word) === normalize(name)) continue;
      const m = findMatch(word, q);
      if (!m) continue;
      // Synonyms only count from a word start, so "bo" doesn't pull in "elbow".
      if (!m.prefix) continue;
      // A whole-word synonym ("jog") beats a partial one ("jog…a").
      const whole = normalize(word).split(' ').includes(q) || normalize(word) === q;
      const hit: SearchHit = {
        key: type.key,
        range: null,
        via: titleCase(word),
        viaRange: [m.start, m.end],
        score: whole ? 1.5 : 1,
      };
      if (!best || hit.score > best.score) best = hit;
    }
    if (best) hits.push(best);
  }
  const rank = (h: SearchHit) => (pinned.has(h.key) ? 2 : last.has(h.key) ? 1 : 0);
  return hits.sort(
    (a, b) =>
      rank(b) - rank(a) ||
      b.score - a.score ||
      (last.get(b.key) ?? 0) - (last.get(a.key) ?? 0) ||
      (opts.names[a.key] ?? a.key).localeCompare(opts.names[b.key] ?? b.key),
  );
}
