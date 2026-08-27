/**
 * Programs · Playbook · Exercises top switcher (design AC-LIBTAB, extended for
 * Playbook). Three peer tabs that swap the page content in place -- no overlay,
 * no back button. Rendered inside the `programs-top` bar by ProgramsView, the
 * framed Exercises tab, and PlaybookView, so the switcher stays put while the
 * content below it changes. Each tab owns its own URL (#/programs, #/playbook,
 * #/exercises), so a refresh lands back on the same one.
 */
import { useT } from '../i18n';

export type ProgramsPeer = 'programs' | 'playbook' | 'exercises';

export function ProgramsTabs({
  active,
  onSelect,
}: {
  active: ProgramsPeer;
  onSelect: (peer: ProgramsPeer) => void;
}) {
  const { t } = useT();
  const tabs: { id: ProgramsPeer; label: string }[] = [
    { id: 'programs', label: t.programsTabLabel },
    { id: 'playbook', label: t.playbook },
    { id: 'exercises', label: t.exercisesTabLabel },
  ];
  return (
    <div className="prog-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? 'active' : ''}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
