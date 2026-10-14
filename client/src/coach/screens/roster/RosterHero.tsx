import type { ReactNode } from 'react';
import { Card } from '../../../components/ui/Card';
import { InvitePanel, type InviteLabels } from '../../../components/ui/InvitePanel';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { StepList } from '../../../components/ui/StepList';
import type { RosterStrings } from '../../../i18n/coachRoster';
import { defaultRequest } from '../../domain/invite';
import { Header, Inspector, Page, Split } from '../../layout/Layout';
import type { InvitePanelProps } from '../../../components/ui/InvitePanel';

/** First run (no clients, no invites): the invite panel as the hero and how it works. */
export function RosterHero(p: {
  r: RosterStrings;
  labels: InviteLabels;
  eyebrow: string;
  statusBar: ReactNode;
  onCreate: InvitePanelProps['onCreate'];
  onSendInChat: (url: string) => void;
  onOpenProfile: (id: string) => void;
}) {
  const { r } = p;
  return (
    <Page>
      {p.statusBar}
      <Header eyebrow={p.eyebrow} title={r.roTitle} subtitle={r.roClientsN(0)} />
      <Split ratio="8-4">
        <div className="ro-stack">
          <Card pad="lg">
            <InvitePanel
              hero
              labels={p.labels}
              defaultRequest={defaultRequest}
              onCreate={p.onCreate}
              onSendInChat={p.onSendInChat}
              onOpenProfile={p.onOpenProfile}
            />
          </Card>
        </div>
        <Inspector label={r.roHowH} bare>
          <div className="ro-how">
            <SectionLabel role="heading" aria-level={2}>
              {r.roHowH}
            </SectionLabel>
            <StepList
              label={r.roHowH}
              items={r.roHow.map(([t, d], i) => ({
                id: t,
                icon: ['pulse', 'magnifying-glass', 'check-circle'][i],
                title: t,
                body: d,
              }))}
            />
          </div>
        </Inspector>
      </Split>
    </Page>
  );
}
