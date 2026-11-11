import { useEffect, useState } from 'react';
import { Banner } from '../components/ui/Banner';
import { useT } from '../i18n';
import { pushState } from '../push';
import { STRINGS } from './strings';

type Kind = 'perm' | 'offline';

/** The one thing that stops reminders right now (design SPO-555 notices): notifications blocked or offline. */
function current(): Kind | null {
  const ps = pushState();
  if (ps === 'denied') return 'perm';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  return null;
}

export function PlannerNotice() {
  const { locale } = useT();
  const s = STRINGS[locale];
  const [kind, setKind] = useState<Kind | null>(current);
  useEffect(() => {
    const re = () => setKind(current());
    window.addEventListener('online', re);
    window.addEventListener('offline', re);
    window.addEventListener('focus', re);
    document.addEventListener('visibilitychange', re);
    return () => {
      window.removeEventListener('online', re);
      window.removeEventListener('offline', re);
      window.removeEventListener('focus', re);
      document.removeEventListener('visibilitychange', re);
    };
  }, []);
  if (!kind) return null;
  const m = {
    perm: { tone: 'danger', icon: 'warning-circle', title: s.notePermT, body: s.notePermB },
    offline: { tone: 'rest', icon: 'cloud-slash', title: s.noteOffT, body: s.noteOffB },
  } as const;
  const n = m[kind];
  return <Banner tone={n.tone} icon={n.icon} title={n.title} body={n.body} />;
}
