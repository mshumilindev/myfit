import { BackButton } from '../../components/ui/BackButton';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { Tag } from '../../components/ui/Tag';
import { useTeamT } from '../../i18n/coachTeam';
import { Header, Page } from '../layout/Layout';
import type { CoachRoute } from '../routes';

type Row = readonly [string, string, string];

/**
 * What each role can do (SPO-203, board D21): a fixed matrix, the same for everyone. It states what the server enforces; it is
 * not a setting. The only per-manager switch is "See all team activity" on the manager's card.
 */
export function RolesScreen({ onNavigate }: { onNavigate: (r: CoachRoute) => void }) {
  const { tm } = useTeamT();
  const cell = (v: string) =>
    v === 'yes' ? (
      <Tag tone="ok">{tm.rlYes}</Tag>
    ) : v === 'no' ? (
      <Tag tone="neutral">{tm.rlNo}</Tag>
    ) : v === 'request' ? (
      <Tag tone="warmup">{tm.rlByRequest}</Tag>
    ) : v === 'everything' ? (
      <Tag tone="ok">{tm.rlEverything}</Tag>
    ) : (
      <Tag tone="accent">{tm.rlOwnOrAll}</Tag>
    );
  const columns: DataTableColumn<Row>[] = [
    { id: 'what', header: tm.rlAccess, strong: true, cell: (r) => r[0] },
    { id: 'trainer', header: tm.tmRoleTrainer, cell: (r) => cell(r[1]) },
    { id: 'manager', header: tm.tmRoleManager, cell: (r) => cell(r[2]) },
  ];
  return (
    <Page>
      <Header
        eyebrow={
          <BackButton
            text={tm.tmTitle}
            label={tm.tmTitle}
            onClick={() => onNavigate({ screen: 'team' })}
          />
        }
        title={tm.rlTitle}
        slots={false}
        subtitle={tm.rlSub}
      />
      <DataTable
        label={tm.rlTableLabel}
        columns={columns}
        rows={tm.rlRows as readonly Row[]}
        rowKey={(r) => r[0]}
      />
    </Page>
  );
}
