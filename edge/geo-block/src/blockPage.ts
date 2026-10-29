/** The neutral "not available in your region" answer, in the app's five locales (SPO-220). No scripts, no links, no redirects. */
export const BLOCK_LOCALES = ['en', 'uk', 'pl', 'lt', 'et'] as const;
export type BlockLocale = (typeof BLOCK_LOCALES)[number];

interface Copy {
  title: string;
  lead: string;
}

const COPY: Record<BlockLocale, Copy> = {
  en: {
    title: 'Service unavailable in your region',
    lead: 'Spotter is not available in the region you are connecting from. This follows legal and compliance requirements.',
  },
  uk: {
    title: 'Сервіс недоступний у вашому регіоні',
    lead: 'Spotter недоступний у регіоні, з якого ви підключаєтесь. Це пов’язано з вимогами законодавства.',
  },
  pl: {
    title: 'Usługa jest niedostępna w Twoim regionie',
    lead: 'Spotter nie jest dostępny w regionie, z którego się łączysz. Wynika to z wymogów prawnych.',
  },
  lt: {
    title: 'Paslauga jūsų regione neprieinama',
    lead: 'Spotter neprieinamas regione, iš kurio jungiatės. Tai susiję su teisės aktų reikalavimais.',
  },
  et: {
    title: 'Teenus pole teie piirkonnas saadaval',
    lead: 'Spotter ei ole piirkonnas, kust te ühendute, saadaval. See tuleneb õiguslikest nõuetest.',
  },
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

export function blockPageHtml(locale: BlockLocale): string {
  const { title, lead } = COPY[locale];
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1c1c1e;--muted:#4a4a50}
@media (prefers-color-scheme:dark){:root{--bg:#121214;--fg:#f2f2f4;--muted:#b4b4bc}}
html,body{height:100%;margin:0}
body{display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:30rem;padding:2rem 1.25rem}
h1{font-size:1.5rem;line-height:1.25;margin:0 0 .75rem}
p{margin:0;color:var(--muted)}
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p>${lead}</p>
</main>
</body>
</html>
`;
}

export const BLOCK_JSON = JSON.stringify({ error: 'region-blocked' });
