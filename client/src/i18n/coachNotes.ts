/**
 * Notes dictionary (Coach, M5). Separate from `coach.ts` / `coachChat.ts` so parallel agents never collide.
 *
 *   const { nt } = useNotesT();   nt.nTitle('Oleh'), nt.nCount(3) ...
 */
import { useT, type LocaleId } from './index';
import { notesEn } from './coachNotes.en';
import { notesUk } from './coachNotes.uk';
import { notesPl } from './coachNotes.pl';
import { notesLt } from './coachNotes.lt';
import { notesEt } from './coachNotes.et';

export type NotesStrings = typeof notesEn;

export const NOTES_LOCALES: Record<LocaleId, NotesStrings> = {
  en: notesEn,
  uk: notesUk,
  pl: notesPl,
  lt: notesLt,
  et: notesEt,
};

export const notesStrings = (locale: LocaleId): NotesStrings => NOTES_LOCALES[locale];

export function useNotesT(): { nt: NotesStrings; locale: LocaleId } {
  const { locale } = useT();
  return { nt: NOTES_LOCALES[locale], locale };
}
