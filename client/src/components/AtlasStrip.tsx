/**
 * Atlas in the Today stories strip. With clients he is the first bubble,
 * split off by a hairline; alone he stretches into one full-width row of the
 * same height — face, temper, and the latest note in one line. The ring glows
 * in his temper colour while a note is unread.
 */
import { useT } from '../i18n';
import { useStore } from '../store';
import { useAtlasNotes } from '../atlas/notes';
import { TEMPER_COLOR } from '../atlas/types';
import { AtlasFace } from './AtlasFace';
import { Icon } from '../ui';

export function AtlasStoryItem({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  const { temper, unread } = useAtlasNotes();
  return (
    <>
      <button
        className={`tcs-item atl-story${unread ? ' unread' : ''}`}
        style={{ ['--atl' as string]: TEMPER_COLOR[temper] }}
        onClick={onOpen}
        aria-label={unread ? t.atlasStoryUnread(unread) : t.atlasName}
      >
        <span className="tcs-ring">
          <AtlasFace temper={temper} size={54} ring={false} />
        </span>
        <span className="tcs-name">{t.atlasName}</span>
      </button>
      <span className="atl-story-split" aria-hidden />
    </>
  );
}

/** The strip when Atlas is the only one in it (or the invite when he is off). */
export function AtlasSoloStrip({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  const { coach } = useStore();
  const { notes, temper, unread } = useAtlasNotes();
  const last = notes[notes.length - 1];
  const on = coach.enabled;
  return (
    <div className="tcs atl-solo-band">
      <div className="tcs-row">
        <button
          className={`atl-solo${on && unread ? ' unread' : ''}`}
          style={{ ['--atl' as string]: TEMPER_COLOR[on ? temper : 3] }}
          onClick={onOpen}
          aria-label={on ? (unread ? t.atlasStoryUnread(unread) : t.atlasName) : t.atlasInvite}
        >
          <span className="tcs-ring atl-solo-ring">
            <AtlasFace temper={on ? temper : 3} size={54} ring={false} />
          </span>
          <span className="atl-solo-text">
            <span className="atl-solo-name">
              {t.atlasName}
              {on && <span className="atl-temper-inline"> · {t.atlasTemper[temper - 1]}</span>}
            </span>
            <span className="atl-solo-line">
              {on ? (last?.text ?? t.atlasEmpty) : t.atlasInviteLine}
            </span>
          </span>
          {on && unread > 0 ? (
            <span className="atl-solo-count">{unread > 9 ? '9+' : unread}</span>
          ) : (
            <Icon name="caret-right" className="atl-solo-go" />
          )}
        </button>
      </div>
    </div>
  );
}
