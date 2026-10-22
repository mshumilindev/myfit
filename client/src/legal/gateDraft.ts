/**
 * The legal page's unsent progress, kept on THIS device only so a reload does not make the person start over: which
 * documents were scrolled to the end and the two switches. Booleans and document ids only, no personal data, keyed by the
 * account id and by the document versions shown (a new version drops it). It is draft state, not consent: nothing is
 * recorded until Continue succeeds, and it is erased then and with the account.
 */
export interface GateDraft {
  opened: string[];
  age: boolean;
  agree: boolean;
}

const key = (uid: string) => `spotter.gateDraft.${uid}`;

export function loadGateDraft(uid: string, sig: string): GateDraft | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key(uid)) ?? 'null');
    if (!v || typeof v !== 'object') return null;
    const d = v as { sig?: unknown; opened?: unknown; age?: unknown; agree?: unknown };
    if (d.sig !== sig || !Array.isArray(d.opened)) return null;
    return {
      opened: d.opened.filter((x): x is string => typeof x === 'string'),
      age: d.age === true,
      agree: d.agree === true,
    };
  } catch {
    return null;
  }
}

export function saveGateDraft(uid: string, sig: string, d: GateDraft): void {
  try {
    localStorage.setItem(key(uid), JSON.stringify({ sig, ...d }));
  } catch {
    /* storage unavailable: the draft is just not kept */
  }
}

export function clearGateDraft(uid: string): void {
  try {
    localStorage.removeItem(key(uid));
  } catch {
    /* nothing kept */
  }
}
