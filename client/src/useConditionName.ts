import { useCallback, useEffect, useState } from 'react';
import { useT } from './i18n';
import { conditionName, searchConditions, type CatalogCondition } from './data/conditionCatalog';
import { conditionNamesLoaded, loadConditionNames } from './data/conditionNames';

/** Loads the active locale's condition names and re-renders once they arrive. */
function useLoadedLocale() {
  const { locale } = useT();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (conditionNamesLoaded(locale)) return;
    let live = true;
    void loadConditionNames(locale).then(() => live && setTick((n) => n + 1));
    return () => {
      live = false;
    };
  }, [locale]);
  return { locale, tick };
}

/** Localised catalogue name for a condition (or key); English fallback. */
export function useConditionName(): (c: CatalogCondition | string) => string {
  const { locale, tick } = useLoadedLocale();
  // `tick` re-creates the function when the locale's table arrives, so memoised rows refresh.
  return useCallback(
    (c: CatalogCondition | string) => conditionName(typeof c === 'string' ? c : c.key, locale),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, tick],
  );
}

/** Catalogue search that matches the localised name and synonyms as well as English. */
export function useConditionSearch(): (q: string) => CatalogCondition[] {
  const { locale, tick } = useLoadedLocale();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((q: string) => searchConditions(q, locale), [locale, tick]);
}
