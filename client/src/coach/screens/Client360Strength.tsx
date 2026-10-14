import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExportMenu } from '../../components/ui/ExportMenu';
import { GroupedList, ListPanel, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { SearchField } from '../../components/ui/SearchField';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Segmented } from '../../components/ui/Segmented';
import { ToneText } from '../../components/ui/ToneText';
import { WidgetSpark } from '../../components/ui/Widget';
import { Icon } from '../../ui';
import type { LocaleId } from '../../i18n';
import type { C360Strings } from '../../i18n/coachClient360';
import { useReadLog, localReadLog, type ReadLogPort } from '../data/readLog';
import type { DerivedWorld } from '../data/deriveWorld';
import { askable } from '../domain/consent';
import { strengthCsv } from '../domain/csv';
import type { CoachClient } from '../domain/types';
import {
  gateStrength,
  liftRows,
  NOISE_KG,
  type ExerciseSession,
  type LiftRow,
  type StrengthSort,
} from '../domain/workouts';
import { coachDayMonth } from '../format';
import { chatRoute, type CoachRoute } from '../routes';
import { useReauthGuard } from '../security/useReauthGuard';
import { downloadCsv, fileSlug } from './csvDownload';
import { exportStrings } from './exportStrings';
import { firstName } from './format';

export interface StrengthTabProps {
  client: CoachClient;
  world: DerivedWorld;
  c: C360Strings;
  locale: LocaleId;
  onNavigate: (r: CoachRoute) => void;
  readLog?: ReadLogPort;
}

/** Rows drawn at once; more come with "Show more" (the list stays light on a long history). */
const PAGE = 50;

const signed = (n: number): string => {
  const v = Math.round(n * 10) / 10;
  return v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '±0';
};

/** Client 360, Strength tab (S-05): exercises with estimated 1RM, search, sort, per-session detail, CSV. */
export function StrengthTab({ client, world, c, locale, onNavigate, readLog }: StrengthTabProps) {
  const first = firstName(client.name);
  const gated = useMemo(
    () => gateStrength(world.history[client.id]?.workouts, client.mode, client.consent),
    [world.history, client.id, client.mode, client.consent],
  );
  const log = readLog ?? localReadLog;
  useReadLog(log, client.id, 'strength', ['sets'], gated.state !== 'ok');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<StrengthSort>('recent');
  const [open, setOpen] = useState('');
  const [shown, setShown] = useState(PAGE);
  const askN = askable(client.mode, client.consent).length;

  const { rows, total, stalled } = useMemo(
    () => liftRows(gated.exercises, q, sort),
    [gated.exercises, q, sort],
  );
  const all = useMemo(() => liftRows(gated.exercises, '', 'recent').rows, [gated.exercises]);
  const csv = strengthCsv(rows);
  const colLabels = c.exColStrength;
  const filtered = q.trim() !== '';

  const { ask, dialog: reauthDialog } = useReauthGuard();
  const doExport = async (everything: boolean): Promise<string | undefined> => {
    if (!(await ask('export'))) return undefined;
    const spec = everything ? strengthCsv(all) : csv;
    const file = c.exFileStrength(fileSlug(first));
    downloadCsv(
      file,
      spec.columns.map((k) => colLabels[k]),
      spec.rows,
    );
    try {
      log.logRead({ clientId: client.id, category: 'sets', via: 'export' });
    } catch {
      /* the log never breaks the export */
    }
    return c.exDone(file, spec.rows.length);
  };

  if (gated.state !== 'ok') {
    const program = gated.state === 'program';
    return (
      <div className="c3-main c3t">
        <Card pad="lg">
          <EmptyState
            titleAs="h2"
            icon="lock-simple"
            title={program ? c.stProgramBody(first) : c.stLockedH(first)}
            body={program ? undefined : c.stLockedBody}
          >
            {!program && (
              <div className="c3-btns">
                {askN > 0 && (
                  <Button
                    variant="secondary"
                    icon="key"
                    aria-label={c.lkAskFor(first, c.lkSets)}
                    onClick={() => onNavigate(chatRoute(client.id))}
                  >
                    {c.lkAsk(first)}
                  </Button>
                )}
                <Button
                  variant="link"
                  iconTrailing="arrow-right"
                  onClick={() => onNavigate({ screen: 'client', cid: client.id, tab: 'workouts' })}
                >
                  {c.stOpenWorkouts}
                </Button>
              </div>
            )}
          </EmptyState>
        </Card>
      </div>
    );
  }

  if (total === 0)
    return (
      <div className="c3-main c3t">
        <Card>
          <EmptyState
            titleAs="h2"
            icon="barbell"
            title={c.stNoResultsH}
            body={c.stNoResultsBody(first)}
          />
        </Card>
      </div>
    );

  const toneOf = (l: LiftRow) =>
    l.tone === 'stalled' ? 'illness' : l.tone === 'rising' ? 'ok' : 'neutral';
  const sessionCols: DataTableColumn<ExerciseSession>[] = [
    {
      id: 'd',
      header: c.stColDate,
      cell: (s) => <span className="c3t-nw">{coachDayMonth(s.at, locale)}</span>,
    },
    { id: 's', header: c.stColSets, align: 'end', cell: (s) => s.sets },
    { id: 't', header: c.stColTop, cell: (s) => s.top },
    { id: 'e', header: c.stColE1rm, align: 'end', strong: true, cell: (s) => s.e1rm },
    { id: 'r', header: c.stColRpe, align: 'end', muted: true, cell: (s) => s.rpe },
  ];

  return (
    <div className="c3-main c3t">
      {reauthDialog}
      <section aria-labelledby="c3t-ex">
        <SectionLabel
          id="c3t-ex"
          action={
            <span className="c3t-hist-a">
              <span className="c3-meta">{c.stWith(total, stalled)}</span>
              <ExportMenu
                strings={exportStrings(c, c.exScopeStrength)}
                size="sm"
                rows={csv.rows.length}
                allRows={filtered ? strengthCsv(all).rows.length : undefined}
                columns={csv.columns.map((k) => colLabels[k])}
                onExport={doExport}
              />
            </span>
          }
        >
          {c.stExercises}
        </SectionLabel>
        <div className="c3t-tools">
          <SearchField
            value={q}
            onChange={(v) => {
              setQ(v);
              setShown(PAGE);
            }}
            placeholder={c.stSearch}
            clearLabel={c.stClearSearch}
            aria-label={c.stSearch}
          />
          <Segmented
            size="sm"
            label={c.stSortLabel}
            value={sort}
            onChange={setSort}
            options={[
              { value: 'recent', label: c.stSortRecent },
              { value: 'change', label: c.stSortChange },
              { value: 'stalled', label: c.stSortStalled },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <Card>
            <p className="c3-m">{c.stNoMatch(q.trim())}</p>
          </Card>
        ) : (
          <GroupedList list label={c.stExercises}>
            {rows.slice(0, shown).map((l) => {
              const on = l.id === open;
              const label = l.tone === 'stalled' ? c.stStalled : c.stChange(signed(l.change));
              return (
                <li key={l.id}>
                  <ListRow
                    strong
                    icon={<IconTile icon="barbell" size={40} />}
                    label={l.name}
                    sub={
                      <>
                        {c.stE1rm(String(l.e1rm))}
                        <br />
                        {c.stLast(coachDayMonth(l.lastAt, locale), l.count)}
                      </>
                    }
                    trailing={
                      <span className="c3t-spark">
                        <span aria-hidden>
                          <WidgetSpark
                            points={l.series}
                            tone={toneOf(l)}
                            width={64}
                            height={24}
                            area
                          />
                        </span>
                        <span className="c3t-chg">
                          {l.tone === 'neutral' ? (
                            label
                          ) : (
                            <ToneText tone={toneOf(l)} strong>
                              {label}
                            </ToneText>
                          )}
                        </span>
                        <Icon name={on ? 'caret-up' : 'caret-down'} />
                      </span>
                    }
                    aria-expanded={on}
                    aria-label={`${l.name}. ${c.stE1rm(String(l.e1rm))}. ${
                      l.tone === 'stalled' ? c.stStalled : c.stChangeSpoken(signed(l.change))
                    }`}
                    onClick={() => setOpen(on ? '' : l.id)}
                  />
                  {on && (
                    <ListPanel>
                      <div className="c3t-recap">
                        <DataTable
                          bare
                          label={c.stDetail(l.name)}
                          columns={sessionCols}
                          rows={[...l.sessions].reverse().slice(0, 8)}
                          rowKey={(s) => String(s.at)}
                        />
                        <div>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="share-network"
                            onClick={() => onNavigate(chatRoute(client.id))}
                          >
                            {c.stShareChat}
                          </Button>
                        </div>
                      </div>
                    </ListPanel>
                  )}
                </li>
              );
            })}
          </GroupedList>
        )}
        {rows.length > shown && (
          <div className="c3t-more">
            <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
              {c.wkShowMore(Math.min(PAGE, rows.length - shown))}
            </Button>
          </div>
        )}
        <p className="c3-m c3t-note">
          <Icon name="info" />
          <span>{c.stNoise(String(NOISE_KG))}</span>
        </p>
      </section>
    </div>
  );
}
