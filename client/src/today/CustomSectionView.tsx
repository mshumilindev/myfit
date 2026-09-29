import { Fragment } from 'react';
import { WidgetSection } from '../components/ui/WidgetGrid';
import type { CustomSection } from './layout';
import { widgetById } from './registry';
import { renderShortcut, shortcutById, type ShortcutCtx } from './shortcuts';

/** A user section on Today (view mode). Empty sections stay hidden; adding
 *  happens only in Customize, so view mode never shows an "+ Add" tile. */
export function CustomSectionView({ section, ctx }: { section: CustomSection; ctx: ShortcutCtx }) {
  const items = section.items
    .map((it) => {
      if (it.size === 'XS') {
        const sc = shortcutById(it.widget);
        return sc ? <Fragment key={it.id}>{renderShortcut(sc, ctx)}</Fragment> : null;
      }
      const w = widgetById(it.widget);
      return w ? <Fragment key={it.id}>{w.render(it.size, ctx)}</Fragment> : null;
    })
    .filter(Boolean);
  if (items.length === 0) return null;
  return (
    <WidgetSection title={section.title} layout={section.layout}>
      {items}
    </WidgetSection>
  );
}
