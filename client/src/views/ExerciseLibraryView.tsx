/**
 * Exercise library (design LIB-1 phone, LIB-2 web). A thin overlay wrapper —
 * back + title + the shared ExerciseGallery. The Library/My-exercises tab is
 * URL-addressable (#/exercises and #/exercises/mine), so it comes in from the
 * route and switching it navigates (persistent, shareable).
 */
import { useT } from '../i18n';
import { Icon } from '../ui';
import { ExerciseGallery } from '../components/ExerciseGallery';
import type { Shell } from '../App';

export function ExerciseLibraryView({
  shell,
  libTab,
  onClose,
}: {
  shell: Shell;
  libTab?: 'mine';
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <div className="screen exlib">
      <div className="exlib-top">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
      </div>
      <ExerciseGallery
        shell={shell}
        libTab={libTab ?? 'library'}
        onLibTab={(next) =>
          shell.openOverlay({ screen: 'library', libTab: next === 'mine' ? 'mine' : undefined })
        }
      />
    </div>
  );
}
