import { useCallback, useEffect, useState } from 'react';
import { SpotterMark } from '../../../brand/SpotterMark';
import { BackButton } from '../../../components/ui/BackButton';
import { Button } from '../../../components/ui/Button';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { InfoTable } from '../../../components/ui/InfoTable';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { OptionCard, OptionCardGrid } from '../../../components/ui/OptionCard';
import { Sheet } from '../../../components/ui/Overlays';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Tag } from '../../../components/ui/Tag';
import { fmtDayMonth } from '../../../i18n';
import { useClientT, type ClientStrings } from '../../../i18n/coachClient';
import { Icon } from '../../../ui';
import { ClientAvatar } from '../../ClientAvatar';
import { firstName } from '../../screens/format';
import { useClientCoach } from '../data/useClientCoach';
import type { ClientCoachPort } from '../data/port';
import type { InviteInfo } from '../data/types';
import {
  NOTHING,
  PRESET_ICON,
  PRESET_IDS,
  SHARE_CATEGORIES,
  levelsBy,
  presetConsent,
  type PresetId,
} from '../domain';
import { catTitle, levelWord, presetSub, presetTitle } from '../labels';
import '../ClientCoach.css';

export type InviteExit = 'today' | 'chat' | 'sharing' | 'close';
type Phase =
  | { k: 'loading' }
  | { k: 'offline' }
  | { k: 'landing'; inv: InviteInfo }
  | { k: 'share'; inv: InviteInfo }
  | { k: 'accepted'; inv: InviteInfo; waiting: boolean }
  | { k: 'end'; inv: InviteInfo };

function Rail({ upTo, label }: { upTo: number; label: string }) {
  return (
    <div
      className="onb-rail"
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={2}
      aria-valuenow={upTo}
    >
      {[1, 2].map((i) => (
        <span key={i} className={`bar${i <= upTo ? ' on' : ''}`} aria-hidden />
      ))}
    </div>
  );
}

function Shell({
  children,
  center,
  onBack,
  backLabel,
}: {
  children: React.ReactNode;
  center?: boolean;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className={`onb-shell${center ? ' center' : ''}`}>
      {!center && (
        <div className="onb-top">
          {onBack ? <BackButton label={backLabel ?? ''} onClick={onBack} /> : <span />}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * The invite pages (S-25 .. S-28), one route `#/invite/<token>`, drawn with the real onboarding frame. Nothing is
 * written before "Save and continue" / "Share nothing for now" (S-25 AC). Decline is one tap. Offline = a FailedState-like
 * page with Try again, never a spinner screen.
 */
export function InvitePages({
  token,
  port,
  onExit,
}: {
  token: string;
  port?: ClientCoachPort;
  onExit: (to: InviteExit) => void;
}) {
  const { cc, locale } = useClientT();
  const { store, snapshot } = useClientCoach(port);
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [preset, setPreset] = useState<PresetId>('recovery');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  const fetchInvite = useCallback(() => {
    store.port
      .getInvite(token)
      .then((inv) => setPhase(inv.state === 'valid' ? { k: 'landing', inv } : { k: 'end', inv }))
      .catch(() => setPhase({ k: 'offline' }));
  }, [store, token]);
  const load = useCallback(() => {
    setPhase({ k: 'loading' });
    fetchInvite();
  }, [fetchInvite]);
  useEffect(fetchInvite, [fetchInvite]);

  const accept = async (grants: ReturnType<typeof presetConsent>) => {
    if (phase.k !== 'share') return;
    setBusy(true);
    setError(false);
    try {
      await store.port.acceptInvite(token, grants);
      setPhase({ k: 'accepted', inv: phase.inv, waiting: true });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (phase.k === 'loading')
    return (
      <Shell center>
        <div
          className="onb-card cc-skel"
          role="status"
          aria-busy="true"
          aria-label={cc.invLoadingAria}
        >
          <Skeleton className="cc-skel-mark" />
          <Skeleton className="cc-skel-line" />
          <Skeleton className="cc-skel-line" />
          <Skeleton className="cc-skel-btn" />
        </div>
      </Shell>
    );
  if (phase.k === 'offline')
    return (
      <Shell center>
        <div className="onb-card">
          <Icon name="cloud-slash" className="onb-dead-icon" />
          <h2>{cc.invOfflineTitle}</h2>
          <p className="lead">{cc.invOfflineBody}</p>
          <Button variant="primary" size="lg" onClick={load}>
            {cc.ccRetry}
          </Button>
          <Button variant="link" onClick={() => onExit('close')}>
            {cc.invExpContinue}
          </Button>
        </div>
      </Shell>
    );

  const { inv } = phase;
  const first = firstName(inv.trainerName);

  if (phase.k === 'end') {
    const expired = inv.state === 'expired';
    const used = inv.state === 'used';
    return (
      <Shell center>
        <div className="onb-card" role={expired ? 'alert' : undefined}>
          <Icon
            name={expired ? 'warning-circle' : used ? 'check-circle' : 'prohibit'}
            className="onb-dead-icon"
          />
          <h2>{expired ? cc.invExpTitle : used ? cc.invUsedTitle : cc.invDeclinedTitle}</h2>
          <p className="lead">
            {expired
              ? cc.invExpBody(inv.trainerName)
              : used
                ? cc.invUsedBody
                : cc.invDeclinedBody(first)}
          </p>
          {expired ? (
            <>
              <Button variant="primary" size="lg" onClick={() => setAskOpen(true)}>
                {cc.invExpAsk(first)}
              </Button>
              <Button variant="link" onClick={() => onExit('today')}>
                {cc.invExpContinue}
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" onClick={() => onExit('today')}>
              {cc.invGoToday}
            </Button>
          )}
        </div>
        {askOpen && <AskSheet cc={cc} first={first} onClose={() => setAskOpen(false)} />}
      </Shell>
    );
  }

  if (phase.k === 'landing')
    return (
      <Shell>
        <div className="onb-card landing">
          <SpotterMark size={48} variant="tight" className="onb-wordmark" />
          <h1 className="display">{cc.invTitle(first)}</h1>
          <p className="lead">
            {inv.org ? `${cc.invInviterAt(inv.org)}. ${cc.invBody}` : cc.invBody}
          </p>
          <div className="onb-inviter">
            <ClientAvatar id={undefined} name={inv.trainerName} size={40} hasPhoto={false} />
            <span>{cc.invInviter(inv.trainerName)}</span>
          </div>
          <Rail upTo={1} label={cc.invStep1Aria} />
          <Button variant="primary" size="lg" onClick={() => setPhase({ k: 'share', inv })}>
            {cc.invAccept} <Icon name="arrow-right" />
          </Button>
          <Button
            variant="link"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              store.port
                .declineInvite(token)
                .then(() => setPhase({ k: 'end', inv: { ...inv, state: 'declined' } }))
                .catch(() => setPhase({ k: 'offline' }))
                .finally(() => setBusy(false));
            }}
          >
            {cc.invDecline}
          </Button>
          <div className="footnote center">{cc.invUntil(fmtDayMonth(inv.expiresAt, locale))}</div>
        </div>
      </Shell>
    );

  if (phase.k === 'share') {
    const grants = presetConsent(preset);
    return (
      <Shell onBack={() => setPhase({ k: 'landing', inv })} backLabel={cc.ccBack}>
        <div className="onb-card">
          <div className="onb-steptop">
            <Rail upTo={2} label={cc.invStep2Aria} />
            <div className="row">
              <span className="k">{cc.invStep}</span>
              <span className="k right">{cc.invStepName}</span>
            </div>
          </div>
          <h1 className="display sm">{cc.invShareTitle(first)}</h1>
          <p className="lead">{cc.invShareBody}</p>
          <OptionCardGrid label={cc.presetLabel} columns={1}>
            {PRESET_IDS.map((id) => (
              <OptionCard
                key={id}
                icon={<IconTile tone="accent" size={30} icon={PRESET_ICON[id]} />}
                title={presetTitle(cc, id)}
                sub={presetSub(cc, id)}
                selected={preset === id}
                onSelect={() => setPreset(id)}
              />
            ))}
          </OptionCardGrid>
          <section className="cc-stack" aria-live="polite">
            <SectionLabel>{cc.invWouldSee(first)}</SectionLabel>
            <InfoTable
              label={cc.invWouldSee(first)}
              rows={SHARE_CATEGORIES.map((k) => ({
                id: k,
                label: catTitle(cc, k),
                value: levelWord(cc, grants[k]),
              }))}
            />
            <p className="cc-muted">{cc.invShareNote(first)}</p>
          </section>
          {error && (
            <p className="cc-err" role="alert">
              {cc.invSaveFailed}
            </p>
          )}
          <Button variant="primary" size="lg" loading={busy} onClick={() => void accept(grants)}>
            {cc.invSave}
          </Button>
          <Button variant="link" disabled={busy} onClick={() => void accept(NOTHING)}>
            {cc.invNothing}
          </Button>
        </div>
      </Shell>
    );
  }

  // accepted
  const link = snapshot?.link;
  const g = link?.grants ?? presetConsent(preset);
  const nFull = levelsBy(g, 'full').length;
  const nEff = levelsBy(g, 'effects').length;
  const waiting = link?.state === 'waiting';
  return (
    <Shell center>
      <div className="onb-card">
        <IconTile
          tone={waiting ? 'illness' : 'ok'}
          size={56}
          icon={waiting ? 'hourglass' : 'check-circle'}
        />
        <h1>{cc.invOkTitle(first)}</h1>
        <p className="lead">
          {waiting
            ? `${cc.invOkWaiting(first)}. ${cc.invOkWaitingBody}`
            : cc.invOkBody(inv.trainerName)}
        </p>
        <div className="cc-tags">
          {nFull + nEff === 0 ? (
            <Tag tone="neutral">{cc.invOkTagNone}</Tag>
          ) : (
            <>
              {nFull > 0 && <Tag tone="ok">{cc.invOkTagFull(nFull)}</Tag>}
              {nEff > 0 && <Tag tone="rest">{cc.invOkTagEffects(nEff)}</Tag>}
            </>
          )}
          {g.injury === 'off' && <Tag tone="neutral">{cc.invOkInjuryOff}</Tag>}
        </div>
        <Button variant="primary" size="lg" onClick={() => onExit('today')}>
          {cc.invGoToday}
        </Button>
        <Button variant="link" onClick={() => onExit('chat')}>
          {cc.invMessage(first)}
        </Button>
        <Button variant="link" size="sm" onClick={() => onExit('sharing')}>
          {cc.invChange}
        </Button>
      </div>
    </Shell>
  );
}

function AskSheet({
  cc,
  first,
  onClose,
}: {
  cc: ClientStrings;
  first: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = cc.invAskText(first);
  return (
    <Sheet onClose={onClose} label={cc.invAskSheet} padded>
      <div className="cc-stack">
        <h2 className="cc-h2">{cc.invAskSheet}</h2>
        <p className="cc-muted">{cc.invAskHint}</p>
        <GroupedList>
          <ListRow label={text} wrap />
        </GroupedList>
        <Button
          variant="primary"
          icon={copied ? 'check' : 'copy'}
          onClick={() => {
            void navigator.clipboard?.writeText(text).catch(() => undefined);
            setCopied(true);
          }}
        >
          {copied ? cc.invAskCopied : cc.invAskCopy}
        </Button>
      </div>
    </Sheet>
  );
}
