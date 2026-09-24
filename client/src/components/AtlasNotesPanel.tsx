/**
 * Progress → Atlas: his latest notes (newest first) above the trend cards —
 * the same trends, now with a coach's comment on top.
 */
import { useT } from '../i18n';
import { useAtlasNotes } from '../atlas/notes';
import { TEMPER_COLOR } from '../atlas/types';
import { AtlasFace } from './AtlasFace';

const SHOWN = 6;

export function AtlasNotesPanel() {
  const { t } = useT();
  const { notes, temper } = useAtlasNotes();
  const latest = [...notes].reverse().slice(0, SHOWN);
  return (
    <section className="atl-panel" style={{ ['--atl' as string]: TEMPER_COLOR[temper] }}>
      {latest.length === 0 ? (
        <div className="atl-say">
          <AtlasFace temper={temper} size={28} />
          <div className="atl-bubble">{t.atlasEmpty}</div>
        </div>
      ) : (
        latest.map((n) => (
          <div key={n.id} className="atl-say">
            <AtlasFace temper={temper} size={28} />
            <div className="atl-bubble">{n.text}</div>
          </div>
        ))
      )}
      <span className="atl-panel-label">{t.atlasNumbers}</span>
    </section>
  );
}
