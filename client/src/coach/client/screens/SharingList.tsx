import { Fragment, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { Hint } from '../../../components/ui/Hint';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';
import { OptionCard, OptionCardGrid } from '../../../components/ui/OptionCard';
import { Sheet } from '../../../components/ui/Overlays';
import { ToneText } from '../../../components/ui/ToneText';
import { useT } from '../../../i18n';
import { useClientT, type ClientStrings } from '../../../i18n/coachClient';
import { ClientAvatar } from '../../ClientAvatar';
import type { Level } from '../../domain/types';
import type { TrainerInfo } from '../data/types';
import { LEVEL_ICON } from '../domain';
import { levelWord, sinceDate } from '../labels';
import { shareRowMeta } from '../shareLabels';
import {
  SHARE_GROUPS,
  allowedLevels,
  buildSummary,
  isStaleGrant,
  sharedCountAll,
  sharesNothingAll,
  type ShareBlocks,
  type ShareGroupId,
  type ShareId,
  type ShareLevels,
} from '../shareModel';
import '../ClientCoach.css';

const tone = (l: Level) => (l === 'full' ? 'ok' : l === 'effects' ? 'rest' : undefined);

/** "A and B" in the locale's own list wording, the names emphasised. */
function Names({ names, locale }: { names: readonly string[]; locale: string }) {
  let parts: { type: string; value: string }[];
  try {
    parts = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).formatToParts([
      ...names,
    ]);
  } catch {
    parts = names.map((value) => ({ type: 'element', value }));
  }
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'element' ? (
          <ToneText key={i} tone="accent" strong>
            {p.value}
          </ToneText>
        ) : (
          <Fragment key={i}>{p.value}</Fragment>
        ),
      )}
    </>
  );
}

export interface SharingListProps {
  /** The linked trainer; null = no trainer (only the on-device settings are listed, no trainer block). */
  trainer: TrainerInfo | null;
  /** waiting: the trainer's app has not turned sharing on yet; revoked: the person stopped sharing. */
  linkState?: 'waiting' | 'active' | 'revoked';
  levels: ShareLevels;
  /** Settings that cannot be shared: their health feature is off (or its consent is not known yet). */
  blocks: ShareBlocks;
  onRow: (id: ShareId) => void;
  onOpenLog?: () => void;
  onOpenTrainer?: () => void;
  /** "Start sharing" (nothing shared yet) */
  onStart?: () => void;
  /** The red "Stop sharing" row; absent when there is nothing to stop. */
  onStop?: () => void;
}

/**
 * The ONE list of everything the person shares (SPO-107): one summary over all ten settings, the trainer row, ten rows in
 * three groups (each opens the level sheet), then Log and the red Stop sharing. Without a trainer only the on-device
 * settings are listed. Pure view: state and writes come from `TrainerSharing`.
 */
export function SharingList(p: SharingListProps) {
  const { cc, locale } = useClientT();
  const { t } = useT();
  const first = p.trainer ? p.trainer.name.split(' ')[0] : '';
  const waiting = p.linkState === 'waiting';
  const nothing = sharesNothingAll(p.levels, p.blocks);
  const sum = buildSummary(p.levels, p.blocks);
  const title = (id: ShareId) => shareRowMeta(id, cc, t).title;
  const status = waiting ? 'waiting' : nothing ? 'none' : 'active';
  const groupHead: Record<ShareGroupId, string> = {
    training: cc.shGroupTraining,
    body: cc.shGroupBody,
    life: cc.shGroupLife,
  };
  // without a trainer the six grant rows have no meaning: only the on-device ones stay
  const groups = SHARE_GROUPS.map((g) => ({
    ...g,
    ids: p.trainer ? g.ids : g.ids.filter((id) => LOCAL.has(id)),
  })).filter((g) => g.ids.length > 0);

  return (
    <>
      <Card emphasis="glass" pad="md" aria-live="polite">
        <div className="ul-flex ua-start ug-12">
          <IconTile tone="accent" size={30} icon="eye" />
          <div className="ul-flex ul-col ug-8 uf-1">
            <span className="ut-sm ut-muted">
              {!p.trainer ? t.nicPrivSeeHead : waiting ? cc.shSeesWaiting(first) : cc.shSees(first)}
            </span>
            {nothing ? (
              <span className="ut-w6">{p.trainer ? cc.shNothing(first) : t.hlPrivSumNone}</span>
            ) : (
              <>
                {sum.effects.length > 0 && (
                  <span className="ut-w6">
                    {cc.shEffectsOnly} <Names names={sum.effects.map(title)} locale={locale} />.
                  </span>
                )}
                {sum.full.length > 0 && (
                  <span className="ut-w6">
                    {cc.shFullLabel} <Names names={sum.full.map(title)} locale={locale} />.
                  </span>
                )}
                <span className="ut-sm ut-muted">{cc.shRest}</span>
              </>
            )}
          </div>
        </div>
      </Card>

      {p.trainer && (
        <GroupedList
          header={cc.shYourTrainer}
          footer={status === 'active' ? cc.shCaption(first) : undefined}
        >
          <ListRow
            icon={
              <ClientAvatar
                id={p.trainer.id}
                name={p.trainer.name}
                size={30}
                hasPhoto={p.trainer.hasPhoto}
              />
            }
            label={p.trainer.name}
            sub={
              status === 'active'
                ? `${cc.shSince(sinceDate(p.trainer.since, locale))} · ${cc.shOfTen(sharedCountAll(p.levels, p.blocks))}`
                : status === 'waiting'
                  ? cc.shWaitingSub(first)
                  : cc.shNoneSub
            }
            value={
              status === 'active'
                ? cc.shActive
                : status === 'waiting'
                  ? cc.shWaiting
                  : cc.shNotShared
            }
            valueTone={status === 'active' ? 'ok' : status === 'waiting' ? 'illness' : undefined}
            chevron={!!p.onOpenTrainer}
            onClick={p.onOpenTrainer}
          />
        </GroupedList>
      )}

      {p.trainer && waiting && (
        <Notice tone="illness" icon="hourglass" aligned>
          {cc.shWaitingNote(first)}
        </Notice>
      )}
      {p.trainer && nothing && !waiting && (
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
          {p.linkState === 'revoked' ? cc.shRevokedNote(first) : cc.shNoneNote(first)}
        </Notice>
      )}

      {groups.map((g) => (
        <GroupedList key={g.id} header={groupHead[g.id]}>
          {g.ids.map((id) => {
            const m = shareRowMeta(id, cc, t);
            const block = p.blocks[id] ?? null;
            const l = p.levels[id];
            // a grant still above Off while its feature has no consent is REAL on the server: say so, one tap switches it off
            const stale = isStaleGrant(id, p.levels, p.blocks);
            const value = stale
              ? cc.shSharedFeatureOff
              : block === 'off'
                ? cc.shFeatureOff
                : block
                  ? ''
                  : levelWord(cc, l);
            return (
              <ListRow
                key={id}
                icon={<IconTile tone={m.tone} size={30} icon={m.icon} />}
                label={m.title}
                sub={
                  stale
                    ? cc.shSharedFeatureOffSub
                    : block === 'off'
                      ? cc.shFeatureOffSub
                      : block
                        ? cc.ccLoading
                        : m.sees[l]
                }
                value={value}
                valueTone={stale ? 'illness' : block ? undefined : tone(l)}
                chevron={block !== 'pending'}
                disabled={block === 'pending'}
                aria-label={`${m.title}, ${value || cc.ccLoading}`}
                onClick={() => p.onRow(id)}
              />
            );
          })}
        </GroupedList>
      ))}

      {p.trainer && (p.onOpenLog || p.onStop) && (
        <GroupedList header={cc.shMore}>
          {p.onOpenLog && (
            <ListRow
              icon={<IconTile tone="people" size={30} icon="clock-counter-clockwise" />}
              label={cc.shLog}
              sub={cc.shLogSub(first)}
              chevron
              onClick={p.onOpenLog}
            />
          )}
          {p.onStop && <ListRow action tone="danger" label={cc.shStop(first)} onClick={p.onStop} />}
        </GroupedList>
      )}
    </>
  );
}

const LOCAL = new Set<ShareId>(['conditions', 'nicotine', 'alcohol', 'supplements']);

/** The level sheet: option cards for the levels the setting offers (two for Alcohol, with the reason), applies right away. */
export function LevelSheet(p: {
  cc: ClientStrings;
  /** trainer's first name; empty without a trainer */
  first: string;
  id: ShareId;
  level: Level;
  onPick: (l: Level) => void;
  onClose: () => void;
  /** extra content under the cards (the supplements preview) */
  children?: ReactNode;
}) {
  const { cc } = p;
  const { t } = useT();
  const m = shareRowMeta(p.id, cc, t);
  const levels = allowedLevels(p.id);
  return (
    <Sheet onClose={p.onClose} label={m.title} padded>
      <div className="cc-stack">
        <div className="ul-flex ua-center ug-12">
          <IconTile tone={m.tone} size={40} icon={m.icon} />
          <div className="ul-flex ul-col uf-1">
            <span className="ut-lg ut-w7">{m.title}</span>
            <span className="ut-sm ut-muted">
              {p.first ? cc.lvSheetSees(p.first) : t.nicPrivSeeHead}
            </span>
          </div>
        </div>
        <OptionCardGrid label={cc.lvSheetLabel} columns={1}>
          {levels.map((l) => (
            <OptionCard
              key={l}
              icon={<IconTile tone={m.tone} size={30} icon={LEVEL_ICON[l]} />}
              title={levelWord(cc, l)}
              sub={m.sees[l] ?? ''}
              selected={p.level === l}
              onSelect={() => p.onPick(l)}
            />
          ))}
        </OptionCardGrid>
        {levels.length < 3 && <Hint>{cc.shFullNotOffered(m.title)}</Hint>}
        {p.children}
        <Button variant="primary" fullWidth onClick={p.onClose}>
          {cc.ccDone}
        </Button>
      </div>
    </Sheet>
  );
}
