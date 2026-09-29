/**
 * Widget library (internal): every registered widget in S · M · L · XL and every
 * XS shortcut — the code twin of the design page "Бібліотека віджетів". Used by
 * Storybook (Today/Widget library) and by the dev-only #/widgets screen; never
 * reachable in production.
 */
import { Fragment } from 'react';
import { WIDGET_SIZES } from '../components/ui/Widget';
import { WidgetGrid } from '../components/ui/WidgetGrid';
import { WIDGETS, WIDGET_GROUPS } from './registry';
import { SHORTCUTS, renderShortcut, type ShortcutCtx } from './shortcuts';
import { useTw } from './strings';
import './library.css';

export function WidgetLibrary({ ctx }: { ctx: ShortcutCtx }) {
  const tw = useTw();
  const groups = WIDGET_GROUPS.filter((g) => WIDGETS.some((w) => w.group === g));
  return (
    <div className="wlib">
      <div className="wlib-count">
        {WIDGETS.length} widgets × 4 sizes · {SHORTCUTS.length} shortcuts
      </div>
      {groups.map((g) => (
        <section key={g} className="wlib-group">
          <h2 className="wlib-h">{tw.groups[g]}</h2>
          {WIDGETS.filter((w) => w.group === g).map((w) => (
            <div key={w.id} className="wlib-row">
              <div className="wlib-name">
                {w.name(tw)} <small>{w.id}</small>
              </div>
              <div className="wlib-sizes">
                {WIDGET_SIZES.map((s) => (
                  <div key={s} className={`wlib-cell wlib-cell--${s.toLowerCase()}`}>
                    <span className="wlib-size">{s}</span>
                    <WidgetGrid>{w.render(s, ctx)}</WidgetGrid>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
      <section className="wlib-group">
        <h2 className="wlib-h">{tw.groups.shortcuts} · XS</h2>
        {(['train', 'health', 'activity'] as const).map((g) => (
          <Fragment key={g}>
            <div className="wlib-name">{tw.groups[g]}</div>
            <div className="wlib-shortcuts">
              {SHORTCUTS.filter((s) => s.group === g).map((s) => (
                <Fragment key={s.id}>{renderShortcut(s, ctx, false, () => undefined)}</Fragment>
              ))}
            </div>
          </Fragment>
        ))}
      </section>
    </div>
  );
}
