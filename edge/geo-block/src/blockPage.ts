/** The neutral "not available in your region" answer, in the app's five locales (SPO-220, SPO-278). No scripts, no links, no redirects. */
export const BLOCK_LOCALES = ['en', 'uk', 'pl', 'lt', 'et'] as const;
export type BlockLocale = (typeof BLOCK_LOCALES)[number];

/** `country`: a refused country (RU, BY, KP, IR). `area`: coordinates inside a refused area of Ukraine (SPO-408). */
export type BlockVariant = 'country' | 'area';

interface Copy {
  /** The white part of the heading. */
  head: string;
  /** The gold part of the heading (same split as the landing: white text, gold emphasis). */
  em: string;
  lead: string;
}

const COPY: Record<BlockVariant, Record<BlockLocale, Copy>> = {
  country: {
    en: {
      head: 'Service unavailable',
      em: 'in your region',
      lead: 'Spotter is not available in the region you are connecting from. This follows legal and compliance requirements.',
    },
    uk: {
      head: 'Сервіс недоступний',
      em: 'у вашому регіоні',
      lead: 'Spotter недоступний у регіоні, з якого ви підключаєтесь. Це пов’язано з вимогами законодавства.',
    },
    pl: {
      head: 'Usługa jest niedostępna',
      em: 'w Twoim regionie',
      lead: 'Spotter nie jest dostępny w regionie, z którego się łączysz. Wynika to z wymogów prawnych.',
    },
    lt: {
      head: 'Paslauga neprieinama',
      em: 'jūsų regione',
      lead: 'Spotter neprieinamas regione, iš kurio jungiatės. Tai susiję su teisės aktų reikalavimais.',
    },
    et: {
      head: 'Teenus pole saadaval',
      em: 'teie piirkonnas',
      lead: 'Spotter ei ole piirkonnas, kust te ühendute, saadaval. See tuleneb õiguslikest nõuetest.',
    },
  },
  area: {
    en: {
      head: 'Service unavailable',
      em: 'in your area',
      lead: 'Spotter is not available in the area you are connecting from. This follows legal and compliance requirements for parts of Ukraine that are not under government control. Access will return when the requirements change.',
    },
    uk: {
      head: 'Сервіс недоступний',
      em: 'у вашій місцевості',
      lead: 'Spotter недоступний у місцевості, з якої ви підключаєтесь. Це пов’язано з вимогами законодавства щодо територій України, непідконтрольних уряду. Доступ відновиться, коли ці вимоги зміняться.',
    },
    pl: {
      head: 'Usługa jest niedostępna',
      em: 'w Twojej okolicy',
      lead: 'Spotter nie jest dostępny w miejscu, z którego się łączysz. Wynika to z wymogów prawnych dotyczących obszarów Ukrainy niekontrolowanych przez rząd. Dostęp wróci, gdy te wymogi się zmienią.',
    },
    lt: {
      head: 'Paslauga neprieinama',
      em: 'jūsų vietovėje',
      lead: 'Spotter neprieinamas vietovėje, iš kurios jungiatės. Tai susiję su teisės aktų reikalavimais Ukrainos teritorijoms, kurių nekontroliuoja vyriausybė. Prieiga bus atkurta, kai šie reikalavimai pasikeis.',
    },
    et: {
      head: 'Teenus pole saadaval',
      em: 'teie asukohas',
      lead: 'Spotter ei ole kohas, kust te ühendute, saadaval. See tuleneb õiguslikest nõuetest Ukraina aladele, mida valitsus ei kontrolli. Juurdepääs taastub, kui need nõuded muutuvad.',
    },
  },
};

/** The caption under the 451 (the HTTP reason phrase), same in both variants. */
const REASON: Record<BlockLocale, string> = {
  en: 'Unavailable for legal reasons',
  uk: 'Недоступно з юридичних причин',
  pl: 'Niedostępne z przyczyn prawnych',
  lt: 'Nepasiekiama dėl teisinių priežasčių',
  et: 'Pole saadaval õiguslikel põhjustel',
};

/** First supported language of an Accept-Language header by quality; English when none matches. */
export function pickLocale(acceptLanguage: string | null | undefined): BlockLocale {
  const ranked = (acceptLanguage ?? '')
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => /^\s*q\s*=\s*([\d.]+)\s*$/i.exec(p)?.[1]).find(Boolean);
      return {
        lang: tag.trim().toLowerCase().split('-')[0] ?? '',
        q: q === undefined ? 1 : Number(q),
        index,
      };
    })
    .filter((x) => x.lang !== '' && Number.isFinite(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { lang } of ranked) {
    const hit = BLOCK_LOCALES.find((l) => l === lang);
    if (hit) return hit;
  }
  return 'en';
}

/**
 * The refusal page (SPO-278 design v3): the landing's look (dark, gold emphasis) with the error in red (`--color-danger`
 * of the app). It is a standalone answer of the edge: no script, no link, no image, no external font or request, and
 * it never touches the app bundle or the service worker. Fonts fall back to the system ones until the subset fonts are
 * inlined (follow-up of SPO-278). A single dark theme, like the landing.
 */
export function blockPageHtml(locale: BlockLocale, variant: BlockVariant = 'country'): string {
  const { head, em, lead } = COPY[variant][locale];
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="dark">
<title>${head} ${em}</title>
<style>
:root{color-scheme:dark;--bg:#09080a;--fg:#f2f2f4;--muted:#b9b9c2;--gold:#e0b068;--danger:#e2564f;--card:#16171b}
html,body{margin:0;min-height:100%}
body{background:radial-gradient(120% 80% at 20% 0%,#2a1f14 0%,var(--bg) 60%);color:var(--fg);font:16px/1.55 "Manrope",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{box-sizing:border-box;max-width:72rem;min-height:100vh;margin:0 auto;padding:1.25rem 1.25rem 3rem;display:flex;flex-direction:column}
.brand{font:italic 600 1.5rem/1 Georgia,serif;color:var(--fg);letter-spacing:.01em}
main{flex:1;display:flex;flex-direction:column;justify-content:center;gap:2rem}
.code{order:-1;text-align:center;padding:2rem 1rem;border:1px solid rgba(226,86,79,.45);border-radius:1.5rem;background:var(--card);box-shadow:0 0 60px rgba(226,86,79,.12)}
.code svg{display:block;margin:0 auto .6rem}
.code p{margin:0}
.num{font:700 5.5rem/1 ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;color:var(--danger);letter-spacing:.02em}
.reason{margin-top:.75rem!important;font-size:1.05rem;color:var(--fg);opacity:.85}
.copy{text-align:center}
h1{margin:0 0 1rem;font:700 2.1rem/1.08 "Inter Tight",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:-.02em}
h1 em{display:block;font-style:normal;color:var(--gold)}
.lead{margin:0 auto;max-width:32rem;color:var(--muted)}
@media (min-width:760px){
main{flex-direction:row;align-items:center;gap:3rem}
.copy{flex:1;text-align:left}.lead{margin:0}
.code{order:0;flex:1}
h1{font-size:4.2rem}
}
</style>
</head>
<body>
<div class="wrap">
<div class="brand" aria-hidden="true">spotter</div>
<main>
<section class="copy">
<h1>${head} <em>${em}</em></h1>
<p class="lead">${lead}</p>
</section>
<section class="code">
<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#e2564f" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M5.3 5.3l13.4 13.4"/></svg>
<p class="num">451</p>
<p class="reason">${REASON[locale]}</p>
</section>
</main>
</div>
</body>
</html>
`;
}

export const BLOCK_JSON = JSON.stringify({ error: 'region-blocked' });
