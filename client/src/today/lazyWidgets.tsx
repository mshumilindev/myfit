import { useEffect, useState, type ReactNode } from 'react';
import type { WidgetMeta } from './widgetMeta';
import type { WidgetSize } from '../components/ui/Widget';

/**
 * A widget group whose render bodies live in a lazy chunk (SPO-500 I8): the registry keeps only the light metadata, the
 * chunk is fetched the first time one of its widgets is shown (the registry already hides them without the add-on).
 * While it loads (or if the fetch fails) the widget renders nothing.
 */
export function lazyWidgets<
  C,
  D extends WidgetMeta & { render: (size: WidgetSize, ctx: C) => ReactNode },
>(meta: WidgetMeta[], load: () => Promise<D[]>): D[] {
  let loaded: Promise<Map<string, D>> | null = null;
  let done: Map<string, D> | null = null;
  const get = () =>
    (loaded ??= load().then((defs) => {
      done = new Map(defs.map((d) => [d.id, d]));
      return done;
    }));
  function Body({ id, size, ctx }: { id: string; size: WidgetSize; ctx: C }) {
    const [defs, setDefs] = useState<Map<string, D> | null>(done);
    useEffect(() => {
      if (defs) return;
      let live = true;
      get()
        .then((m) => live && setDefs(m))
        .catch(() => undefined);
      return () => {
        live = false;
      };
    }, [defs]);
    return <>{defs?.get(id)?.render(size, ctx) ?? null}</>;
  }
  return meta.map(
    (m) =>
      ({
        ...m,
        render: (size: WidgetSize, ctx: C) => <Body id={m.id} size={size} ctx={ctx} />,
      }) as D,
  );
}
