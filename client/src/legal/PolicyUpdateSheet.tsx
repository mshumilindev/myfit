/**
 * The blocking confirm sheet for a MATERIAL policy / terms change (SPO-295 N8). Lists "what is new" from the typed
 * changelog, makes the person open the changed document(s) before "I agree" (the registration read-gate), and reports
 * Continue. Declining is the existing gate's way out: sign out or delete the account, nothing else.
 */
import { useT } from '../i18n';
import { useLegalT } from '../i18n/legal';
import { useUpdateT } from '../i18n/legalUpdate';
import { Button } from '../components/ui/Button';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { Sheet } from '../components/ui/Overlays';
import { clearDocRead } from '../components/ui/docReadGate';
import { fmtVersionDate } from './docVersion';
import { AgreementBlock, useAgreementGate } from './AgreementBlock';
import { openLegalPage, useGateLeave } from './GateLeaveActions';
import type { ChangeBullet } from './changelog';
import type { PendingUpdate } from './policyUpdate';
import './LegalGate.css';

const BULLET_ICON: Record<ChangeBullet, string> = {
  recipient: 'plus-circle',
  purpose: 'plus-circle',
  category: 'plus-circle',
  retention: 'plus-circle',
  transfer: 'plus-circle',
  terms: 'note',
};

/** The public page id of a document. */
const PAGE = { terms: 'terms', policy: 'privacy' } as const;

export function PolicyUpdateSheet({
  updates,
  onContinue,
  onSignOut,
}: {
  updates: readonly PendingUpdate[];
  onContinue: () => void;
  onSignOut: () => void;
}) {
  const { t, locale } = useT();
  const { lg } = useLegalT();
  const u = useUpdateT();
  const docs = updates.map((x) => x.doc);
  const name = docs.length > 1 ? u.docName.both : u.docName[docs[0]];
  const ids = docs.map((d) => PAGE[d]);
  const versions = Object.fromEntries(updates.map((x) => [PAGE[x.doc], x.version]));
  const gate = useAgreementGate(ids, false, versions);
  const leave = useGateLeave(onSignOut);
  const bullets = [...new Set(updates.flatMap((x) => x.bullets))];
  const date = fmtVersionDate(updates.map((x) => x.version).sort()[updates.length - 1], locale);
  return (
    <>
      <Sheet
        onClose={() => undefined}
        dismissible={false}
        padded
        role="alertdialog"
        label={u.sheetTitle(name)}
      >
        <div className="lgg">
          <div className="lgg-head">
            <IconTile tone="accent" size={44} icon="note" />
            <h2 className="lgg-t ut-xl ut-w7">{u.sheetTitle(name)}</h2>
          </div>
          <p className="lgg-lead ut-base ut-muted">{u.sheetLead(date)}</p>
          {bullets.length > 0 && (
            <GroupedList surface="raised" header={u.newHeader}>
              {bullets.map((b) => (
                <ListRow
                  key={b}
                  icon={<IconTile size={30} icon={BULLET_ICON[b]} />}
                  label={u.bullets[b].title}
                  sub={u.bullets[b].sub}
                />
              ))}
            </GroupedList>
          )}
          <AgreementBlock
            docs={docs.map((d) => ({
              id: PAGE[d],
              label: d === 'terms' ? lg.ui.termsLink : lg.ui.privacyLink,
            }))}
            gate={gate}
            onOpen={openLegalPage}
            strings={{
              header: t.onbAgreeHeader,
              lockedHint: docs.length > 1 ? u.openBoth : u.openOne,
              notOpenedLabel: t.onbAgreeNotOpened,
              readLabel: t.onbAgreeRead,
              agreeLabel: u.agree(name),
            }}
          />
          <div className="lgg-acts">
            <Button
              variant="primary"
              size="lg"
              disabled={!gate.canContinue}
              onClick={() => {
                clearDocRead(ids, versions);
                onContinue();
              }}
            >
              {u.accept}
            </Button>
            {leave.buttons}
          </div>
        </div>
      </Sheet>
      {leave.dialogs}
    </>
  );
}
