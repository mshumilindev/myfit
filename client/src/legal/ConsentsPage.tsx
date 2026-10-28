/**
 * Consents (SPO-295 N4): every consent in one place, given or withdrawn with one switch. Built from kit pieces only.
 * Required (Terms, Privacy Policy, 18+): the switch opens a prompt that says withdrawing deletes the account; the
 * delete button is live only when the caller passes `onDeleteAccount` (the real flow, SPO-285), never faked.
 * Optional: on = `grantConsent` (gym search opens its own disclosure prompt, SPO-293, and records nothing here), off = a
 * confirm, then the withdrawal through the persisted consent queue (an offline withdrawal is sent later, not lost).
 * Each health feature (SPO-290) turns on through its own consent prompt (`HealthConsentHost`) and off through the withdraw
 * dialog, which then OFFERS to delete that feature's data (`HealthWithdrawDialog`).
 * Atlas AI chat and its Puter backup (SPO-286) turn on through the consent prompt that lists what is sent, and off through the
 * withdraw dialog (which can also clear the chat); the Puter switch works only while the AI chat is on.
 */
import { useState } from 'react';
import { GroupedList } from '../components/ui/GroupedList';
import { ConsentRow } from '../components/ui/ConsentRow';
import { ConfirmDialog } from '../components/ui/Overlays';
import { useFlag } from '../data/flags';
import { uploadAtlasHistory, withdrawAtlasHistory } from '../atlas/AtlasHistoryHost';
import { ConfirmEffectsDialog } from '../components/ui/ConfirmEffectsDialog';
import { Notice } from '../components/ui/Notice';
import { HealthWithdrawDialog } from './HealthWithdrawDialog';
import { openHealthPrompt } from '../data/healthConsentGate';
import { useHealthT } from '../i18n/healthConsent';
import { healthFeatureOf } from './healthFeatures';
import { AtlasConsentPrompt } from '../atlas/AtlasConsentPrompt';
import { AtlasWithdrawDialog } from '../atlas/AtlasWithdrawDialog';
import type { AiEngine } from '../atlas/aiConsent';
import { GEO_ENGINES, openGeoPrompt, setGeoOverride } from '../data/geoSearchGate';
import { currentUid } from '../api';
import { fmtShortDate, useT, type LocaleId } from '../i18n';
import type { Strings } from '../i18n/en';
import { currentVersion, isRequiredKind, type ConsentKind, type HealthFeature } from './consents';
import { markLocalOff } from './localOff';
import { sendConsentDurably } from './signupConsents';
import { grantConsent, useConsentRecords } from './consentApi';
import {
  HEALTH_KINDS,
  OUTSIDE_KINDS,
  requiredModel,
  rowModel,
  type RowModel,
  type RowStatus,
} from './consentsModel';

type Tone = 'accent' | 'chronic' | 'illness' | 'kcal' | 'atlas' | 'injury' | 'sleep';

const HEALTH_ICON: Record<HealthFeature, [string, Tone]> = {
  injuries: ['bandaids', 'injury'],
  chronic: ['heartbeat', 'chronic'],
  cycle: ['drop', 'injury'],
  nicotine: ['flame', 'illness'],
  alcohol: ['wine', 'kcal'],
  supplements: ['pill', 'accent'],
  nutrition: ['apple', 'kcal'],
};

function labelOf(t: Strings, kind: ConsentKind): string {
  if (kind === 'atlas-ai') return t.privAtlasLabel;
  if (kind === 'atlas-puter') return t.privPuterLabel;
  if (kind === 'geo-search') return t.privGeoLabel;
  if (kind === 'atlas-history') return t.privHistoryLabel;
  return t.privFeature[kind.slice('health:'.length) as HealthFeature];
}

function statusLine(t: Strings, s: RowStatus, locale: LocaleId): string {
  switch (s.state) {
    case 'loading':
      return t.privStatusLoading;
    case 'none':
      return t.privStatusNone;
    case 'given':
      return t.privStatusGiven(s.version, fmtShortDate(s.at, locale));
    case 'older':
      return t.privStatusOlder(s.version, fmtShortDate(s.at, locale));
  }
}

export interface ConsentsPageProps {
  /** The real account-delete flow. Absent = it does not exist yet: the prompt explains and its button stays disabled. */
  onDeleteAccount?: (copyFirst: boolean) => void;
}

type Ask =
  | { kind: 'off'; consent: ConsentKind }
  | { kind: 'required' }
  | { kind: 'health-off'; feature: HealthFeature }
  | { kind: 'atlas-on' | 'atlas-off'; engine: AiEngine }
  | { kind: 'history-on' }
  | { kind: 'history-off' }
  | null;

export function ConsentsPage({ onDeleteAccount }: ConsentsPageProps) {
  const { t, locale } = useT();
  const h = useHealthT();
  const { records, loading } = useConsentRecords();
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState<ConsentKind | null>(null);
  const [failed, setFailed] = useState(false);
  const [healthNote, setHealthNote] = useState<string | null>(null);
  const [copyFirst, setCopyFirst] = useState(false);
  const [eraseNow, setEraseNow] = useState(false);

  async function write(kind: ConsentKind, action: 'grant' | 'withdraw'): Promise<void> {
    setBusy(kind);
    setFailed(false);
    try {
      if (action === 'grant') {
        await grantConsent({ kind });
      } else {
        // Withdrawing stops the feature on this device first (kept across a reload), whatever the network does;
        // the record follows through the persisted queue.
        markLocalOff(currentUid(), kind);
        if (kind === 'geo-search') setGeoOverride(false);
        // The chat copy in the account goes with the consent; the chat on this device stays.
        if (kind === 'atlas-history') {
          // Stops syncing at once either way; the stored copy is deleted now (checkbox) or kept 30 days for undo.
          await withdrawAtlasHistory(eraseNow ? 'now' : 'keep').catch(() => setFailed(true));
        }
        const saved = await sendConsentDurably({
          kind,
          action: 'withdraw',
          version: currentVersion(kind),
          ...(kind === 'geo-search' && { engines: [...GEO_ENGINES] }),
        });
        if (!saved) setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  function toggle(kind: ConsentKind, on: boolean): void {
    if (kind === 'atlas-history') {
      setEraseNow(false);
      setAsk({ kind: on ? 'history-on' : 'history-off' });
      return;
    }
    if (kind === 'atlas-ai' || kind === 'atlas-puter') {
      setAsk({
        kind: on ? 'atlas-on' : 'atlas-off',
        engine: kind === 'atlas-ai' ? 'gemini' : 'puter',
      });
      return;
    }
    const hf = healthFeatureOf(kind);
    if (hf) {
      setHealthNote(null);
      if (on) openHealthPrompt(hf);
      else setAsk({ kind: 'health-off', feature: hf });
      return;
    }
    // Gym search turns on only through its own disclosure prompt (the host records the grant once accepted there).
    if (on && kind === 'geo-search') openGeoPrompt();
    else if (on) void write(kind, 'grant');
    else setAsk({ kind: 'off', consent: kind });
  }

  function row(kind: ConsentKind, icon: string, tone: Tone, sub: string, m: RowModel) {
    return (
      <ConsentRow
        key={kind}
        icon={icon}
        tone={tone}
        label={labelOf(t, kind)}
        sub={sub}
        status={statusLine(t, m.status, locale)}
        on={m.on}
        disabled={loading || busy === kind || (kind === 'atlas-puter' && !atlasOn)}
        onChange={(on) => toggle(kind, on)}
      />
    );
  }

  const historyFlag = useFlag('atlasHistory');
  const atlasOn = rowModel(records, 'atlas-ai', loading).on;
  const req = requiredModel(records, loading);
  const offBody = (kind: ConsentKind): string =>
    kind === 'atlas-ai'
      ? t.privOffAtlasBody
      : kind === 'atlas-puter'
        ? t.privOffPuterBody
        : kind === 'geo-search'
          ? t.privOffGeoBody
          : kind === 'atlas-history'
            ? t.privOffHistoryBody
            : t.privOffHealthBody;

  return (
    <>
      {failed && (
        <Notice tone="danger" icon="warning-circle">
          {t.privSaveError}
        </Notice>
      )}
      {healthNote && (
        <Notice tone="danger" icon="warning-circle">
          {healthNote}
        </Notice>
      )}
      <GroupedList header={t.privGrpRequired} footer={t.privRequiredFoot}>
        <ConsentRow
          icon="note"
          tone="accent"
          label={t.privRequiredLabel}
          sub={t.privRequiredSub}
          status={statusLine(t, req.status, locale)}
          on={req.on}
          disabled={loading || !req.on}
          onChange={() => setAsk({ kind: 'required' })}
        />
      </GroupedList>
      <GroupedList header={t.privGrpHealth} footer={t.privHealthFoot}>
        {HEALTH_KINDS.map((k) => {
          const [icon, tone] = HEALTH_ICON[k.slice('health:'.length) as HealthFeature];
          return row(k, icon, tone, t.privHealthSub, rowModel(records, k, loading));
        })}
      </GroupedList>
      <GroupedList header={t.privGrpOutside} footer={t.privOutsideFoot}>
        {OUTSIDE_KINDS.map((k) => {
          const m = rowModel(records, k, loading);
          if (k === 'atlas-ai') return row(k, 'sparkle', 'atlas', t.privAtlasSub, m);
          if (k === 'atlas-puter') return row(k, 'sparkle', 'atlas', t.privPuterSub, m);
          return row(k, 'map-pin', 'accent', t.privGeoSub, m);
        })}
        {(historyFlag || rowModel(records, 'atlas-history', loading).on) &&
          row(
            'atlas-history',
            'chats-circle',
            'atlas',
            t.privHistorySub,
            rowModel(records, 'atlas-history', loading),
          )}
      </GroupedList>

      {ask?.kind === 'history-on' && (
        <ConfirmDialog
          icon="chats-circle"
          title={t.histUploadTitle}
          body={t.histUploadBody}
          confirmLabel={t.histUploadYes}
          cancelLabel={t.histUploadNo}
          onCancel={() => {
            setAsk(null);
            void write('atlas-history', 'grant');
          }}
          onConfirm={() => {
            setAsk(null);
            void write('atlas-history', 'grant').then(() => uploadAtlasHistory());
          }}
        />
      )}
      {ask?.kind === 'history-off' && (
        <ConfirmEffectsDialog
          icon="power"
          title={t.privOffTitle(t.privHistoryLabel)}
          body={t.privOffHistoryBody}
          check={{ label: t.privOffHistoryCheck, checked: eraseNow, onChange: setEraseNow }}
          confirmLabel={t.privOffConfirm}
          cancelLabel={t.privOffKeep}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            void write('atlas-history', 'withdraw');
          }}
        />
      )}
      {ask?.kind === 'atlas-on' && (
        <AtlasConsentPrompt engine={ask.engine} onDone={() => setAsk(null)} />
      )}
      {ask?.kind === 'atlas-off' && (
        <AtlasWithdrawDialog
          engine={ask.engine}
          records={records}
          onDone={({ confirmed, ok }) => {
            setAsk(null);
            if (confirmed && !ok) setFailed(true);
          }}
        />
      )}
      {ask?.kind === 'health-off' && (
        <HealthWithdrawDialog
          feature={ask.feature}
          onDone={(r) => {
            setAsk(null);
            if (r.confirmed && !r.saved) setHealthNote(h.wFailed);
            else if (r.deleteFailed) setHealthNote(h.dFailed);
          }}
        />
      )}
      {ask?.kind === 'off' && !isRequiredKind(ask.consent) && (
        <ConfirmDialog
          icon="power"
          title={t.privOffTitle(labelOf(t, ask.consent))}
          body={offBody(ask.consent)}
          confirmLabel={t.privOffConfirm}
          cancelLabel={t.privOffKeep}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            const kind = ask.consent;
            setAsk(null);
            void write(kind, 'withdraw');
          }}
        />
      )}
      {ask?.kind === 'required' && (
        <ConfirmEffectsDialog
          icon="warning"
          title={t.privReqTitle}
          body={t.privReqBody}
          check={
            onDeleteAccount
              ? { label: t.privReqCheck, checked: copyFirst, onChange: setCopyFirst }
              : undefined
          }
          small={onDeleteAccount ? t.privReqFine : t.privReqUnavailable}
          smallIcon={false}
          confirmLabel={t.privReqConfirm}
          cancelLabel={t.privReqKeep}
          cancelVariant="secondary"
          confirmDisabled={!onDeleteAccount}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            onDeleteAccount?.(copyFirst);
          }}
        />
      )}
    </>
  );
}
