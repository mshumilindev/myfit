/**
 * Experiment: tint exercise photos by muscle group (chest coral, back blue,
 * legs green…), so a glance tells what a lift trains before the words do.
 *
 * Easy to roll back: set PHOTO_TINT to false (every tint rule in styles.css is
 * scoped to `.photo-tint`), or delete this file and its three imports. The
 * colours live in one place: the `.m-*` rules in styles.css.
 */
export const PHOTO_TINT = false;

/** Root class that switches the tint layers on. */
export const photoTintClass = PHOTO_TINT ? ' photo-tint' : '';

/** Muscle class for a photo's container (`m-chest`, `m-lats`…); none for
 *  warm-up / cool-down / cardio photos. */
export function muscleTintClass(muscle: string | null | undefined): string {
  return muscle ? ` m-${muscle}` : '';
}
