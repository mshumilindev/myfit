import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { NumberStepper } from '../components/ui/NumberStepper';
import { Segmented } from '../components/ui/Segmented';
import { SaveGuide, useSaveGuide } from '../components/ui/SaveGuide';
import { Sheet, SheetFoot, SheetPin } from '../components/ui/Overlays';
import { Icon } from '../ui';
import {
  BLOCK_FORMATS,
  validateSpec,
  type BlockFormat,
  type BlockMember,
  type BlockSpec,
} from './model';
import { specTitle } from './specText';
import { FMT_ICON, FormatTag, useBlockStrings } from './BlockUi';

const DEFAULTS: Record<BlockFormat, BlockSpec> = {
  amrap: { fmt: 'amrap', capSec: 720, targetRounds: 8 },
  emom: { fmt: 'emom', everySec: 60, rounds: 10 },
  fortime: { fmt: 'fortime', scheme: [21, 15, 9], capSec: 900 },
  intervals: { fmt: 'intervals', workSec: 40, restSec: 20, rounds: 8 },
};

const PRESETS: { id: string; label: string; spec: BlockSpec; members: BlockMember[] }[] = [
  {
    id: 'cindy',
    label: 'Cindy',
    spec: { fmt: 'amrap', capSec: 1200 },
    members: [
      { name: 'Pullups', reps: '5' },
      { name: 'Pushups', reps: '10' },
      { name: 'Bodyweight Squat', reps: '15' },
    ],
  },
  {
    id: 'fran',
    label: 'Fran',
    spec: { fmt: 'fortime', scheme: [21, 15, 9] },
    members: [
      { name: 'Kettlebell Thruster', reps: '21-15-9' },
      { name: 'Pullups', reps: '21-15-9' },
    ],
  },
  {
    id: 'emom10',
    label: 'EMOM 10',
    spec: { fmt: 'emom', everySec: 60, rounds: 10 },
    members: [
      { name: 'One-Arm Kettlebell Swings', reps: '12' },
      { name: 'Burpee', reps: '6' },
    ],
  },
  {
    id: 'tabata',
    label: 'Tabata',
    spec: { fmt: 'intervals', workSec: 20, restSec: 10, rounds: 8 },
    members: [{ name: 'Air Bike', reps: '20 s' }],
  },
];

export interface BlockBuilderProps {
  /** Editing: the block's current numbers and members. */
  initial?: { spec: BlockSpec; members: BlockMember[] };
  /** Members already chosen (e.g. the exercise this block started from). */
  startedFrom?: string;
  /** Members to begin with in a new block (the exercise it was started from). */
  startMembers?: BlockMember[];
  onSave: (spec: BlockSpec, members: BlockMember[]) => void;
  onClose: () => void;
  /** Open the exercise picker; it calls back with a name. */
  onPickExercise: (add: (name: string) => void) => void;
}

/** ONE drawer to make a block: format · classics · the numbers that format needs · exercises. Nothing is saved until Add block. */
export function BlockBuilder(p: BlockBuilderProps) {
  const t = useBlockStrings();
  const [spec, setSpec] = useState<BlockSpec>(p.initial?.spec ?? DEFAULTS.amrap);
  const [members, setMembers] = useState<BlockMember[]>(p.initial?.members ?? p.startMembers ?? []);
  const [preset, setPreset] = useState<string | null>(null);
  const guide = useSaveGuide([{ id: 'ex', label: t.needExercise, done: members.length > 0 }]);
  const num = (o: Partial<BlockSpec>) => setSpec((s) => ({ ...s, ...o }));
  const valid = validateSpec(spec);

  function setFmt(f: BlockFormat) {
    setPreset(null);
    setSpec(DEFAULTS[f]);
  }
  function applyPreset(id: string) {
    if (preset === id) {
      setPreset(null);
      return;
    }
    const pr = PRESETS.find((x) => x.id === id);
    if (!pr) return;
    setPreset(id);
    setSpec(pr.spec);
    setMembers(pr.members.map((m) => ({ ...m })));
  }

  return (
    <Sheet onClose={p.onClose} label={p.initial ? t.editBlock : t.newBlock} closeLabel={t.cancel}>
      <SheetPin>
        <div className="tb-bb-title">{p.initial ? t.editBlock : t.newBlock}</div>
      </SheetPin>
      <div className="tb-bb">
        <Segmented<BlockFormat>
          label={t.format}
          fill
          size="md"
          value={spec.fmt}
          onChange={setFmt}
          options={BLOCK_FORMATS.map((k) => ({ value: k, label: t.formats[k], compact: true }))}
        />
        <div className="tb-sub">{t.help[spec.fmt]}</div>
        {p.startedFrom && (
          <div className="tb-bb-from">
            <Icon name="arrow-right" />
            <span>{t.startedFrom(p.startedFrom)}</span>
          </div>
        )}
        {!p.initial && (
          <div className="tb-bb-sec">
            <div className="tb-sub">
              {t.classics} <span>{t.tapToClear}</span>
            </div>
            <div className="tb-bb-chips">
              {PRESETS.map((x) => (
                <Chip
                  key={x.id}
                  size="sm"
                  tone="neutral"
                  selected={preset === x.id}
                  onClick={() => applyPreset(x.id)}
                >
                  {x.label}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className="tb-fields">
          {spec.fmt === 'amrap' && (
            <>
              <NumberStepper
                label={t.capMin}
                value={Math.round((spec.capSec ?? 0) / 60)}
                min={1}
                onChange={(v) => num({ capSec: v * 60 })}
              />
              <NumberStepper
                label={t.targetRounds}
                value={spec.targetRounds ?? 0}
                onChange={(v) => num({ targetRounds: v || undefined })}
              />
            </>
          )}
          {spec.fmt === 'emom' && (
            <>
              <NumberStepper
                label={t.everySec}
                value={spec.everySec ?? 60}
                step={15}
                min={15}
                onChange={(v) => num({ everySec: v })}
              />
              <NumberStepper
                label={t.forMin}
                value={Math.round(((spec.everySec ?? 60) * (spec.rounds ?? 0)) / 60)}
                min={1}
                onChange={(v) =>
                  num({ rounds: Math.max(1, Math.round((v * 60) / (spec.everySec ?? 60))) })
                }
              />
            </>
          )}
          {spec.fmt === 'fortime' && (
            <>
              <NumberStepper
                label={t.rounds}
                value={spec.scheme?.length ?? 1}
                min={1}
                onChange={(v) =>
                  num({
                    scheme: Array.from(
                      { length: v },
                      (_, i) => spec.scheme?.[i] ?? spec.scheme?.[0] ?? 1,
                    ),
                  })
                }
              />
              <NumberStepper
                label={t.capMin}
                value={Math.round((spec.capSec ?? 0) / 60)}
                onChange={(v) => num({ capSec: v ? v * 60 : undefined })}
              />
            </>
          )}
          {spec.fmt === 'intervals' && (
            <>
              <NumberStepper
                label={t.workSec}
                value={spec.workSec ?? 0}
                step={5}
                min={5}
                onChange={(v) => num({ workSec: v })}
              />
              <NumberStepper
                label={t.restSec}
                value={spec.restSec ?? 0}
                step={5}
                onChange={(v) => num({ restSec: v })}
              />
              <NumberStepper
                label={t.rounds}
                value={spec.rounds ?? 0}
                min={1}
                onChange={(v) => num({ rounds: v })}
              />
            </>
          )}
        </div>
        <div {...guide.field('ex')}>
          <div className="tb-bb-sec">
            <div className="tb-bb-lab2">
              <span className="tb-t">{t.exercises}</span>
              <span className="tb-sub">
                {members.length ? t.nAdded(members.length) : t.noneYet}
              </span>
            </div>
            {members.length > 0 && (
              <ul className="tb-mems">
                {members.map((m, i) => (
                  <li key={`${m.name}-${i}`} className="tb-mem">
                    <span className="tb-mem-name">{m.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      shape="round"
                      icon="x"
                      aria-label={`${t.remove} ${m.name}`}
                      onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}
                    />
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="secondary"
              size="md"
              icon="plus"
              fullWidth
              onClick={() => p.onPickExercise((name) => setMembers((ms) => [...ms, { name }]))}
            >
              {t.addExercise}
            </Button>
          </div>
        </div>
      </div>
      <SheetFoot>
        <div className="tb-bb-foot">
          <div className="tb-bb-sum">
            <FormatTag fmt={spec.fmt} />
            <span className="tb-sub">{specTitle(spec)}</span>
          </div>
          <div className="tb-bb-btns">
            <Button variant="secondary" size="md" onClick={p.onClose}>
              {t.cancel}
            </Button>
            <SaveGuide
              guide={guide}
              label={p.initial ? t.saveBlock : t.addBlock}
              heading={t.stillNeeded}
              onSave={() => valid && p.onSave(spec, members)}
            />
          </div>
        </div>
      </SheetFoot>
    </Sheet>
  );
}
export { FMT_ICON };
