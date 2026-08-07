/**
 * Exercise library (design LIB-1 phone, LIB-2 web). A thin overlay wrapper —
 * back + title + the shared ExerciseGallery, which is the single library
 * implementation reused by the Programs "Exercises" tab (AC-LIBTAB-03).
 */
import { useT } from '../i18n';
import { Icon } from '../ui';
import { ExerciseGallery } from '../components/ExerciseGallery';
import type { Shell } from '../App';

export function ExerciseLibraryView({ shell, onClose }: { shell: Shell; onClose: () => void }) {
  const { t } = useT();
  return (
    <div className="screen exlib">
      <div className="exlib-top">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div style={{ flex: 1 }}>
          <h2 className="title-26">{t.exercisesTitle}</h2>
        </div>
      </div>
      <ExerciseGallery shell={shell} />
    </div>
  );
}
