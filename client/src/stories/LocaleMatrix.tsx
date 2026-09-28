import type { ReactNode } from 'react';
import { LOCALE_IDS, LOCALES, type LocaleId } from '../i18n';
import type { Strings } from '../i18n/en';

/** Renders the same primitive once per locale with that locale's real strings —
 *  the long-text check (pl / lt / et run 30–60% longer than en). */
export function LocaleMatrix({
  render,
  width = 358,
}: {
  render: (t: Strings, id: LocaleId) => ReactNode;
  width?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width }}>
      {LOCALE_IDS.map((id) => (
        <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              font: '600 11px var(--font)',
              letterSpacing: '0.08em',
              color: 'var(--color-text-faint)',
            }}
          >
            {id.toUpperCase()}
          </span>
          {render(LOCALES[id], id)}
        </div>
      ))}
    </div>
  );
}

/** A labelled column of variants for a story canvas. */
export function Stack({
  children,
  gap = 16,
  width,
}: {
  children: ReactNode;
  gap?: number;
  width?: number;
}) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap, width }}>{children}</div>;
}

export function Row({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap }}>{children}</div>
  );
}
