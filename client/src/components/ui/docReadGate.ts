import { useCallback, useMemo, useState } from 'react';

/** Which documents the person has opened in this visit: id -> true. */
export type DocOpened = Readonly<Record<string, boolean>>;

/** True when every required document has been opened (vacuously true for an empty list). */
export function allDocsOpened(ids: readonly string[], opened: DocOpened): boolean {
  return ids.every((id) => opened[id] === true);
}

/**
 * The read-and-accept rule shared by registration and the existing-user gate: Accept / Continue is enabled only when
 * every document was opened AND every box is ticked. The boxes themselves stay disabled until the documents are
 * opened (`acceptBoxesEnabled`), so the order is read first, then agree.
 */
export function canAccept(allOpened: boolean, boxes: readonly boolean[]): boolean {
  return allOpened && boxes.every(Boolean);
}

/** The 18+ and agree boxes unlock only after every document was opened. */
export function acceptBoxesEnabled(allOpened: boolean): boolean {
  return allOpened;
}

export interface DocReadGate {
  opened: DocOpened;
  /** Call when the document is shown (a click on its row is enough). Unknown ids are ignored. */
  markOpened: (id: string) => void;
  allOpened: boolean;
}

/** Which version of each document id the person is reading: opt-in key of the per-tab memory (`useDocReadGate`). */
export type DocVersions = Readonly<Record<string, string>>;

const storageKey = (id: string, versions: DocVersions): string =>
  `spotter.docRead.${id}@${versions[id] ?? ''}`;

function readStored(ids: readonly string[], versions: DocVersions): DocOpened {
  const out: Record<string, boolean> = {};
  try {
    for (const id of ids)
      if (sessionStorage.getItem(storageKey(id, versions)) === '1') out[id] = true;
  } catch {
    /* storage unavailable: start closed */
  }
  return out;
}

/** Forgets the "opened" marks of these documents (call when the consent is given: the next ask starts again). */
export function clearDocRead(ids: readonly string[], versions: DocVersions): void {
  try {
    for (const id of ids) sessionStorage.removeItem(storageKey(id, versions));
  } catch {
    /* storage unavailable: nothing was kept */
  }
}

/**
 * "Has the person opened each document?" Session state. With `versions` it is also kept per document+version in this
 * tab's `sessionStorage`, so a remount (a popup-blocked document opens in the same tab and the gate unmounts) keeps
 * what was already read; without it nothing is stored. The stored proof of consent is the consent record, not this.
 */
export function useDocReadGate(ids: readonly string[], versions?: DocVersions): DocReadGate {
  const [seen, setSeen] = useState<DocOpened>(() => (versions ? readStored(ids, versions) : {}));
  const key = ids.join('\u0000');
  const vkey = versions ? JSON.stringify(versions) : '';
  const markOpened = useCallback(
    (id: string) => {
      if (!key.split('\u0000').includes(id)) return;
      if (vkey) {
        try {
          sessionStorage.setItem(storageKey(id, JSON.parse(vkey) as DocVersions), '1');
        } catch {
          /* storage unavailable: kept in memory only */
        }
      }
      setSeen((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    },
    [key, vkey],
  );
  const opened = useMemo(
    () => Object.fromEntries(ids.map((id) => [id, seen[id] === true])),
    [ids, seen],
  );
  const allOpened = allDocsOpened(ids, opened);
  return { opened, markOpened, allOpened };
}
