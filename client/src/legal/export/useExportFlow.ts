/** State of the data copy flow (SPO-295 N6): choose, step-up, build with per-part progress, ready. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { reauthFresh } from '../../coach/security/reauth';
import { downloadBlob } from './download';
import { EXPORT_CATEGORIES, type ExportCategory } from './exportModel';
import { readExportSources, type LiveInputs } from './readSources';
import { ExportAborted, runExport, type ExportResult } from './runExport';

export type PartState = 'waiting' | 'working' | 'done';
export type Stage = 'choose' | 'stepup' | 'running' | 'ready' | 'failed';

export interface ExportFlow {
  stage: Stage;
  selected: Record<ExportCategory, boolean>;
  toggle: (id: ExportCategory, on: boolean) => void;
  chosen: ExportCategory[];
  /** Per chosen part, while running. */
  parts: Partial<Record<ExportCategory, PartState>>;
  packing: boolean;
  result: ExportResult | null;
  /** Ask for the copy: the step-up first unless the password was confirmed a moment ago. */
  start: () => void;
  /** The step-up passed. */
  confirmed: () => void;
  cancel: () => void;
  download: () => void;
  reset: () => void;
}

const ALL = Object.fromEntries(EXPORT_CATEGORIES.map((c) => [c, true])) as Record<
  ExportCategory,
  boolean
>;

export function useExportFlow(live: LiveInputs): ExportFlow {
  const [stage, setStage] = useState<Stage>('choose');
  const [selected, setSelected] = useState(ALL);
  const [parts, setParts] = useState<Partial<Record<ExportCategory, PartState>>>({});
  const [packing, setPacking] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const abort = useRef<AbortController | null>(null);
  const chosen = EXPORT_CATEGORIES.filter((c) => selected[c]);

  useEffect(() => () => abort.current?.abort(), []);

  const run = useCallback(async (categories: ExportCategory[], inputs: LiveInputs) => {
    const ctl = new AbortController();
    abort.current = ctl;
    setParts(Object.fromEntries(categories.map((c) => [c, 'waiting'])));
    setPacking(false);
    setStage('running');
    try {
      const sources = await readExportSources(inputs);
      const r = await runExport({
        categories,
        sources,
        signal: ctl.signal,
        onProgress: (p) => {
          if (p.id === null) setPacking(true);
          else setParts((s) => ({ ...s, [p.id]: p.state }));
        },
      });
      if (ctl.signal.aborted) return;
      setResult(r);
      setStage('ready');
    } catch (e) {
      if (!(e instanceof ExportAborted)) setStage('failed');
    }
  }, []);

  return {
    stage,
    selected,
    toggle: (id, on) => setSelected((s) => ({ ...s, [id]: on })),
    chosen,
    parts,
    packing,
    result,
    start: () => {
      if (chosen.length === 0) return;
      if (reauthFresh()) void run(chosen, live);
      else setStage('stepup');
    },
    confirmed: () => void run(chosen, live),
    cancel: () => {
      abort.current?.abort();
      setStage('choose');
    },
    download: () => {
      if (result) downloadBlob(result.blob, result.filename);
    },
    reset: () => {
      setResult(null);
      setStage('choose');
    },
  };
}
