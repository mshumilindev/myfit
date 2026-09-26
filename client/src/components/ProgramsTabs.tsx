/**
 * Programs · Goals · Playbook · Exercises are drill-ins of the Overview hub
 * (design "Spotter — Start Sheet" › Overview): each has its own tile there and
 * its own URL (#/programs, #/goals, #/playbook, #/exercises). The old in-page
 * peer switcher became a back link to Overview, rendered inside the
 * `programs-top` bar of each page.
 */
import { OverviewBack } from './OverviewBack';

export type ProgramsPeer = 'programs' | 'goals' | 'playbook' | 'exercises';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- props kept for callers
export function ProgramsTabs(_props: {
  active: ProgramsPeer;
  /** Kept for callers; peers are now reached from the Overview hub. */
  onSelect: (peer: ProgramsPeer) => void;
}) {
  return <OverviewBack />;
}
