/**
 * Health › Privacy and sharing: the one place for everything privacy in Health. A summary card
 * says in words what the coach would see (generated from the live state), one row per health
 * category opens a sheet to choose its coach sharing level (Off / Effects only / Full;
 * Alcohol has no Full), and the destructive "delete nicotine / alcohol / supplement data" rows sit behind a
 * danger confirm with the universal
 * encryption note as the group footer. Sharing applies at once (like the other settings
 * screens); the sheet only closes with Done. A new health category is one more entry in
 * `categories`. Kit primitives only.
 */
import { Fragment, useState, type ReactNode } from 'react';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { OptionCard, OptionCardGrid } from '../../components/ui/OptionCard';
import { ConfirmDialog, Sheet } from '../../components/ui/Overlays';
import { ToneText } from '../../components/ui/ToneText';
import type { Tone } from '../../components/ui/tones';
import { isFlagOn } from '../../data/flags';
import { useT } from '../../i18n';
import { FEATURE_ICON } from '../../coachEffectIcons';
import { SupplementCoachPreview } from './supplements/SupplementCoachPreview';
import {
  deleteAlcoholData,
  deleteNicotineData,
  deleteSupplementData,
  setAlcoholSharing,
  setConditionsShare,
  setNicotineSharing,
  setSupplementSharing,
  useAlcohol,
  useNicotine,
  useStore,
  useSupplements,
} from '../../store';

export interface HealthPrivacyViewProps {
  onBack: () => void;
}

type Level = 'off' | 'effects' | 'full';
const LEVELS: Level[] = ['off', 'effects', 'full'];
const LEVEL_ICON: Record<Level, string> = {
  off: 'eye-slash',
  effects: 'sliders-horizontal',
  full: 'eye',
};

interface Category {
  id: 'conditions' | 'nicotine' | 'alcohol' | 'supplements';
  title: string;
  icon: string;
  tone: Tone;
  level: Level;
  /** The levels this category offers (Alcohol never shares amounts: no Full). */
  levels: readonly Level[];
  set: (l: Level) => void;
  /** Plain-words example of what the coach sees at each level. */
  sees: Partial<Record<Level, string>>;
}

/** "A and B" in the locale's own list wording, the category names emphasised. */
function listNodes(names: string[], locale: string): ReactNode[] {
  let parts: { type: string; value: string }[];
  try {
    parts = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).formatToParts(
      names,
    );
  } catch {
    parts = names.map((value) => ({ type: 'element', value }));
  }
  return parts.map((p, i) =>
    p.type === 'element' ? (
      <ToneText key={i} tone="accent" strong>
        {p.value}
      </ToneText>
    ) : (
      <Fragment key={i}>{p.value}</Fragment>
    ),
  );
}

/** One summary sentence: "Training effects only: {list}." (the list is a placeholder in the string). */
function sentence(template: string, names: string[], locale: string): ReactNode {
  const [before, after = ''] = template.split('{list}');
  return (
    <>
      {before}
      {listNodes(names, locale)}
      {after}
    </>
  );
}

export function HealthPrivacyView({ onBack }: HealthPrivacyViewProps) {
  const { t, locale } = useT();
  const { conditionsShare } = useStore();
  const { settings } = useNicotine();
  const { settings: alcSettings } = useAlcohol();
  const { settings: supSettings } = useSupplements();
  const [confirm, setConfirm] = useState<'nicotine' | 'alcohol' | 'supplements' | null>(null);
  const [open, setOpen] = useState<Category['id'] | null>(null);

  const categories: Category[] = [
    ...(isFlagOn('conditions')
      ? [
          {
            id: 'conditions' as const,
            title: t.cndTitle,
            icon: FEATURE_ICON.conditions,
            tone: 'chronic' as Tone,
            level: conditionsShare,
            levels: LEVELS,
            set: setConditionsShare,
            sees: {
              off: t.cndShareHintOff,
              effects: t.cndShareHintEffects,
              full: t.cndShareHintFull,
            },
          },
        ]
      : []),
    {
      id: 'nicotine',
      title: t.nicTitle,
      icon: FEATURE_ICON.nicotine,
      tone: 'accent',
      level: settings.sharing,
      levels: LEVELS,
      set: setNicotineSharing,
      sees: { off: t.nicPrivSeeOff, effects: t.nicPrivSeeEffects, full: t.nicPrivSeeFull },
    },
    {
      id: 'alcohol',
      title: t.alcTitle,
      icon: FEATURE_ICON.alcohol,
      tone: 'accent',
      level: alcSettings.sharing,
      levels: ['off', 'effects'],
      set: (l) => setAlcoholSharing(l === 'full' ? 'effects' : l),
      sees: { off: t.nicPrivSeeOff, effects: t.alcPrivSeeEffects },
    },
    {
      id: 'supplements',
      title: t.supTitle,
      icon: FEATURE_ICON.supplements,
      tone: 'accent',
      level: supSettings.sharing,
      levels: LEVELS,
      set: setSupplementSharing,
      sees: { off: t.nicPrivSeeOff, effects: t.supPrivSeeEffects, full: t.supPrivSeeFull },
    },
  ];
  const label: Record<Level, string> = {
    off: t.nicPrivOff,
    effects: t.nicPrivEffects,
    full: t.nicPrivFull,
  };
  const names = (l: Level) => categories.filter((c) => c.level === l).map((c) => c.title);
  const effects = names('effects');
  const full = names('full');
  const shared = effects.length + full.length > 0;
  const current = categories.find((c) => c.id === open);

  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={onBack} />
        <h1 className="hl-pt">{t.hlPrivRow}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">
          <Card emphasis="glass" pad="md" aria-live="polite">
            <div className="ul-flex ua-start ug-12">
              <IconTile tone="accent" size={30} icon="eye" />
              <div className="ul-flex ul-col ug-8 uf-1">
                <span className="ut-sm ut-muted">{t.nicPrivSeeHead}</span>
                {shared ? (
                  <>
                    {effects.length > 0 && (
                      <span className="ut-w6">{sentence(t.hlPrivSumEffects, effects, locale)}</span>
                    )}
                    {full.length > 0 && (
                      <span className="ut-w6">{sentence(t.hlPrivSumFull, full, locale)}</span>
                    )}
                    <span className="ut-sm ut-muted">{t.hlPrivSumRest}</span>
                  </>
                ) : (
                  <span className="ut-w6">{t.hlPrivSumNone}</span>
                )}
              </div>
            </div>
          </Card>
          <GroupedList
            header={t.nicPrivShare}
            footer={categories.some((c) => c.id === 'conditions') ? t.hlPrivCondNote : undefined}
          >
            {categories.map((c) => (
              <ListRow
                key={c.id}
                icon={<IconTile tone={c.tone} size={30} icon={c.icon} />}
                label={c.title}
                value={label[c.level]}
                chevron
                onClick={() => setOpen(c.id)}
              />
            ))}
          </GroupedList>
          <GroupedList header={t.nicPrivData} footer={t.hlPrivNote}>
            <ListRow
              action
              tone="danger"
              label={t.nicPrivDelete}
              onClick={() => setConfirm('nicotine')}
            />
            <ListRow
              action
              tone="danger"
              label={t.alcPrivDelete}
              onClick={() => setConfirm('alcohol')}
            />
            <ListRow
              action
              tone="danger"
              label={t.supPrivDelete}
              onClick={() => setConfirm('supplements')}
            />
          </GroupedList>
        </div>
      </div>
      {current && (
        <Sheet onClose={() => setOpen(null)}>
          <div className="ul-flex ul-col ug-12">
            <div className="ul-flex ua-center ug-12">
              <IconTile tone={current.tone} size={40} icon={current.icon} />
              <div className="ul-flex ul-col uf-1">
                <span className="ut-lg ut-w7">{current.title}</span>
                <span className="ut-sm ut-muted">{t.nicPrivShare}</span>
              </div>
            </div>
            <OptionCardGrid label={t.nicPrivShare} columns={1}>
              {current.levels.map((l) => (
                <OptionCard
                  key={l}
                  icon={<IconTile tone={current.tone} size={30} icon={LEVEL_ICON[l]} />}
                  title={label[l]}
                  sub={current.sees[l]}
                  selected={current.level === l}
                  onSelect={() => current.set(l)}
                />
              ))}
            </OptionCardGrid>
            {current.id === 'supplements' && current.level !== 'off' && <SupplementCoachPreview />}
            <Button variant="primary" fullWidth onClick={() => setOpen(null)}>
              {t.done}
            </Button>
          </div>
        </Sheet>
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm === 'supplements'
              ? t.supPrivDeleteAsk
              : confirm === 'alcohol'
                ? t.alcPrivDeleteAsk
                : t.nicPrivDeleteAsk
          }
          body={
            confirm === 'supplements'
              ? t.supPrivDeleteBody
              : confirm === 'alcohol'
                ? t.alcPrivDeleteBody
                : t.nicPrivDeleteBody
          }
          confirmLabel={
            confirm === 'supplements'
              ? t.supPrivDelete
              : confirm === 'alcohol'
                ? t.alcPrivDelete
                : t.nicPrivDelete
          }
          cancelLabel={t.cancel}
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm === 'supplements') deleteSupplementData();
            else if (confirm === 'alcohol') deleteAlcoholData();
            else deleteNicotineData();
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}
