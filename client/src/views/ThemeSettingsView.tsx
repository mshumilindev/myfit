/**
 * Theme settings (Studio): its own page, opened from the gear of the Studio card on Themes. Mode (Auto by the sun,
 * Light, Dark) and the accent colour (nine swatch cards). A choice shows at once as a DRAFT (nothing is saved or
 * synced); Save keeps it, Reset to default puts the draft back to Auto + Titanium (after a dialog) and is saved by Save
 * too. Leaving without Save puts the saved look back.
 */
import { useEffect, useRef, useState } from 'react';
import { Sun } from '@phosphor-icons/react/Sun';
import { PageHead } from '../components/ui/PageHead';
import { SectionLabel } from '../components/ui/SectionLabel';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Overlays';
import { StickyActionBar } from '../components/ui/StickyActionBar';
import { ThemeSwatch, ThemeSwatchGrid } from '../components/ui/ThemeSwatch';
import { useT } from '../i18n';
import { getAxis, previewAxis, savedAxis, setAxis } from '../themes';
import { getModePref, previewModePref, setModePref, type ModePref } from '../themes/modePref';
import { STUDIO_ACCENTS, STUDIO_DEFAULT_ACCENT } from '../themes/studioAccents';
import './themeSettings.css';

const MODES: {
  id: ModePref;
  key: 'themeModeAuto' | 'themeModeLight' | 'themeModeDark';
  icon: string | null;
}[] = [
  { id: 'auto', key: 'themeModeAuto', icon: 'sun-horizon' },
  { id: 'light', key: 'themeModeLight', icon: null },
  { id: 'dark', key: 'themeModeDark', icon: 'moon' },
];

/** The accent that is saved for Studio: an accent that Studio does not have (another theme's) means its default. */
function savedStudioAccent(): string {
  const s = savedAxis('accent') ?? getAxis('accent');
  return STUDIO_ACCENTS.some((a) => a.id === s) ? s : STUDIO_DEFAULT_ACCENT;
}

export function ThemeSettingsView({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [saved, setSaved] = useState(() => ({ mode: getModePref(), accent: savedStudioAccent() }));
  const [draft, setDraft] = useState(saved);
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const keep = useRef(saved);
  useEffect(() => {
    keep.current = saved;
  }, [saved]);
  const dirty = draft.mode !== saved.mode || draft.accent !== saved.accent;

  // the draft is what the app shows now; leaving puts the saved look back
  useEffect(() => {
    previewAxis('accent', draft.accent);
    previewModePref(draft.mode);
  }, [draft]);
  useEffect(
    () => () => {
      previewAxis('accent', keep.current.accent);
      previewModePref(keep.current.mode);
    },
    [],
  );

  const save = () => {
    setModePref(draft.mode);
    setAxis('accent', draft.accent);
    setSaved(draft);
  };
  const reset = () => {
    setAsking(false);
    setDraft({ mode: 'auto', accent: STUDIO_DEFAULT_ACCENT });
  };
  const atDefault = draft.mode === 'auto' && draft.accent === STUDIO_DEFAULT_ACCENT;

  return (
    <div className="screen theme-settings">
      <PageHead
        back={{ label: t.backAction, onClick: () => (dirty ? setLeaving(true) : onClose()) }}
        title={t.themeSettingsTitle}
      />
      <SectionLabel>{t.themeModeSection}</SectionLabel>
      <GroupedList label={t.themeModeSection}>
        {MODES.map((m) => (
          <ListRow
            key={m.id}
            icon={
              m.icon ? (
                <IconTile icon={m.icon} size={30} tone="neutral" />
              ) : (
                <IconTile size={30} tone="neutral">
                  <Sun />
                </IconTile>
              )
            }
            label={t[m.key]}
            check={draft.mode === m.id}
            onClick={() => setDraft((d) => ({ ...d, mode: m.id }))}
          />
        ))}
      </GroupedList>
      <SectionLabel>{t.themeAccentSection}</SectionLabel>
      <ThemeSwatchGrid label={t.themeAccentLabel}>
        {STUDIO_ACCENTS.map((a) => (
          <ThemeSwatch
            key={a.id}
            name={t[a.key]}
            light={a.light}
            dark={a.dark}
            lightLabel={t.themeDayShort}
            darkLabel={t.themeNightShort}
            selected={draft.accent === a.id}
            onSelect={() => setDraft((d) => ({ ...d, accent: a.id }))}
          />
        ))}
      </ThemeSwatchGrid>
      <StickyActionBar variant="page">
        <Button variant="secondary" disabled={atDefault} onClick={() => setAsking(true)}>
          {t.themeReset}
        </Button>
        <Button variant="primary" disabled={!dirty} onClick={save}>
          {t.save}
        </Button>
      </StickyActionBar>
      {leaving && (
        <ConfirmDialog
          title={t.themeLeaveTitle}
          body={t.themeLeaveBody}
          confirmLabel={t.themeLeaveConfirm}
          cancelLabel={t.themeLeaveStay}
          onConfirm={onClose}
          onCancel={() => setLeaving(false)}
        />
      )}
      {asking && (
        <ConfirmDialog
          title={t.themeResetTitle}
          body={t.themeResetBody}
          confirmLabel={t.themeResetConfirm}
          cancelLabel={t.cancel}
          onConfirm={reset}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  );
}
