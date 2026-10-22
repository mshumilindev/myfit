import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { GroupedList } from '../../../components/ui/GroupedList';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { Snackbar } from '../../../components/ui/Snackbar';
import { StepConfirmDialog } from '../../../components/ui/StepConfirmDialog';
import { UndoToast } from '../../../components/ui/UndoToast';
import { healthSnapshot, openHealthPrompt, subscribeHealth } from '../../../data/healthConsentGate';
import { useChatT } from '../../../i18n/coachChat';
import { useClientT } from '../../../i18n/coachClient';
import { currentUid } from '../../../api';
import {
  forgetShareLevel,
  whenCoachSharePublished,
  setAlcoholSharing,
  setConditionsShare,
  setNicotineSharing,
  setSupplementSharing,
  useAlcohol,
  useNicotine,
  useStore,
  useSupplements,
} from '../../../store';
import { SupplementCoachPreview } from '../../../views/health/supplements/SupplementCoachPreview';
import { firstName } from '../../screens/format';
import type { Level } from '../../domain/types';
import type { ClientCoachPort } from '../data/port';
import { REVOKE_UNDO_MS } from '../data/store';
import { useClientCoach, useClientCoachEnabled } from '../data/useClientCoach';
import {
  FEATURE_OF,
  SHARE_IDS,
  clampLevel,
  isLocalCategory,
  isStaleGrant,
  rowBlock,
  sharedCountAll,
  sharesNothingAll,
  type LocalCategory,
  type ShareBlocks,
  type ShareId,
  type ShareLevels,
} from '../shareModel';
import { restoreLocals, stopAllSharing, type LocalLevels } from '../stopSharing';
import { rememberStop, takePendingStop, type PendingLocals } from '../stopUndo';
import { LevelSheet, SharingList } from './SharingList';
import '../ClientCoach.css';

export interface TrainerSharingProps {
  port?: ClientCoachPort;
  /** Stories: skip the flag gate. */
  force?: boolean;
  /** Stories: open the level sheet / stop dialog at mount. */
  initial?: { sheet?: ShareId; revoke?: boolean };
  onOpenLog?: () => void;
  onOpenTrainer?: () => void;
  /** "Start sharing" (state none): open the presets (the invite step 2 look) */
  onStart?: () => void;
}

/** Writes of the four on-device levels (they republish what a coach sees by themselves). */
const writeLocal = (id: LocalCategory, l: Level): void => {
  if (id === 'conditions') setConditionsShare(l);
  else if (id === 'nicotine') setNicotineSharing(l);
  else if (id === 'alcohol') setAlcoholSharing(clampLevel('alcohol', l) as 'off' | 'effects');
  else setSupplementSharing(l);
};

/**
 * Everything the person shares, in one list (S-29 .. S-34, SPO-107): the trainer's six grants and the four on-device
 * settings, one summary, one Stop sharing. The list of the on-device settings is always there (also without the coach
 * feature or a trainer); the trainer block and the grant rows need the flag and a link. A health setting whose feature has
 * no consent (SPO-290) reads "Feature is off" and opens the consent prompt instead of the level sheet.
 */
export function TrainerSharing(p: TrainerSharingProps) {
  const flag = useClientCoachEnabled();
  const on = p.force || flag;
  const { cc } = useClientT();
  const { ch } = useChatT();
  const { snapshot, status, failure, undo, store } = useClientCoach(p.port, on);
  const [sheet, setSheet] = useState<ShareId | null>(p.initial?.sheet ?? null);
  const [confirm, setConfirm] = useState(p.initial?.revoke ?? false);
  const health = useSyncExternalStore(subscribeHealth, healthSnapshot);
  const { conditionsShare } = useStore();
  const nic = useNicotine().settings.sharing;
  const alc = useAlcohol().settings.sharing;
  const sup = useSupplements().settings.sharing;

  const link = on ? snapshot?.link : undefined;
  const trainer = link && link.state !== 'none' ? link.trainer : null;
  const locals: LocalLevels = {
    conditions: conditionsShare,
    nicotine: nic,
    alcohol: clampLevel('alcohol', alc),
    supplements: sup,
  };
  const levels = Object.fromEntries(
    SHARE_IDS.map((id) => [
      id,
      isLocalCategory(id) ? locals[id] : trainer && link ? link.grants[id] : ('off' as Level),
    ]),
  ) as ShareLevels;
  const blocks: ShareBlocks = {};
  for (const id of SHARE_IDS) {
    if (!FEATURE_OF[id]) continue;
    // without a trainer the grant rows are not listed at all; the on-device ones always are
    blocks[id] = rowBlock(id, health.on, health.ready);
  }

  // A grant above Off whose feature has no consent is switched off by itself (fail to the private side): once per
  // level, so a failing write does not loop. Until it lands the row says "shared, feature off" with a one-tap switch.
  // what Stop turned off on this device, kept for the Retry of a failed revoke (the levels are already Off by then)
  const stopped = useRef<PendingLocals>({});
  const reconciled = useRef(new Map<ShareId, Level>());
  useEffect(() => {
    if (!trainer || !health.ready) return;
    for (const id of SHARE_IDS) {
      if (!isStaleGrant(id, levels, blocks) || reconciled.current.get(id) === levels[id]) continue;
      reconciled.current.set(id, levels[id]);
      if (!isLocalCategory(id)) void store.setLevel(id, 'off');
    }
  });

  if (on && !snapshot && status !== 'error')
    return (
      <GroupedList header={cc.shYourTrainer}>
        <SkeletonRows rows={3} label={cc.ccLoading} />
      </GroupedList>
    );

  const first = trainer ? firstName(trainer.name) : '';
  const onRow = (id: ShareId) => {
    const f = FEATURE_OF[id];
    if (isStaleGrant(id, levels, blocks))
      void store.setLevel(id as Exclude<ShareId, LocalCategory>, 'off');
    else if (blocks[id] === 'off' && f) openHealthPrompt(f);
    else if (!blocks[id]) setSheet(id);
  };
  const pick = (id: ShareId, l: Level) => {
    if (isLocalCategory(id)) writeLocal(id, clampLevel(id, l));
    else void store.setLevel(id, l);
  };
  const stop = () => {
    setConfirm(false);
    // the pending Undo lives in a module store: it survives this screen unmounting inside the 8 s window
    void stopAllSharing({
      locals,
      forget: forgetShareLevel,
      revoke: store.revoke,
      settle: whenCoachSharePublished,
    }).then((r) => {
      stopped.current = r.previous;
      if (r.ok) rememberStop(currentUid() ?? '', r.previous, REVOKE_UNDO_MS);
    });
  };
  const retry = () => {
    const failed = failure;
    store.clearFailure();
    if (failed !== 'revoke') return;
    // the revoke is also queued durably (B4); Retry sends it again right now
    void store.revoke().then((ok) => {
      if (ok) rememberStop(currentUid() ?? '', stopped.current, REVOKE_UNDO_MS);
    });
  };
  const undoStop = () => {
    // only a setting whose consent is on NOW comes back; one switched off meanwhile stays off
    restoreLocals(takePendingStop(currentUid() ?? ''), writeLocal, (id) => {
      const f = FEATURE_OF[id];
      return !f || healthSnapshot().on[f];
    });
    void store.undoRevoke();
  };

  return (
    <>
      <SharingList
        trainer={trainer}
        linkState={link && link.state !== 'none' ? link.state : undefined}
        levels={levels}
        blocks={blocks}
        onRow={onRow}
        onOpenLog={trainer ? p.onOpenLog : undefined}
        onOpenTrainer={p.onOpenTrainer}
        onStart={p.onStart}
        onStop={trainer && !sharesNothingAll(levels, blocks) ? () => setConfirm(true) : undefined}
      />
      {sheet && (
        <LevelSheet
          cc={cc}
          first={first}
          id={sheet}
          level={levels[sheet]}
          onPick={(l) => pick(sheet, l)}
          onClose={() => setSheet(null)}
        >
          {sheet === 'supplements' && levels.supplements !== 'off' && <SupplementCoachPreview />}
        </LevelSheet>
      )}
      {confirm && (
        <StepConfirmDialog
          steps={[
            {
              id: 'what',
              title: cc.shRevokeTitle(first),
              body: cc.shStop1Body(first),
              effects: [
                { icon: 'eye-slash', text: cc.shStopFx1(first) },
                { icon: 'chat-circle', text: cc.shStopFx2 },
                { icon: 'heartbeat', text: cc.shStopFx3 },
              ],
              confirmLabel: cc.shContinue,
              icon: 'eye-slash',
            },
            {
              id: 'confirm',
              title: cc.shStop2Title(first),
              body: cc.shStop2Body(sharedCountAll(levels, blocks)),
              confirmLabel: cc.shStopConfirm,
              icon: 'eye-slash',
            },
          ]}
          cancelLabel={cc.shKeep}
          progressLabel={cc.shStepOf}
          onCancel={() => setConfirm(false)}
          onConfirm={stop}
        />
      )}
      {undo && (
        <UndoToast
          key={undo.until}
          position="fixed"
          text={cc.shStopped}
          icon="eye-slash"
          undoLabel={cc.ccUndo}
          countdownLabel={ch.chUndoCountdown}
          durationMs={REVOKE_UNDO_MS}
          onUndo={undoStop}
        />
      )}
      {failure && (
        <Snackbar
          position="fixed"
          tone="danger"
          icon="warning-circle"
          text={cc.ccSaveFailed}
          action={{ label: cc.ccRetry, onClick: retry }}
        />
      )}
    </>
  );
}
