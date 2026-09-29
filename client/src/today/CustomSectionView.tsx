import { Fragment } from 'react';
import { Icon } from '../ui';
import { useT } from '../i18n';
import { WidgetSection } from '../components/ui/WidgetGrid';
import { slotCount, type CustomSection } from './layout';
import { widgetById } from './registry';
import { renderShortcut, shortcutById, type ShortcutCtx } from './shortcuts';

/** A user section on Today (view mode). Empty sections stay hidden. A shortcuts
 *  row with room left ends with a dashed "+ Add" tile that opens Customize (T1). */
export function CustomSectionView({
  section,
  ctx,
  onCustomize,
}: {
  section: CustomSection;
  ctx: ShortcutCtx;
  onCustomize?: () => void;
}) {
  const { t } = useT();
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
  const room =
    section.layout === 'shortcuts' && onCustomize && items.length < slotCount('shortcuts');
  return (
    <WidgetSection title={section.title} layout={section.layout}>
      {items}
      {room && (
        <button type="button" className="td-sc-add uisc" onClick={onCustomize}>
          <span className="td-sc-add-ic">
            <Icon name="plus" />
          </span>
          <span className="uisc-label">{t.todayAdd}</span>
        </button>
      )}
    </WidgetSection>
  );
}
