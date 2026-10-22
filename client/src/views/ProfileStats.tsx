import type { ReactNode } from 'react';
import { Icon } from '../ui';

export function StatGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <div className="profile-stat-section">
      <div className="profile-stat-heading">
        <Icon name={icon} />
        <span>{title}</span>
      </div>
      <div className="stat-grid profile-stat-grid">{children}</div>
    </div>
  );
}

export function Stat({
  value,
  label,
  icon,
  accent = false,
}: {
  value: string;
  label: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div className={`cell profile-stat-cell${accent ? ' accent' : ''}`}>
      <Icon name={icon} />
      <div>
        <div className="v">{value}</div>
        <div className="l">{label}</div>
      </div>
    </div>
  );
}
