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
import { ExerciseGallery } from '../components/ExerciseGallery';
import { OverviewHead } from '../components/ui/OverviewHead';
import type { Shell } from '../App';

export function ExerciseLibraryView({
  shell,
  libTab,
  onLibTab,
}: {
  shell: Shell;
  libTab: 'library' | 'mine';
  onLibTab: (t: 'library' | 'mine') => void;
}) {
  const { t } = useT();
  return (
    <div className="screen programs-page programs-author-page programs-has-tabs show-exercises exlib-tab">
      <OverviewHead title={t.exercisesTabLabel} />
      <div className="exg-tabwrap">
        <ExerciseGallery shell={shell} libTab={libTab} onLibTab={onLibTab} />
      </div>
    </div>
  );
}
