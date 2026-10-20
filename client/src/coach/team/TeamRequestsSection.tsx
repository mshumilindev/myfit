import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmEffectsDialog } from '../../components/ui/ConfirmEffectsDialog';
import { IconTile } from '../../components/ui/IconTile';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Tag } from '../../components/ui/Tag';
import { Icon } from '../../ui';
import { useSafeT } from '../../i18n/coachSafe';
import { useTeamT } from '../../i18n/coachTeam';
import { firstName } from '../screens/format';
import type { TeamPort } from './port';
import { useTeamRequests } from './useTeamRequests';
import '../../components/ui/RequestCard.css';

/**
 * Agenda "Team requests" (SPO-204, boards D8 / D24): what a manager asks of the trainer. Today: remove a client. Approve opens
 * the same effects dialog as ending coaching from the client's page; Decline answers at once.
 */
export function TeamRequestsSection({ port }: { port?: TeamPort }) {
  const { tm } = useTeamT();
  const { sf } = useSafeT();
  const { requests, answer } = useTeamRequests(port);
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (!requests.length) return null;
  const confirming = requests.find((r) => r.id === asking);

  const run = async (id: string, approve: boolean) => {
    setBusy(id);
    setFailed(null);
    if (!(await answer(id, approve))) setFailed(id);
    setBusy(null);
  };

  return (
    <section className="td-sec" aria-labelledby="td-h-team-req">
      <SectionLabel role="heading" aria-level={2} id="td-h-team-req" action={requests.length}>
        {tm.trSection}
      </SectionLabel>
      <ul className="td-reqs">
        {requests.map((r) => {
          const client = firstName(r.clientName);
          return (
            <li key={r.id}>
              <Card as="section" pad="md" className="uirq">
                <div className="uirq-head">
                  <IconTile icon="sign-out" size={40} />
                  <div className="uirq-head-t">
                    <h2 className="uirq-title">{tm.trTitle(firstName(r.managerName), client)}</h2>
                  </div>
                  <Tag tone="accent" icon={<Icon name="hourglass" />}>
                    {tm.trStatus}
                  </Tag>
                </div>
                {r.reason && <blockquote className="uirq-note">“{r.reason}”</blockquote>}
                <div className="uirq-acts ctl-row--md">
                  <Button
                    variant="secondary"
                    icon="check"
                    disabled={busy === r.id}
                    aria-label={tm.trApproveFor(client)}
                    onClick={() => setAsking(r.id)}
                  >
                    {tm.trApprove}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy === r.id}
                    aria-label={tm.trDeclineFor(client)}
                    onClick={() => void run(r.id, false)}
                  >
                    {tm.trDecline}
                  </Button>
                </div>
                {failed === r.id && (
                  <p className="uirq-error" role="alert">
                    {tm.trFailed}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      {confirming && (
        <ConfirmEffectsDialog
          title={tm.trConfirmTitle(firstName(confirming.clientName))}
          icon="sign-out"
          body={sf.ecBody}
          effects={[
            { icon: 'eye-slash', text: sf.ecEffectSee(firstName(confirming.clientName)) },
            { icon: 'envelope', text: sf.ecEffectKeeps(firstName(confirming.clientName)) },
            { icon: 'pencil-simple', text: sf.ecEffectNotes },
          ]}
          confirmLabel={tm.trConfirm}
          cancelLabel={sf.raCancel}
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            const id = confirming.id;
            setAsking(null);
            void run(id, true);
          }}
        />
      )}
    </section>
  );
}
