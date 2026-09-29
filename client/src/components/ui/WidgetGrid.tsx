import type { ReactNode } from 'react';
import './WidgetGrid.css';

/**
 * Section layouts of the Today Bento. The grid is 4 columns on a phone and 8 on
 * desktop; a child's span comes from its size class, so the same section reads
 * the same on both — just wider.
 *
 *   shortcuts   XS × 4–8        pair   S + S        quad  4 × S
 *   rows        M × 1–5         wide   L            wide-pair  L · S S
 *   big         XL
 */
export type SectionLayout = 'shortcuts' | 'pair' | 'quad' | 'rows' | 'wide' | 'wide-pair' | 'big';

export const SECTION_LAYOUTS: {
  id: SectionLayout;
  sizes: string;
  slots: ('XS' | 'S' | 'M' | 'L' | 'XL')[];
}[] = [
  { id: 'shortcuts', sizes: 'XS × 4–8', slots: ['XS', 'XS', 'XS', 'XS', 'XS', 'XS', 'XS', 'XS'] },
  { id: 'pair', sizes: 'S + S', slots: ['S', 'S'] },
  { id: 'quad', sizes: '4 × S', slots: ['S', 'S', 'S', 'S'] },
  { id: 'rows', sizes: 'M × 1–5', slots: ['M', 'M', 'M'] },
  { id: 'wide', sizes: 'L', slots: ['L'] },
  { id: 'wide-pair', sizes: 'L · S S', slots: ['L', 'S', 'S'] },
  { id: 'big', sizes: 'XL', slots: ['XL'] },
];

export interface WidgetGridProps {
  layout?: SectionLayout;
  children?: ReactNode;
  className?: string;
}

/** The grid a section's widgets sit in. */
export function WidgetGrid({ layout, children, className }: WidgetGridProps) {
  const cls = ['uiwgrid', layout ? `uiwgrid--${layout}` : '', className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}

export interface WidgetSectionProps {
  /** Section title (the History-style label above a hairline). */
  title?: ReactNode;
  /** Right side of the title row (e.g. "See all ↗"). */
  aside?: ReactNode;
  layout?: SectionLayout;
  children?: ReactNode;
}

/** A Today section: label row + widget grid. */
export function WidgetSection({ title, aside, layout, children }: WidgetSectionProps) {
  return (
    <section className="uiwsec">
      {(title != null || aside != null) && (
        <div className="uiwsec-head">
          {title != null && <span className="uiwsec-title">{title}</span>}
          {aside != null && <span className="uiwsec-aside">{aside}</span>}
        </div>
      )}
      <WidgetGrid layout={layout}>{children}</WidgetGrid>
    </section>
  );
}
