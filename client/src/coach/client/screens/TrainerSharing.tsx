import { Fragment, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';
import { OptionCard, OptionCardGrid } from '../../../components/ui/OptionCard';
import { ConfirmDialog, Sheet } from '../../../components/ui/Overlays';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { Snackbar } from '../../../components/ui/Snackbar';
import { ToneText } from '../../../components/ui/ToneText';
import { UndoToast } from '../../../components/ui/UndoToast';
import { useChatT } from '../../../i18n/coachChat';
import { useClientT, type ClientStrings } from '../../../i18n/coachClient';
import { ClientAvatar } from '../../ClientAvatar';
import { firstName } from '../../screens/format';
import type { Level } from '../../domain/types';
import { LEVELS } from '../../domain/types';
import type { ClientCoachPort } from '../data/port';
import { REVOKE_UNDO_MS } from '../data/store';
import { useClientCoach, useClientCoachEnabled } from '../data/useClientCoach';
import {
  CATEGORY_UI,
  LEVEL_ICON,
  SHARE_CATEGORIES,
  levelsBy,
  sharedCount,
  sharesNothing,
  type ShareCategory,
} from '../domain';
import { catTitle, levelWord, seesText, sinceDate } from '../labels';
import '../ClientCoach.css';

const tone = (l: Level) => (l === 'full' ? 'ok' : l === 'effects' ? 'rest' : undefined);

function Names({ names }: { names: readonly string[] }) {
  return (
    <>
      {names.map((n, i) => (
        <Fragment key={n}>
          {i > 0 && (i === names.length - 1 ? ' · ' : ', ')}
          <ToneText tone="accent" strong>
            {n}
          </ToneText>
        </Fragment>
      ))}
    </>
  );
}

export interface TrainerSharingProps {
  port?: ClientCoachPort;
  /** Stories: skip the flag gate. */
  force?: boolean;
  /** Stories: open the level sheet / revoke dialog at mount. */
  initial?: { sheet?: ShareCategory; revoke?: boolean };
  onOpenLog?: () => void;
  onOpenTrainer?: () => void;
  /** "Start sharing" (state none): open the presets (the invite step 2 look) */
  onStart?: () => void;
}

/**
 * "Your trainer" block at the top of Privacy and sharing (S-29, S-30, S-32, S-33, S-34): the summary, the trainer row, the
 * six settings (each opens the level sheet and applies at once), the access log row and the danger row. A fragment: it
 * lives inside the real `.hl-cnt` and the real categories below it stay unchanged. Without a trainer it renders nothing.
 */
export function TrainerSharing(p: TrainerSharingProps) {
  const flag = useClientCoachEnabled();
  const on = p.force || flag;
  const { cc, locale } = useClientT();
  const { ch } = useChatT();
  const { snapshot, status, failure, undo, store } = useClientCoach(p.port, on);
  const [sheet, setSheet] = useState<ShareCategory | null>(p.initial?.sheet ?? null);
  const [confirm, setConfirm] = useState(p.initial?.revoke ?? false);
  if (!on) return null;
  if (!snapshot)
    return status === 'error' ? null : (
      <GroupedList header={cc.shYourTrainer}>
        <SkeletonRows rows={3} label={cc.ccLoading} />
      </GroupedList>
    );
  const { link } = snapshot;
  const trainer = link.trainer;
  if (link.state === 'none' || !trainer) return null;
  const first = firstName(trainer.name);
  const g = link.grants;
  const waiting = link.state === 'waiting';
  const none = link.state === 'revoked' || sharesNothing(g);
  const eff = levelsBy(g, 'effects').map((k) => catTitle(cc, k));
  const full = levelsBy(g, 'full').map((k) => catTitle(cc, k));
  const status3 = waiting ? 'waiting' : none ? 'none' : 'active';

  return (
    <>
      <Card emphasis="glass" pad="md" aria-live="polite">
        <div className="ul-flex ua-start ug-12">
          <IconTile tone="accent" size={30} icon="eye" />
          <div className="ul-flex ul-col ug-8 uf-1">
            <span className="ut-sm ut-muted">
              {waiting ? cc.shSeesWaiting(first) : cc.shSees(first)}
            </span>
            {none ? (
              <span className="ut-w6">{cc.shNothing(first)}</span>
            ) : (
              <>
                {eff.length > 0 && (
                  <span className="ut-w6">
                    {cc.shEffectsOnly} <Names names={eff} />.
                  </span>
                )}
                {full.length > 0 && (
                  <span className="ut-w6">
                    {cc.shFullLabel} <Names names={full} />.
                  </span>
                )}
                <span className="ut-sm ut-muted">{cc.shRest}</span>
              </>
            )}
          </div>
        </div>
      </Card>

      <GroupedList
        header={cc.shYourTrainer}
        footer={status3 === 'active' ? cc.shCaption(first) : undefined}
      >
        <ListRow
          icon={
            <ClientAvatar
              id={trainer.id}
              name={trainer.name}
              size={30}
              hasPhoto={trainer.hasPhoto}
            />
          }
          label={trainer.name}
          sub={
            status3 === 'active'
              ? `${cc.shSince(sinceDate(trainer.since, locale))} · ${cc.shOfSix(sharedCount(g))}`
              : status3 === 'waiting'
                ? cc.shWaitingSub(first)
                : cc.shNoneSub
          }
          value={
            status3 === 'active'
              ? cc.shActive
              : status3 === 'waiting'
                ? cc.shWaiting
                : cc.shNotShared
          }
          valueTone={status3 === 'active' ? 'ok' : status3 === 'waiting' ? 'illness' : undefined}
          chevron={!!p.onOpenTrainer}
          onClick={p.onOpenTrainer}
        />
      </GroupedList>

      {waiting && (
        <Notice tone="illness" icon="hourglass" aligned>
          {cc.shWaitingNote(first)}
        </Notice>
      )}
      {none && !waiting && (
        <Notice
          tone="rest"
          icon="info"
          aligned
          below={
            p.onStart && (
              <Button variant="secondary" size="md" fullWidth onClick={p.onStart}>
                {cc.shStart}
              </Button>
            )
          }
        >
          {link.state === 'revoked' ? cc.shRevokedNote(first) : cc.shNoneNote(first)}
        </Notice>
      )}

      <GroupedList header={cc.shHead(first)} footer={cc.shFoot}>
        {SHARE_CATEGORIES.map((k) => (
          <ListRow
            key={k}
            icon={<IconTile tone={CATEGORY_UI[k].tone} size={30} icon={CATEGORY_UI[k].icon} />}
            label={catTitle(cc, k)}
            sub={seesText(cc, k, g[k])}
            value={levelWord(cc, g[k])}
            valueTone={tone(g[k])}
            chevron
            aria-label={`${catTitle(cc, k)}, ${levelWord(cc, g[k])}`}
            onClick={() => setSheet(k)}
          />
        ))}
      </GroupedList>

      <GroupedList>
        {p.onOpenLog && (
          <ListRow
            icon={<IconTile tone="people" size={30} icon="clock-counter-clockwise" />}
            label={cc.shLog}
            sub={cc.shLogSub(first)}
            chevron
            onClick={p.onOpenLog}
          />
        )}
        {!none && (
          <ListRow action tone="danger" label={cc.shStop(first)} onClick={() => setConfirm(true)} />
        )}
      </GroupedList>

      {sheet && (
        <LevelSheet
          cc={cc}
          first={first}
          cat={sheet}
          level={g[sheet]}
          onPick={(l) => void store.setLevel(sheet, l)}
          onClose={() => setSheet(null)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={cc.shRevokeTitle(first)}
          body={cc.shRevokeBody(first)}
          confirmLabel={cc.shStopConfirm}
          cancelLabel={cc.shKeep}
          danger
          icon="trash"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            void store.revoke();
          }}
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
          onUndo={() => void store.undoRevoke()}
        />
      )}
      {failure && (
        <Snackbar
          position="fixed"
          tone="danger"
          icon="warning-circle"
          text={cc.ccSaveFailed}
          action={{ label: cc.ccRetry, onClick: () => store.clearFailure() }}
        />
      )}
    </>
  );
}

/** S-32: three option cards, applies right away, Done only closes. */
export function LevelSheet(p: {
  cc: ClientStrings;
  first: string;
  cat: ShareCategory;
  level: Level;
  onPick: (l: Level) => void;
  onClose: () => void;
}) {
  const { cc } = p;
  const ui = CATEGORY_UI[p.cat];
  return (
    <Sheet onClose={p.onClose} label={catTitle(cc, p.cat)} padded>
      <div className="cc-stack">
        <div className="ul-flex ua-center ug-12">
          <IconTile tone={ui.tone} size={40} icon={ui.icon} />
          <div className="ul-flex ul-col uf-1">
            <span className="ut-lg ut-w7">{catTitle(cc, p.cat)}</span>
            <span className="ut-sm ut-muted">{cc.lvSheetSees(p.first)}</span>
          </div>
        </div>
        <OptionCardGrid label={cc.lvSheetLabel} columns={1}>
          {LEVELS.map((l) => (
            <OptionCard
              key={l}
              icon={<IconTile tone={ui.tone} size={30} icon={LEVEL_ICON[l]} />}
              title={levelWord(cc, l)}
              sub={seesText(cc, p.cat, l)}
              selected={p.level === l}
              onSelect={() => p.onPick(l)}
            />
          ))}
        </OptionCardGrid>
        <Button variant="primary" fullWidth onClick={p.onClose}>
          {cc.ccDone}
        </Button>
      </div>
    </Sheet>
  );
}
