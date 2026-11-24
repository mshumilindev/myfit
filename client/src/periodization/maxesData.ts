/**
 * Typed maxes, sealed (Periodization chunk). One document `meta/maxes`: the vault holds the exercise names and kilograms, only
 * the stamp is open. Pure of Firestore; `maxesSync.ts` moves the sealed document.
 */
import type { Vault } from '../autoVault';
import { prepareWrite, readDocs, vault } from '../vaultIO';

/** A max the person typed for one exercise. */
export interface MaxEntry {
  name: string;
  kg: number;
  at: number;
}

export interface MaxesDoc extends Record<string, unknown> {
  updatedAt: number;
  /** Keyed by the lower-cased exercise name. */
  maxes: Record<string, MaxEntry>;
}

export const EMPTY_MAXES: MaxesDoc = { updatedAt: 0, maxes: {} };
export const MAX_KG = 500;

export const maxKey = (name: string): string => name.trim().toLowerCase();

/** The document with a max set (kilograms clamped to a sane range), or the same document when the input is unusable. */
export function withMax(doc: MaxesDoc, name: string, kg: number, now: number): MaxesDoc {
  const n = name.trim().slice(0, 120);
  if (!n || !Number.isFinite(kg) || kg <= 0) return doc;
  const v = Math.min(MAX_KG, Math.round(kg * 10) / 10);
  return {
    ...doc,
    updatedAt: now,
    maxes: { ...doc.maxes, [maxKey(n)]: { name: n, kg: v, at: now } },
  };
}

/** The document without the typed max of an exercise (the estimate from history applies again). */
export function withoutMax(doc: MaxesDoc, name: string, now: number): MaxesDoc {
  const k = maxKey(name);
  if (!(k in doc.maxes)) return doc;
  const { [k]: _gone, ...rest } = doc.maxes;
  void _gone;
  return { ...doc, updatedAt: now, maxes: rest };
}

export async function sealMaxes(doc: MaxesDoc, now: number, v: Vault = vault) {
  return prepareWrite('maxes', { ...doc, updatedAt: now }, v);
}

export async function openMaxes(
  raw: Record<string, unknown>,
  v: Vault = vault,
): Promise<MaxesDoc | null> {
  const { items } = await readDocs<MaxesDoc>([raw], v);
  const got = items[0] ?? null;
  return got ? { ...EMPTY_MAXES, ...got, maxes: got.maxes ?? {} } : null;
}
