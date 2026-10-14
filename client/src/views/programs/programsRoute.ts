/**
 * Hash routes of the athlete app's program editor, under `programs`:
 *   #/programs/<programId>/edit   a saved program
 *   #/programs/new                a program that is not saved yet (a blank one, an import, a suggestion)
 * `#/programs/<programId>` (no `/edit`) is the same as `/edit`. Pure functions; the Coach app has its own under `#/c/programs/`.
 */
export type ProgramsRoute = { kind: 'new' } | { kind: 'edit'; id: string };

export const PROGRAM_NEW_HASH = '#/programs/new';

export const programEditHash = (id: string): string => `#/programs/${encodeURIComponent(id)}/edit`;

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The editor a hash asks for, or null for the programs list (`#/programs`) and any other hash. */
export function parseProgramsHash(hash: string): ProgramsRoute | null {
  const parts = hash.split('?')[0].replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] !== 'programs' || !parts[1]) return null;
  if (parts[1] === 'new') return { kind: 'new' };
  return { kind: 'edit', id: safeDecode(parts[1]) };
}

export const isProgramsEditorHash = (hash: string): boolean => parseProgramsHash(hash) !== null;

/** The canonical hash of a route (`#/programs/<id>` and `#/programs/new/edit` become the forms above). */
export const programsHash = (r: ProgramsRoute | null): string =>
  !r ? '#/programs' : r.kind === 'new' ? PROGRAM_NEW_HASH : programEditHash(r.id);
