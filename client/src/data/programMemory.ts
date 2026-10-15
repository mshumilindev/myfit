/**
 * The assigned program as known in this session (memory only, never written to disk here). The on-device copy is the
 * sealed offline snapshot (`offline/offlineCache`, key `programMine`); `programMine.ts` fills this from it and from the
 * network. A separate leaf module so `store.ts` can read it without importing the program data layer (which imports store).
 */
let current: unknown = null;

export function setProgramMemory(a: unknown): void {
  current = a;
}

export function readProgramMemory<T>(): T | null {
  return (current as T | null) ?? null;
}
