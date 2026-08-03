/** Two-stage CSV import for program authoring: map columns → validating preview (AC-CSV, PG-02). */
import { useMemo, useState } from 'react';
import { Sheet, Icon } from '../ui';
import { useT } from '../i18n';
import {
  parseCsv,
  detectColumns,
  buildRows,
  summarize,
  revalidate,
  rowsToItems,
  templateCsv,
  TEMPLATE_HEADERS,
  type CsvColumn,
  type CsvField,
  type ParsedRow,
  type ProgramItemLike,
} from '../data/programCsv';

const FIELD_ORDER: CsvField[] = [
  'ignore',
  'day',
  'name',
  'kind',
  'sets',
  'reps',
  'setsReps',
  'duration',
  'equipment',
  'weight',
];

export function ProgramCsvDialog({
  known,
  onClose,
  onImport,
}: {
  known: string[];
  onClose: () => void;
  onImport: (items: ProgramItemLike[]) => void;
}) {
  const { t } = useT();
  const [stage, setStage] = useState<'pick' | 'map' | 'preview'>('pick');
  const [grid, setGrid] = useState<string[][]>([]);
  const [columns, setColumns] = useState<CsvColumn[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [paste, setPaste] = useState('');
  const [error, setError] = useState(false);

  function ingest(text: string) {
    const g = parseCsv(text);
    if (g.length < 2) {
      setError(true);
      return;
    }
    setError(false);
    setGrid(g);
    setColumns(detectColumns(g[0]));
    setStage('map');
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) ingest(await file.text());
  }

  function setField(idx: number, field: CsvField) {
    setColumns((cs) => cs.map((c, i) => (i === idx ? { ...c, field } : c)));
  }

  function toPreview() {
    setRows(buildRows(grid, columns, known));
    setStage('preview');
  }

  function patchRow(index: number, patch: Partial<ParsedRow>) {
    setRows((rs) => rs.map((r) => (r.index === index ? revalidate({ ...r, ...patch }, known) : r)));
  }

  function downloadTemplate() {
    const blob = new Blob([templateCsv()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const shape = useMemo(() => summarize(rows, columns), [rows, columns]);

  return (
    <Sheet onClose={onClose} className="csv-sheet">
      <div className="sheet-head">
        <span className="t">{t.csvImport}</span>
      </div>

      {stage === 'pick' && (
        <div className="csv-pick">
          <p className="s">{t.csvColumns}</p>
          <label className="btn btn-secondary csv-file">
            <Icon name="list-plus" />
            {t.csvChooseFile}
            <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
          </label>
          <div className="field-label">{t.csvOrPaste}</div>
          <textarea
            className="input csv-paste"
            rows={5}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={TEMPLATE_HEADERS.join(',')}
          />
          {error && <div className="csv-problem">{t.csvNoRows}</div>}
          <div className="sheet-actions">
            <button className="link" onClick={downloadTemplate}>
              <Icon name="arrow-clockwise" />
              {t.csvTemplate}
            </button>
            <button
              className="btn btn-primary"
              disabled={!paste.trim()}
              onClick={() => ingest(paste)}
            >
              {t.csvContinue}
            </button>
          </div>
        </div>
      )}

      {stage === 'map' && (
        <div className="csv-map">
          <p className="s">{t.csvMapBody}</p>
          <div className="csv-map-grid">
            {columns.map((c, i) => (
              <div key={i} className="csv-map-row">
                <span className="csv-map-header">{c.header || `#${i + 1}`}</span>
                <select
                  className="input"
                  value={c.field}
                  onChange={(e) => setField(i, e.target.value as CsvField)}
                >
                  {FIELD_ORDER.map((f) => (
                    <option key={f} value={f}>
                      {t.csvFields[f]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="sheet-actions">
            <button className="btn btn-secondary" onClick={() => setStage('pick')}>
              {t.csvBack}
            </button>
            <button className="btn btn-primary" onClick={toPreview}>
              {t.csvContinue}
            </button>
          </div>
        </div>
      )}

      {stage === 'preview' && (
        <div className="csv-preview">
          <div className="csv-shape">
            <span className="n">{t.csvShape(shape.rows, shape.days)}</span>
            <span className="s">{t.csvValidCount(shape.valid, shape.problems)}</span>
          </div>
          {shape.discardedWeight && <div className="csv-note">{t.csvWeightDiscarded}</div>}
          <div className="csv-rows">
            {rows.map((r) => (
              <div key={r.index} className={`csv-row${r.problems.length ? ' problem' : ''}`}>
                <input
                  className="input csv-day"
                  type="number"
                  min={1}
                  max={7}
                  value={r.day}
                  aria-label={t.csvFields.day}
                  onChange={(e) => patchRow(r.index, { day: Number(e.target.value) || 0 })}
                />
                <input
                  className="input csv-name"
                  value={r.name}
                  aria-label={t.csvFields.name}
                  onChange={(e) => patchRow(r.index, { name: e.target.value })}
                />
                {r.kind === 'strength' ? (
                  <>
                    <input
                      className="input csv-num"
                      type="number"
                      min={1}
                      value={r.sets}
                      aria-label={t.csvFields.sets}
                      onChange={(e) => patchRow(r.index, { sets: Number(e.target.value) || 1 })}
                    />
                    <input
                      className="input csv-num"
                      type="number"
                      min={0}
                      value={r.reps}
                      aria-label={t.csvFields.reps}
                      onChange={(e) => patchRow(r.index, { reps: Number(e.target.value) || 0 })}
                    />
                  </>
                ) : (
                  <span className="csv-kind">{t.exerciseKindNames[r.kind]}</span>
                )}
                {r.problems.length > 0 && (
                  <div className="csv-reasons">
                    {r.problems.map((p) => (
                      <span key={p} className="csv-reason">
                        {t.csvProblems[p]}
                      </span>
                    ))}
                    {r.suggestion && (
                      <button
                        className="link"
                        onClick={() => patchRow(r.index, { name: r.suggestion ?? r.name })}
                      >
                        {t.csvUseSuggestion(r.suggestion)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="sheet-actions">
            <button className="btn btn-secondary" onClick={() => setStage('map')}>
              {t.csvBack}
            </button>
            <button
              className="btn btn-primary"
              disabled={rows.length === 0}
              onClick={() => {
                onImport(rowsToItems(rows));
                onClose();
              }}
            >
              {t.csvImportN(rowsToItems(rows).length)}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
