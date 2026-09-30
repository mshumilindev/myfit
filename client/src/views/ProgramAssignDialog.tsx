/** Assign a program to members (PG-03): searchable multi-select, start point, replace warning. */
import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { SearchField } from '../components/ui/SearchField';
import { Chip } from '../components/ui/Chip';
import { ListRow } from '../components/ui/GroupedList';
import { Sheet, Icon } from '../ui';
import { fmtWeekday, useT } from '../i18n';
import { Avatar } from '../components/Avatar';
import { Select } from '../components/ui/Select';

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
                <Chip key={c.id} selected icon="x" onClick={() => onToggle(c.id)}>
                  <Avatar userId={c.id} name={c.name} hasPhoto={false} size={20} />
                  {c.name}
                </Chip>
              ))}
            </div>
          )}
          <SearchField
            value={query}
            placeholder={t.assignSearchMembers}
            clearLabel={t.clearLabel}
            onChange={setQuery}
          />
          <div className="client-picks assign-client-list">
            {matches.map((c) => (
              <ListRow
                key={c.id}
                icon={<Avatar userId={c.id} name={c.name} hasPhoto={false} size={30} />}
                label={c.name}
                sub={t.assignClientHint}
                selected={selectedIds.includes(c.id)}
                check={selectedIds.includes(c.id)}
                onClick={() => onToggle(c.id)}
              />
            ))}
          </div>

          <Select
            className="assign-week"
            label={t.assignStartWeek}
            value={startWeek}
            onChange={(e) => setStartWeek(Number(e.target.value) || 1)}
          >
            {Array.from({ length: Math.max(1, weeks) }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {t.progWeekN(w)}
              </option>
            ))}
          </Select>

          <div className="assign-startpoint">{t.assignStartPoint(startWeek, weekday)}</div>
          <div className="assign-warn">
            <Icon name="warning-circle" />
            <span>{t.assignReplaceWarn}</span>
          </div>
        </div>
      )}

      <div className="sheet-actions assign-actions">
        <Button variant="secondary" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button variant="primary" disabled={busy || selectedIds.length === 0} onClick={confirm}>
          {busy ? t.saving : t.assignConfirmN(selectedIds.length)}
        </Button>
      </div>
    </Sheet>
  );
}
