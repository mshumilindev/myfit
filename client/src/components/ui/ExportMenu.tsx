import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../ui';
import { Button } from './Button';
import { ChoiceList } from './ChoiceList';
import { ResponsivePanel } from './ResponsivePanel';
import { Snackbar } from './Snackbar';
import './ExportMenu.css';

/** Every visible word, passed in so the kit stays language-agnostic. */
export interface ExportMenuStrings {
  button: string;
  title: string;
  asShown: (n: number) => string;
  view: string;
  viewHint: (n: number) => string;
  all: string;
  allHint: (n: number) => string;
  group: string;
  cols: (n: number, list: string) => string;
  leftOut: (list: string) => string;
  leftOutNone: string;
  cancel: string;
  submit: string;
  empty: string;
}

export interface ExportMenuProps {
  strings: ExportMenuStrings;
  /** Rows in the current view (filters and sort applied). */
  rows: number;
  /** Rows without filters; omit when there are no filters (then the choice is hidden). */
  allRows?: number;
  /** Localised column names that go into the file. */
  columns: readonly string[];
  /** Localised names of the columns left out because the client does not share them. */
  omitted?: readonly string[];
  /** Builds and downloads the file; returns the confirmation text ("Exported x.csv, 41 rows"). */
  onExport: (all: boolean) => string | void | Promise<string | void>;
  size?: 'sm' | 'md' | 'lg';
  /** Stories: render already open. */
  defaultOpen?: boolean;
  /** An extra choice shown above the column list (e.g. "One row per set"). The caller recomputes `rows` / `columns`. */
  extra?: ReactNode;
}

/**
 * "Export" button + panel (S-23 / S-24): popover on desktop, bottom sheet on a phone. States the rows, lists
 * the columns, says what was left out and why, then downloads. The privacy note is always present.
 */
export function ExportMenu({
  strings: s,
  rows,
  allRows,
  columns,
  omitted,
  onExport,
  size = 'md',
  defaultOpen = false,
  extra,
}: ExportMenuProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [pick, setPick] = useState<'view' | 'all'>('view');
  const [done, setDone] = useState<string | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const showAll = allRows != null && allRows !== rows;

  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setDone(null), 4000);
    return () => window.clearTimeout(id);
  }, [done]);

  const run = () => {
    setOpen(false);
    // may be async: a password prompt can sit in front of the download
    const out = onExport(showAll && pick === 'all');
    if (out && typeof out === 'object') void out.then((msg) => msg && setDone(msg));
    else if (out) setDone(out);
  };
  const n = showAll && pick === 'all' ? allRows : rows;

  return (
    <span ref={anchor} className="exm">
      <Button
        variant="secondary"
        size={size}
        icon="export"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {s.button}
      </Button>
      <ResponsivePanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        label={s.title}
        title={s.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {s.cancel}
            </Button>
            <Button variant="primary" icon="download-simple" disabled={n === 0} onClick={run}>
              {s.submit}
            </Button>
          </>
        }
      >
        {showAll ? (
          <ChoiceList
            label={s.group}
            value={pick}
            onChange={(id) => setPick(id === 'all' ? 'all' : 'view')}
            options={[
              { id: 'view', title: s.view, description: s.viewHint(rows) },
              { id: 'all', title: s.all, description: s.allHint(allRows) },
            ]}
          />
        ) : (
          <p className="exm-p">{n === 0 ? s.empty : s.asShown(n)}</p>
        )}
        {extra}
        <p className="exm-p">{s.cols(columns.length, columns.join(', '))}</p>
        <p className="exm-p exm-note">
          <Icon name="lock-simple" />
          <span>{omitted?.length ? s.leftOut(omitted.join(', ')) : s.leftOutNone}</span>
        </p>
      </ResponsivePanel>
      {done && <Snackbar text={done} icon="download-simple" />}
    </span>
  );
}
