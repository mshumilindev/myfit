/**
 * Exercises tab (design LIB-1/LIB-2, AC-LIBTAB). A peer tab of Programs — it
 * shares the `programs-page` chrome and the Programs/Exercises switcher, and
 * swaps in the shared ExerciseGallery as its content. No back button: it is a
 * first-class tab, not a pushed overlay. The "New exercise" action lives in the
 * gallery's content header (mirrored by "New program" in the program editor
 * header), and the All-exercises / My-exercises split lives one level down as
 * subtabs inside the gallery.
 */
import { useT } from '../i18n';
import { getRole } from '../api';
import { ExerciseGallery } from '../components/ExerciseGallery';
import { ProgramsTabs } from '../components/ProgramsTabs';
import type { Shell } from '../App';

export function ExerciseLibraryView({
  shell,
  libTab,
  onLibTab,
  onProgramsTab,
}: {
  shell: Shell;
  libTab: 'library' | 'mine';
  onLibTab: (t: 'library' | 'mine') => void;
  onProgramsTab: (exercises: boolean) => void;
}) {
  const { t } = useT();
  const role = getRole();
  return (
    <div className="screen programs-page programs-author-page programs-has-tabs show-exercises exlib-tab">
      <div className="programs-top">
        <div>
          <div className="kicker">
            {role === 'admin' ? t.roleAdmin : role === 'trainer' ? t.roleTrainer : t.training}
          </div>
          <h2 className="title-26">{t.exercisesTabLabel}</h2>
        </div>
        <ProgramsTabs active="exercises" onSelect={onProgramsTab} />
      </div>
      <div className="exg-tabwrap">
        <ExerciseGallery shell={shell} libTab={libTab} onLibTab={onLibTab} />
      </div>
    </div>
  );
}
