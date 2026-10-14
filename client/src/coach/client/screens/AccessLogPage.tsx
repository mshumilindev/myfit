import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FailedState } from '../../../components/ui/FailedState';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { useChatT } from '../../../i18n/coachChat';
import { useClientT } from '../../../i18n/coachClient';
import { dayKey, dayLabel, clock } from '../../chat/format';
import { firstName } from '../../screens/format';
import type { ClientCoachPort } from '../data/port';
import { useClientCoach } from '../data/useClientCoach';
import type { AccessEntry } from '../data/types';
import { CATEGORY_UI, SHARE_CATEGORIES, type ShareCategory } from '../domain';
import { accessText, catTitle, listWords } from '../labels';
import { PushedPage } from './PushedPage';

/**
 * "Who saw your data" (S-31): the trainer's reads of MY data, newest first, grouped by day. One entry per category per tab
 * open; categories that are not shared cannot appear (the footer says so). Loading is skeleton rows, errors keep the page.
 */
export function AccessLogPage({ port, onBack }: { port?: ClientCoachPort; onBack: () => void }) {
  const { cc, locale } = useClientT();
  const { ch } = useChatT();
  const { snapshot, store } = useClientCoach(port);
  const [rows, setRows] = useState<AccessEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const fetchLog = useCallback(() => {
    store.port
      .accessLog()
      .then(setRows)
      .catch(() => setFailed(true));
  }, [store]);
  const load = useCallback(() => {
    setFailed(false);
    fetchLog();
  }, [fetchLog]);
  useEffect(fetchLog, [fetchLog]);

  const trainer = snapshot?.link.trainer;
  const first = firstName(trainer?.name ?? '');
  const now = store.port.now();
  const groups = useMemo(() => {
    const out: { key: string; at: number; rows: AccessEntry[] }[] = [];
    [...(rows ?? [])]
      .sort((a, b) => b.at - a.at)
      .forEach((r) => {
        const k = dayKey(r.at);
        const g = out.find((x) => x.key === k);
        if (g) g.rows.push(r);
        else out.push({ key: k, at: r.at, rows: [r] });
      });
    return out;
  }, [rows]);
  const hidden: ShareCategory[] = snapshot
    ? SHARE_CATEGORIES.filter((k) => k !== 'injury' && snapshot.link.grants[k] === 'off')
    : [];

  return (
    <PushedPage title={cc.lgTitle} backLabel={cc.ccBack} onBack={onBack}>
      <Notice tone="rest" icon="eye" aligned>
        {cc.lgInfo(first)}
      </Notice>
      {failed && !rows && (
        <FailedState title={cc.lgFailed} retryLabel={cc.ccRetry} onRetry={load} />
      )}
      {!failed && !rows && <SkeletonRows rows={4} label={cc.ccLoading} />}
      {rows && rows.length === 0 && (
        <EmptyState titleAs="h2" icon="eye" title={cc.lgEmpty(first)} body={cc.lgEmptyBody} />
      )}
      {groups.map((g) => (
        <GroupedList key={g.key} header={dayLabel(g.at, now, ch, locale)}>
          {g.rows.map((r) => {
            const ui =
              CATEGORY_UI[(r.category === 'checkins' ? 'totals' : r.category) as ShareCategory];
            return (
              <ListRow
                key={r.id}
                icon={<IconTile tone={ui.tone} size={30} icon={ui.icon} />}
                label={catTitle(
                  cc,
                  (r.category === 'checkins' ? 'totals' : r.category) as ShareCategory,
                )}
                sub={[
                  r.ref ? `${accessText(cc, r.what)}: ${r.ref}` : accessText(cc, r.what),
                  r.count && r.count > 1 ? cc.lgTimes(r.count) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                value={<time dateTime={new Date(r.at).toISOString()}>{clock(r.at)}</time>}
              />
            );
          })}
        </GroupedList>
      ))}
      <GroupedList
        footer={
          hidden.length > 0
            ? cc.lgNotShared(
                listWords(
                  hidden.map((k) => catTitle(cc, k)),
                  locale,
                ),
              )
            : undefined
        }
      >
        <ListRow
          icon={<IconTile tone="neutral" size={30} icon="info" />}
          label={cc.lgKept}
          sub={cc.lgKeptSub}
        />
      </GroupedList>
    </PushedPage>
  );
}
