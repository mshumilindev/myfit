/**
 * App settings — admin only, web only. Toggles for feature flags; everything
 * defaults off. Reached from the desktop rail's Settings item.
 */
import { FEATURE_FLAGS, isFlagOn, setFlag, useFlagsVersion, type FlagId } from '../data/flags';
import { useT } from '../i18n';
import { Icon } from '../ui';

export function SettingsView({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  useFlagsVersion(); // re-render when a flag changes

  const meta: Record<string, { label: string; desc: string }> = {
    exerciseFeature: { label: t.flagExerciseFeature, desc: t.flagExerciseFeatureDesc },
    gymPresence: { label: t.flagGymPresence, desc: t.flagGymPresenceDesc },
  };

  return (
    <div className="screen settings-view" style={{ gap: 'var(--space-6)' }}>
      <div className="hist-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="title-26">{t.settingsTitle}</h2>
          <div className="settings-sub">{t.settingsSub}</div>
        </div>
      </div>

      <div className="settings-group">
        <h6 className="settings-group-label">{t.settingsFeaturesLabel}</h6>
        {FEATURE_FLAGS.map((f) => {
          const on = isFlagOn(f.id as FlagId);
          const m = meta[f.id] ?? { label: f.id, desc: '' };
          return (
            <div className="settings-row" key={f.id}>
              <div className="settings-row-text">
                <div className="settings-row-name">{m.label}</div>
                <div className="settings-row-desc">{m.desc}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={m.label}
                className={`ff-toggle${on ? ' on' : ''}`}
                onClick={() => setFlag(f.id as FlagId, !on)}
              >
                <span className="ff-knob" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
