import { cx } from '../cx';
import './SkSep.css';

/** Hairline separator. Decorative by default; `vertical` for inline groups. */
export function SkSep({ vertical, className }: { vertical?: boolean; className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cx('sk-sep', vertical && 'sk-sep-v', className)}
    />
  );
}
