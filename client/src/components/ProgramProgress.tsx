import type { ReactNode } from 'react';
import { useTheme } from '../themes/registry';
import { WaterProgress } from './ui/WaterProgress';

/**
 * The week's progress on the program card: a percentage with a thin bar everywhere, a rounded tank of water in
 * Studio (the level is the real percentage).
 */
export function ProgramProgress({
  pct,
  label,
  children,
}: {
  pct: number;
  label: string;
  children: ReactNode;
}) {
  const studio = useTheme() === 'studio';
  if (studio) {
    return (
      <div className="pch-progress pch-progress--water">
        <WaterProgress value={pct} size={54} label={label}>
          <span className="pch-pct num">{pct}%</span>
        </WaterProgress>
      </div>
    );
  }
  return <div className="pch-progress">{children}</div>;
}
