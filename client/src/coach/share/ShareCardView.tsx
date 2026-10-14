import { useMemo } from 'react';
import { AnatomyMap, type AnatomyLayer, type AnatomyView } from '../../components/ui/AnatomyMap';
import { ShareCard, ShareCardPhoto, type ShareCardProps } from '../../components/ui/ShareCard';
import { WidgetSpark } from '../../components/ui/Widget';
import { RouteMap } from '../../components/RouteMap';
import { NEUTRAL_GYM } from '../../components/GymThumb';
import { useShareT } from '../../i18n/coachShare';
import { useT } from '../../i18n';
import { chipsOf, factOf, reasonOf, rowMeta, subOf, titleOf, type Words } from './labels';
import type { ShareView } from './types';

/** MuscleGroup id -> anatomy layer + the side of the body it is seen from. */
const ANATOMY: Record<string, { layer: AnatomyLayer; view: AnatomyView }> = {
  chest: { layer: 'm_chest', view: 'front' },
  core: { layer: 'm_core', view: 'front' },
  shoulders: { layer: 'm_shoulder', view: 'front' },
  biceps: { layer: 'm_arm', view: 'front' },
  triceps: { layer: 'm_arm', view: 'back' },
  quads: { layer: 'm_quads', view: 'front' },
  back: { layer: 'm_back', view: 'back' },
  lats: { layer: 'm_back', view: 'back' },
  traps: { layer: 'm_back', view: 'back' },
  lower_back: { layer: 'm_back', view: 'back' },
  hamstrings: { layer: 'm_hams', view: 'back' },
  glutes: { layer: 'm_glutes', view: 'back' },
  calves: { layer: 'm_calves', view: 'back' },
  forearms: { layer: 'm_forearm', view: 'front' },
};

export function useWords(): Words {
  const { sh, locale } = useShareT();
  const { t } = useT();
  return useMemo(() => ({ sh, t, locale }), [sh, t, locale]);
}

function Media({ w, v }: { w: Words; v: ShareView }) {
  if (v.kind === 'muscle') {
    const a = v.muscle ? ANATOMY[v.muscle] : undefined;
    if (a)
      return (
        <ShareCardPhoto>
          <AnatomyMap
            base="muscles"
            view={a.view}
            focus="torso"
            marks={[{ layer: a.layer }]}
            label={w.sh.anatomyLabel(titleOf(w, v))}
          />
        </ShareCardPhoto>
      );
  }
  if (v.kind === 'gym') return <ShareCardPhoto src={v.image ?? NEUTRAL_GYM} />;
  if (v.image) return <ShareCardPhoto src={v.image} />;
  return <ShareCardPhoto icon={v.icon} />;
}

/** Everything the kit card needs for one resolved share, in the reader's language. */
export function shareCardProps(w: Words, v: ShareView, who?: string): ShareCardProps {
  const type = w.sh.kind[v.kind];
  const title = titleOf(w, v);
  const reason = reasonOf(w, v, who);
  const target = v.openTarget;
  const base: ShareCardProps = {
    state: v.state,
    typeIcon: v.icon,
    typeLabel: type,
    ariaLabel: '',
    density: 'bubble',
    loadingLabel: w.sh.loadingPreview,
  };
  if (v.state === 'loading') return { ...base, ariaLabel: w.sh.loadingPreview };
  if (v.state === 'locked' || v.state === 'removed') {
    return {
      ...base,
      title: v.state === 'removed' ? w.sh.removed[v.kind] : title,
      reason,
      deadTag: v.state === 'locked' ? w.sh.tagLocked : w.sh.tagRemoved,
      ariaLabel: w.sh.cardAriaDead(
        type,
        v.state === 'removed' ? w.sh.removed[v.kind] : title,
        reason ?? '',
      ),
    };
  }
  const open = w.sh.open[target.label];
  return {
    ...base,
    title,
    subtitle: subOf(w, v.sub),
    chips: chipsOf(w, v),
    tag:
      v.state === 'limited'
        ? { icon: 'lock-simple', label: w.sh.tagTotalsOnly }
        : v.withTrainer
          ? { icon: 'user-circle', label: w.sh.tagWithTrainer }
          : undefined,
    rows: v.rows?.map((r) => ({ name: r.name, image: r.image, meta: rowMeta(w, r) })),
    facts: v.facts.map((f) => factOf(w, f)),
    limitedText:
      v.state === 'limited' && v.limited
        ? v.kind === 'muscle'
          ? w.sh.limitedMuscle(v.who ?? who ?? w.sh.clientWord)
          : w.sh.limitedSets(v.who ?? who ?? w.sh.clientWord)
        : undefined,
    caption: v.updates ? w.sh.captionUpdates : undefined,
    openLabel: open,
    ariaLabel: w.sh.cardAria(type, title, open),
  };
}

export interface ShareCardViewProps {
  view: ShareView;
  /** Owner's first name for reasons when the view has none. */
  who?: string;
  onOpen?: (v: ShareView) => void;
  density?: 'bubble' | 'dock' | 'peek';
  className?: string;
}

/** The resolved view drawn as the kit card. Media (photo, anatomy, trend, route) is picked here, never in the chat. */
export function ShareCardView({ view: v, who, onOpen, density, className }: ShareCardViewProps) {
  const w = useWords();
  const p = shareCardProps(w, v, who);
  const live = v.state === 'ok' || v.state === 'limited';
  return (
    <ShareCard
      {...p}
      density={density}
      className={className}
      media={live ? <Media w={w} v={v} /> : undefined}
      trend={
        live && v.series && v.series.length > 1 ? (
          <span role="img" aria-label={w.sh.trendLabel(v.series.length)}>
            <WidgetSpark points={v.series} width={72} height={32} />
          </span>
        ) : undefined
      }
      extra={
        live && v.track && v.track.length > 1 ? (
          <RouteMap track={v.track} label={w.sh.routeTrace} />
        ) : undefined
      }
      onOpen={live && onOpen ? () => onOpen(v) : undefined}
    />
  );
}
