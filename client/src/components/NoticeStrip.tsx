import { useT } from '../i18n';
import { Icon } from '../ui';
import { IconButton } from './ui/Button';
import type { Notice } from '../types';

function noticeIcon(kind: string): string {
  if (kind.startsWith('program')) return 'copy';
  if (kind.startsWith('role')) return 'shield-check';
  return 'barbell';
}

/** In-product notices strip: assignment, role and trainer changes (AC-ROLE-10, AC-PLAN-11). */
export function NoticeStrip(props: { notices: Notice[]; onDismiss: (id: string) => void }) {
  const { t } = useT();
  return (
    <>
      {props.notices.map((n) => (
        <div key={n.id} className="notice" role="status">
          <Icon name={noticeIcon(n.kind)} />
          <span className="notice-text">{t.noticeText(n.kind, n.actor, n.detail)}</span>
          <IconButton icon="x" size="sm" label={t.dismiss} onClick={() => props.onDismiss(n.id)} />
        </div>
      ))}
    </>
  );
}
