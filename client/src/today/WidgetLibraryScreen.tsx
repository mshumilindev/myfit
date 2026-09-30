/** Dev-only screen at #/widgets: the widget library on the real account data. */
import { BackButton } from '../components/ui/BackButton';
import { useState } from 'react';
import type { Shell } from '../App';
import { useStore } from '../store';
import { useT } from '../i18n';
import { WeightSheet } from '../components/BodyMetrics';
import { WidgetLibrary } from './WidgetLibrary';
import { useTw } from './strings';
import type { ShortcutCtx } from './shortcuts';

export function WidgetLibraryScreen({ shell, onClose }: { shell: Shell; onClose: () => void }) {
  const store = useStore();
  const { t, locale } = useT();
  const tw = useTw();
  const [weight, setWeight] = useState(false);
  const [now] = useState(() => Date.now());
  const ctx: ShortcutCtx = {
    store,
    now,
    t,
    tw,
    locale,
    shell,
    openWeight: () => setWeight(true),
    startToday: null,
    logPast: () => undefined,
  };
  return (
    <div className="screen wlib-screen">
      <div className="wlib-top">
        <BackButton label={t.backAction} onClick={onClose} />
        <span className="wlib-title">Widget library</span>
      </div>
      <WidgetLibrary ctx={ctx} />
      {weight && <WeightSheet state={{ kind: 'add' }} onClose={() => setWeight(false)} />}
    </div>
  );
}
