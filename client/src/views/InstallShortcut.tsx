/** Login-page “Create a shortcut” — OS-branded install / Add to Home Screen. */
import { useState } from 'react';
import { useT } from '../i18n';
import { Icon, Sheet } from '../ui';
import { usePwaInstall, type PwaInstallMode } from '../usePwaInstall';

export function InstallShortcut() {
  const { t } = useT();
  const { visible, brand, mode, guideMode, promptInstall } = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (!visible || !brand || !mode) return null;

  async function onClick() {
    if (mode === 'prompt') {
      const outcome = await promptInstall();
      if (outcome === 'unavailable') setGuideOpen(true);
      return;
    }
    setGuideOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary auth-install-btn"
        onClick={() => void onClick()}
      >
        <Icon name={brand === 'apple' ? 'apple-logo' : 'android-logo'} weight="fill" />
        {t.createShortcut}
      </button>

      {guideOpen && <InstallGuideSheet mode={guideMode} onClose={() => setGuideOpen(false)} />}
    </>
  );
}

function InstallGuideSheet({ mode, onClose }: { mode: PwaInstallMode; onClose: () => void }) {
  const { t } = useT();

  const title =
    mode === 'ios-guide'
      ? t.installIosTitle
      : mode === 'mac-guide'
        ? t.installMacTitle
        : t.installAndroidTitle;

  const steps =
    mode === 'ios-guide'
      ? [
          { icon: 'export' as const, text: t.installIosStep1 },
          { icon: 'plus' as const, text: t.installIosStep2 },
          { icon: 'check-circle' as const, text: t.installIosStep3 },
        ]
      : mode === 'mac-guide'
        ? [
            { icon: 'export' as const, text: t.installMacStep1 },
            { icon: 'plus' as const, text: t.installMacStep2 },
          ]
        : [
            { icon: 'dots-three-vertical' as const, text: t.installAndroidStep1 },
            { icon: 'download-simple' as const, text: t.installAndroidStep2 },
            { icon: 'check-circle' as const, text: t.installAndroidStep3 },
          ];

  const brandIcon = mode === 'android-guide' || mode === 'prompt' ? 'android-logo' : 'apple-logo';

  return (
    <Sheet onClose={onClose}>
      <div className="install-guide">
        <div className="install-guide-brand" aria-hidden>
          <Icon name={brandIcon} weight="fill" />
        </div>
        <h3 className="install-guide-title">{title}</h3>
        <p className="install-guide-sub">{t.createShortcutHint}</p>
        <ol className="install-guide-steps">
          {steps.map((s, i) => (
            <li key={i}>
              <span className="install-guide-num">{i + 1}</span>
              <Icon name={s.icon} />
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {t.installGotIt}
        </button>
      </div>
    </Sheet>
  );
}
