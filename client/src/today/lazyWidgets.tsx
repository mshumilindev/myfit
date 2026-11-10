import { useEffect, useState } from 'react';
import type { WidgetCtx, WidgetDef } from './registry';
import type { WidgetSize } from '../components/ui/Widget';

type Meta = Pick<WidgetDef, 'id' | 'group' | 'icon' | 'tone' | 'name'>;

/**
 * A widget group whose render bodies live in a lazy chunk (SPO-500 I8): the registry keeps only the light metadata, the
 * chunk is fetched the first time one of its widgets is shown (the registry already hides them without the add-on).
 * While it loads (or if the fetch fails) the widget renders nothing.
 */
export function lazyWidgets(meta: Meta[], load: () => Promise<WidgetDef[]>): WidgetDef[] {
  let loaded: Promise<Map<string, WidgetDef>> | null = null;
  let done: Map<string, WidgetDef> | null = null;
  const get = () =>
    (loaded ??= load().then((defs) => {
      done = new Map(defs.map((d) => [d.id, d]));
      return done;
    }));
  function Body({ id, size, ctx }: { id: string; size: WidgetSize; ctx: WidgetCtx }) {
    const [defs, setDefs] = useState<Map<string, WidgetDef> | null>(done);
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
  return meta.map((m) => ({
    ...m,
    render: (size, ctx) => <Body id={m.id} size={size} ctx={ctx} />,
  }));
}
