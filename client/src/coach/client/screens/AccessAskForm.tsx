import { useState, useSyncExternalStore } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConsentLevelPicker, type ConsentLevelId } from '../../../components/ui/ConsentControls';
import { Notice } from '../../../components/ui/Notice';
import { Sheet } from '../../../components/ui/Overlays';
import { healthSnapshot, openHealthPrompt, subscribeHealth } from '../../../data/healthConsentGate';
import { useT } from '../../../i18n';
import { useClientT } from '../../../i18n/coachClient';
import { useAlcohol, useNicotine, useStore, useSupplements } from '../../../store';
import type { Level } from '../../domain/types';
import { resultOf, type AccessAsk, type AskResult } from '../../share/accessAsk';
import type { ClientCoachPort } from '../data/port';
import { useClientCoach } from '../data/useClientCoach';
import { levelWord } from '../labels';
import { shareRowMeta } from '../shareLabels';
import {
  FEATURE_OF,
  allowedLevels,
  clampLevel,
  isLocalCategory,
  rowBlock,
  type ShareId,
} from '../shareModel';
import { writeLocal } from './TrainerSharing';
import '../ClientCoach.css';

export interface AccessAskFormProps {
  /** The trainer's first name. */
  first: string;
  ask: AccessAsk;
  /** Called once the choices are applied; the caller sends the reply into the chat. */
  onDone: (result: AskResult) => void;
  onClose: () => void;
  port?: ClientCoachPort;
  /** Offline note (the choices are kept on the device and sent later). */
  offline?: boolean;
}

/**
 * The client's one-time form for an access request (SPO-99): every asked row starts at Off (nothing is pre-enabled), the
 * client picks a level per row, and Save applies them through the same writes as the sharing page. A row whose health
 * feature has no consent is blocked until the client gives it. The trainer only ever learns the neutral result.
 */
export function AccessAskForm(p: AccessAskFormProps) {
  const { cc } = useClientT();
  const { t } = useT();
  const { snapshot, store } = useClientCoach(p.port);
  const health = useSyncExternalStore(subscribeHealth, healthSnapshot);
  const { conditionsShare } = useStore();
  const nic = useNicotine().settings.sharing;
  const alc = useAlcohol().settings.sharing;
  const sup = useSupplements().settings.sharing;
  const link = snapshot?.link;
  const current = (id: ShareId): Level =>
    isLocalCategory(id)
      ? id === 'conditions'
        ? conditionsShare
        : id === 'nicotine'
          ? nic
          : id === 'alcohol'
            ? clampLevel('alcohol', alc)
            : sup
      : link && link.state !== 'none'
        ? link.grants[id]
        : 'off';
  const [draft, setDraft] = useState<Partial<Record<ShareId, Level>>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const blockOf = (id: ShareId) => rowBlock(id, health.on, health.ready);
  const level = (id: ShareId): Level => (blockOf(id) ? 'off' : (draft[id] ?? current(id)));
  const rows = p.ask.cats.map((id) => {
    const m = shareRowMeta(id, cc, t);
    const b = blockOf(id);
    return {
      id,
      label: m.title,
      what: b ? cc.rfNeedsConsent : m.sees[level(id)],
      value: level(id) as ConsentLevelId,
      highlight: true,
      levels: allowedLevels(id) as readonly ConsentLevelId[],
      blocked: !!b,
    };
  });
  const gated = p.ask.cats.filter((id) => blockOf(id) === 'off');
  const chosen = p.ask.cats.filter((id) => level(id) !== 'off').length;
  const save = async () => {
    setBusy(true);
    setFailed(false);
    const after: Partial<Record<ShareId, Level>> = {};
    let ok = true;
    for (const id of p.ask.cats) {
      // a row without its health consent is never touched (and never counts as allowed)
      if (blockOf(id)) {
        after[id] = 'off';
        continue;
      }
      const l = clampLevel(id, level(id));
      if (l === current(id)) {
        after[id] = l;
        continue;
      }
      let done = true;
      try {
        if (isLocalCategory(id)) writeLocal(id, l);
        else done = await store.setLevel(id, l);
      } catch {
        done = false;
      }
      after[id] = done ? l : current(id);
      ok = ok && done;
    }
    setBusy(false);
    // the trainer must never be told "allowed" for something that was not saved: stay open, let the client retry
    if (!ok) return setFailed(true);
    p.onDone(resultOf(p.ask.cats, after));
  };
  const title =
    p.ask.cats.length === 10 ? cc.rfTitleAll(p.first) : cc.rfTitle(p.first, p.ask.cats.length);
  return (
    <Sheet onClose={p.onClose} label={title} closeLabel={cc.ccBack} padded>
      <div className="cc-stack">
        <span className="ut-lg ut-w7">{title}</span>
        <p className="ut-sm ut-muted">{cc.rfLead}</p>
        {p.offline && (
          <Notice tone="neutral" icon="wifi-slash" below={cc.rfOfflineBody}>
            {cc.rfOfflineTitle}
          </Notice>
        )}
        {gated.length > 0 && (
          <Notice
            tone="illness"
            icon="heartbeat"
            below={cc.rfConsentBody}
            trail={
              <Button
                variant="link"
                inline
                size="sm"
                onClick={() => {
                  const f = FEATURE_OF[gated[0]];
                  if (f) openHealthPrompt(f);
                }}
              >
                {cc.rfReview}
              </Button>
            }
          >
            {cc.rfConsentTitle}
          </Notice>
        )}
        {failed && (
          <Notice tone="danger" icon="warning-circle">
            {cc.ccSaveFailed}
          </Notice>
        )}
        <ConsentLevelPicker
          rows={rows}
          legend={cc.rfLegendFor}
          levelLabels={{
            off: levelWord(cc, 'off'),
            effects: levelWord(cc, 'effects'),
            full: levelWord(cc, 'full'),
          }}
          disabled={busy}
          onChange={(id, l) => setDraft((d) => ({ ...d, [id]: l }))}
        />
        <Button variant="primary" fullWidth disabled={busy} onClick={() => void save()}>
          {chosen ? cc.rfSave(chosen) : cc.rfSaveNone}
        </Button>
        <Button variant="ghost" fullWidth disabled={busy} onClick={() => p.onDone('declined')}>
          {cc.rfNotNow}
        </Button>
        <p className="ut-sm ut-muted">{cc.rfFoot(p.first)}</p>
      </div>
    </Sheet>
  );
}
