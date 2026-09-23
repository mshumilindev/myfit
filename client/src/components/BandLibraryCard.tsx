import { useState } from 'react';
import { setGymBandLibrary, bandLibraryFor } from '../store';
import { BAND_HEX, BAND_COLORS, type BandRung, type BandColor } from '../loads';
import type { Gym } from '../types';
import { useT } from '../i18n';
import { Icon } from '../ui';

/**
 * Band library editor (Load-entry C-5): a colour → estimated-kg map, set once
 * per gym and reused by every band exercise there. Seeds from the gym's saved
 * library or the sensible defaults.
 */
export function BandLibraryCard({
  gym,
  seedDefaults,
  onSaved,
}: {
  gym: Gym;
  /** Start from the defaults the set editor shows when the gym has no library. */
  seedDefaults?: boolean;
  onSaved?: () => void;
}) {
  const { t } = useT();
  const [initial] = useState<BandRung[]>(() =>
    (seedDefaults ? bandLibraryFor(gym) : (gym.bandLibrary ?? [])).map((r) => ({ ...r })),
  );
  const [rungs, setRungs] = useState<BandRung[]>(() => initial.map((r) => ({ ...r })));
  const [saved, setSaved] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  // Compare with what's saved; in the session sheet an unsaved gym compares
  // with the defaults it was seeded from.
  const baseline = gym.bandLibrary?.length ? gym.bandLibrary : seedDefaults ? initial : [];
  const dirty = JSON.stringify(rungs) !== JSON.stringify(baseline);

  const setColor = (i: number, color: BandColor) => {
    setRungs((list) => list.map((x, xi) => (xi === i ? { ...x, color } : x)));
    setPick(null);
    setSaved(false);
  };
  const setKg = (i: number, kg: number) => {
    setRungs((list) => list.map((x, xi) => (xi === i ? { ...x, kg } : x)));
    setSaved(false);
  };
  const removeRow = (i: number) => {
    setRungs((list) => list.filter((_, xi) => xi !== i));
    setPick(null);
    setSaved(false);
  };
  const addRow = () => {
    setRungs((list) => {
      const used = new Set(list.map((r) => r.color));
      const nextColor = BAND_COLORS.find((c) => !used.has(c)) ?? 'yellow';
      return [...list, { color: nextColor, kg: 0 }];
    });
    setSaved(false);
  };

  return (
    <div className="detail-card band-lib-card">
      <div className="detail-card-head">
        <span className="label">
          <Icon name="scales" /> {t.bandLibTitle}
        </span>
      </div>
      <div className="detail-muted band-lib-hint">{t.bandLibHint}</div>
      <div className="band-lib-rows">
        {rungs.map((r, i) => (
          <div className="band-lib-row" key={i}>
            <div className="band-pick">
              <button
                type="button"
                className="band-dot-btn"
                aria-label={t.bandColor(r.color)}
                onClick={() => setPick((p) => (p === i ? null : i))}
              >
                <span className="band-dot" style={{ background: BAND_HEX[r.color] }} />
              </button>
              {pick === i && (
                <div className="band-swatches">
                  {BAND_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={`band-swatch${c === r.color ? ' on' : ''}`}
                      style={{ background: BAND_HEX[c] }}
                      aria-label={t.bandColor(c)}
                      title={t.bandColor(c)}
                      onClick={() => setColor(i, c)}
                    />
                  ))}
                </div>
              )}
            </div>
            <span className="band-lib-name">{t.bandColor(r.color)}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={r.kg}
              onChange={(e) => setKg(i, Math.max(0, Number(e.target.value) || 0))}
            />
            <span className="band-lib-unit">{t.kgCol.toLowerCase()}</span>
            <button
              type="button"
              className="band-remove"
              aria-label={t.delete}
              onClick={() => removeRow(i)}
            >
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
      <div className="band-lib-actions">
        <button type="button" className="btn btn-secondary band-add" onClick={addRow}>
          <Icon name="plus" /> {t.bandAdd}
        </button>
        <button
          className="btn btn-secondary band-lib-save"
          disabled={!dirty}
          onClick={() => {
            setGymBandLibrary(
              gym.id,
              [...rungs].sort((a, b) => a.kg - b.kg),
            );
            setSaved(true);
            onSaved?.();
          }}
        >
          <Icon name="check" />
          {saved && !dirty ? t.bandLibSaved : t.bandLibSave}
        </button>
      </div>
    </div>
  );
}
