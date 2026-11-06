import { Suspense, type ReactNode } from 'react';

/** The rail's Mastery entry: the rating badge as a nav item. Built only while the Mastery add-on is installed (SPO-518). */
export function masteryRailItem(label: string, onOpen: () => void, badge: ReactNode) {
  return {
    id: 'mastery',
    label,
    icon: 'medal',
    onSelect: onOpen,
    node: (
      <div className="rail-mastery">
        <Suspense fallback={null}>{badge}</Suspense>
      </div>
    ),
  };
}
