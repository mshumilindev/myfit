/**
 * App settings — admin only, web only. Toggles for feature flags; everything
 * defaults off. Reached from the desktop rail's Settings item.
 */
import { PageHead } from '../components/ui/PageHead';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { Switch } from '../components/ui/Switch';
import { FEATURE_FLAGS, isFlagOn, setFlag, useFlagsVersion, type FlagId } from '../data/flags';
import { useT } from '../i18n';

export function SettingsView({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  useFlagsVersion(); // re-render when a flag changes

  const meta: Record<string, { label: string; desc: string }> = {
    gymPresence: { label: t.flagGymPresence, desc: t.flagGymPresenceDesc },
    nutrition: { label: t.flagNutrition, desc: t.flagNutritionDesc },
  };

  return (
    <div className="screen settings-view ug-16">
      <PageHead
        back={{ label: t.backAction, onClick: onClose }}
        title={t.settingsTitle}
        sub={t.settingsSub}
      />

      <GroupedList header={t.settingsFeaturesLabel}>
        {FEATURE_FLAGS.map((f) => {
          const on = isFlagOn(f.id as FlagId);
          const m = meta[f.id] ?? { label: f.id, desc: '' };
          return (
            <ListRow
              key={f.id}
              label={m.label}
              sub={`${m.desc}${f.scope === 'global' ? ` · ${t.flagScopeGlobal}` : ''}`}
              trailing={
                <Switch
                  checked={on}
                  aria-label={m.label}
                  onChange={() => setFlag(f.id as FlagId, !on)}
                />
              }
            />
          );
        })}
      </GroupedList>
    </div>
  );
}
