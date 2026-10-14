import { useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Skeleton, SkeletonRows } from '../../components/ui/Skeleton';
import { StageBoard } from '../../components/ui/StageBoard';
import { ClientAvatar } from '../ClientAvatar';
import { useTodayT } from '../../i18n/coachToday';
import { type CoachWorldApi } from '../data/useCoachWorld';
import type { Option } from '../domain/diff';
import type { Signal } from '../domain/types';
import { SidePanel } from '../layout/SidePanel';
import type { CoachRoute } from '../routes';
import { SignalPreview } from './SignalPreview';
import { buildBoard, findSignal } from './model';

export function StageView({
  world,
  openKey,
  onOpenKey,
  onNavigate,
  onRecord,
  onOpenDecision,
  onMessage,
  desktop,
}: {
  world: NonNullable<CoachWorldApi['world']>;
  openKey: string | null;
  onOpenKey: (k: string | null) => void;
  onNavigate: (r: CoachRoute) => void;
  onRecord: (s: Signal, o: Option) => void;
  onOpenDecision: (s: Signal, optionId?: string) => void;
  onMessage: (clientId: string) => void;
  desktop: boolean;
}) {
  const { t, locale } = useTodayT();
  const board = useMemo(() => buildBoard(world, t, locale), [world, t, locale]);
  const drawerSignal = openKey ? (findSignal(world, openKey)?.signal ?? null) : null;
  const selId = drawerSignal ? `sig:${drawerSignal.key}` : null;
  return (
    <>
      <StageBoard
        stages={board.stages}
        selectedId={selId}
        accordion={!desktop}
        foldLabel={desktop ? t.stageFold : undefined}
        label={t.stageBoard}
        emptyText={t.stageEmpty}
        footer={board.summary}
        renderAvatar={(card, size) => (
          <ClientAvatar
            id={card.clientId}
            name={card.fullName}
            hasPhoto={card.hasPhoto}
            size={size}
          />
        )}
        onOpen={(id) => {
          const target = board.targets[id];
          if (target?.type === 'signal') onOpenKey(target.key);
          else onNavigate({ screen: 'decisions' });
        }}
      />
      <SidePanel
        open={!!drawerSignal}
        onClose={() => onOpenKey(null)}
        title={t.drawerTitle}
        closeLabel={t.close}
      >
        {drawerSignal && (
          <SignalPreview
            world={world}
            signal={drawerSignal}
            headingLevel={3}
            onRecord={onRecord}
            onOpenDecision={onOpenDecision}
            onMessage={onMessage}
          />
        )}
      </SidePanel>
    </>
  );
}

export function TodayLoading({ desktop }: { desktop: boolean }) {
  return (
    <div className="td-loading" aria-busy="true">
      <div className="td-loading-list">
        <SkeletonRows rows={7} label="…" />
      </div>
      {desktop && (
        <Card pad="lg" className="td-loading-detail">
          <Skeleton width="40%" height={20} />
          <Skeleton height={14} />
          <Skeleton width="80%" height={14} />
          <Skeleton width={180} height={44} round />
        </Card>
      )}
    </div>
  );
}
