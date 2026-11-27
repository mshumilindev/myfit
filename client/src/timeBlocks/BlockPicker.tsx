import { useMemo, useState } from 'react';
import { Chip, ChipGroup } from '../components/ui/Chip';
import { ListRow } from '../components/ui/GroupedList';
import { SearchField } from '../components/ui/SearchField';
import { Sheet, SheetPin } from '../components/ui/Overlays';
import { exerciseImage } from '../data/exercises';
import { useExerciseName, Icon } from '../ui';
import { useT } from '../i18n';
import { BLOCK_GROUPS, blockReadyList, type BlockGroup } from './blockCatalog';
import { useBlockStrings } from './BlockUi';
import { specTitle } from './specText';
import type { BlockSpec } from './model';
import './blocks.css';

/** The exercise picker of a time block: only moves that work in a timed block, filtered by how they are done; own moves by name. */
export function BlockPicker(p: {
  spec: BlockSpec;
  /** Names already in the block when the picker opens; it keeps its own count while open. */
  added: string[];
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const t = useBlockStrings();
  const { t: core } = useT();
  const exName = useExerciseName();
  const [q, setQ] = useState('');
  const [mine, setMine] = useState<string[]>(p.added);
  const pick = (name: string) => {
    setMine((m) => [...m, name]);
    p.onPick(name);
  };
  const [group, setGroup] = useState<BlockGroup | null>(null);
  const all = useMemo(() => blockReadyList(), []);
  const needle = q.trim().toLowerCase();
  const list = all.filter(
    (i) =>
      (!group || i.group === group) &&
      (!needle ||
        i.name.toLowerCase().includes(needle) ||
        exName(i.name).toLowerCase().includes(needle)),
  );
  const typed = q.trim();
  const own = typed && !all.some((i) => i.name.toLowerCase() === typed.toLowerCase());
  const has = (n: string) => mine.some((a) => a.toLowerCase() === n.toLowerCase());

  return (
    <Sheet onClose={p.onClose} className="tb-pick">
      <SheetPin>
        <div className="tb-pick-head">
          <div className="sheet-label">{t.addExercise}</div>
          <span className="tb-sub">{`${t.blockWord} · ${specTitle(p.spec)}`}</span>
        </div>
        <SearchField
          value={q}
          placeholder={core.pickSearch}
          aria-label={core.pickSearchShort}
          clearLabel={core.cancel}
          onChange={setQ}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && own) {
              pick(typed);
              setQ('');
            }
          }}
        />
      </SheetPin>
      <div className="xp-label">{t.blockReadyTitle}</div>
      <ChipGroup scroll>
        <Chip selected={group === null} onClick={() => setGroup(null)}>
          {t.catAll}
        </Chip>
        {BLOCK_GROUPS.map((g) => (
          <Chip key={g} selected={group === g} onClick={() => setGroup(g)}>
            {t.cats[g]}
          </Chip>
        ))}
      </ChipGroup>
      <div className="tb-pick-list">
        {list.map((i) => {
          const img = exerciseImage(i.name);
          const isAdded = has(i.name);
          return (
            <ListRow
              key={i.name}
              dense
              icon={
                img ? (
                  <img className="tb-mem-img" src={img} alt="" loading="lazy" />
                ) : (
                  <span className="tb-mem-img" aria-hidden="true">
                    <Icon name="barbell" />
                  </span>
                )
              }
              label={exName(i.name)}
              sub={[t.cats[i.group], i.muscle ? core.muscleGroups[i.muscle] : null]
                .filter(Boolean)
                .join(' · ')}
              trailing={isAdded ? <Chip tone="accent">{t.addedWord}</Chip> : <Icon name="plus" />}
              onClick={() => pick(i.name)}
            />
          );
        })}
        {own && (
          <ListRow
            dense
            icon={<Icon name="plus" />}
            label={t.addByName(typed)}
            onClick={() => {
              pick(typed);
              setQ('');
            }}
          />
        )}
      </div>
      <p className="tb-sub tb-pick-note">{t.blockReadyNote}</p>
    </Sheet>
  );
}
