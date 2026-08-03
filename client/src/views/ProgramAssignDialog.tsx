/** Assign a program to members (PG-03): searchable multi-select, start point, replace warning. */
import { useMemo, useState } from 'react';
import { Sheet, Icon } from '../ui';
import { fmtWeekday, useT } from '../i18n';
import { Avatar } from '../components/Avatar';

interface ClientOption {
  id: string;
  name: string;
}

export function ProgramAssignDialog({
  clients,
  programName,
  selectedIds,
  onToggle,
  weeks,
  onClose,
  onConfirm,
}: {
  clients: ClientOption[];
  programName: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
  weeks: number;
  onClose: () => void;
  onConfirm: (startWeek: number) => Promise<void>;
}) {
  const { t, locale } = useT();
  const [query, setQuery] = useState('');
  const [startWeek, setStartWeek] = useState(1);
  const [busy, setBusy] = useState(false);
  const [todayTs] = useState(() => Date.now());

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients),
    [clients, q],
  );
  const selected = clients.filter((c) => selectedIds.includes(c.id));
  const weekday = fmtWeekday(todayTs, locale);

  async function confirm() {
    if (selectedIds.length === 0) return;
    setBusy(true);
    try {
      await onConfirm(startWeek);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose} className="assign-sheet">
      <div className="sheet-head">
        <span className="t">{t.assignTitle(programName)}</span>
        <span className="m">{t.assignIntro}</span>
      </div>

      {clients.length === 0 ? (
        <div className="detail-muted">{t.progNoClients}</div>
      ) : (
        <div className="assign-body">
          {selected.length > 0 && (
            <div className="equipment-chips">
              {selected.map((c) => (
                <button
                  key={c.id}
                  className="equipment-chip assign-chip"
                  onClick={() => onToggle(c.id)}
                >
                  <Avatar userId={c.id} name={c.name} hasPhoto={false} size={20} />
                  {c.name}
                  <Icon name="x" />
                </button>
              ))}
            </div>
          )}
          <div className="searchbar">
            <Icon name="magnifying-glass" />
            <input
              value={query}
              placeholder={t.assignSearchMembers}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="client-picks assign-client-list">
            {matches.map((c) => (
              <button
                key={c.id}
                className={`client-pick assign-client-row${selectedIds.includes(c.id) ? ' selected' : ''}`}
                onClick={() => onToggle(c.id)}
              >
                <Avatar userId={c.id} name={c.name} hasPhoto={false} size={30} />
                <span className="assign-client-copy">
                  <span className="n">{c.name}</span>
                  <span className="s">{t.assignClientHint}</span>
                </span>
                <span className="assign-client-check" aria-hidden>
                  {selectedIds.includes(c.id) ? <Icon name="check-circle" weight="fill" /> : null}
                </span>
              </button>
            ))}
          </div>

          <label className="field-block assign-week">
            <span className="field-label">{t.assignStartWeek}</span>
            <select
              className="input"
              value={startWeek}
              onChange={(e) => setStartWeek(Number(e.target.value) || 1)}
            >
              {Array.from({ length: Math.max(1, weeks) }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  {t.progWeekN(w)}
                </option>
              ))}
            </select>
          </label>

          <div className="assign-startpoint">{t.assignStartPoint(startWeek, weekday)}</div>
          <div className="assign-warn">
            <Icon name="warning-circle" />
            <span>{t.assignReplaceWarn}</span>
          </div>
        </div>
      )}

      <div className="sheet-actions assign-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          {t.cancel}
        </button>
        <button
          className="btn btn-primary"
          disabled={busy || selectedIds.length === 0}
          onClick={confirm}
        >
          {busy ? t.saving : t.assignConfirmN(selectedIds.length)}
        </button>
      </div>
    </Sheet>
  );
}
