/**
 * A theme that is not installed yet, offered as a half-screen card (Themes page, SPO-500 add-ons first). The theme's
 * own tokens are not loaded, so the picture is the wordmark on the current theme's atmosphere; the one button installs.
 */
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Tag } from '../components/ui/Tag';
import { useT } from '../i18n';
import type { ThemeDef } from '../themes';
import './themes.css';

export function ThemeInviteCard({
  theme,
  onInstall,
}: {
  theme: ThemeDef;
  onInstall: (id: string) => void;
}) {
  const { t } = useT();
  return (
    <Card pad="none" className="thm-card thm-invite">
      <div className="thm-art" aria-hidden="true">
        <span className="thm-wm">{theme.name}</span>
      </div>
      <Tag tone="neutral" className="thm-new">
        {t.themesNotInstalled}
      </Tag>
      <div className="thm-foot">
        <Button variant="primary" fullWidth onClick={() => onInstall(theme.id)}>
          {t.themesInstall}
        </Button>
      </div>
    </Card>
  );
}
