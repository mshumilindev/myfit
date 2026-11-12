import { configureAvailability } from '../availability';
import type { ClientAvailability } from '../../domain/availability';

const HOURS: [number, number][] = [
  [360, 480],
  [1020, 1230],
];
/** Story/demo availability: weekdays 06:00-08:00 and 17:00-20:30, the weekend open all morning, one day off ahead. */
export const storyAvailability = (todayKey: number): ClientAvailability => ({
  weekly: { 0: HOURS, 1: HOURS, 2: HOURS, 3: HOURS, 4: HOURS, 5: [[540, 780]], 6: [[540, 780]] },
  unavailable: [{ fromDay: todayKey + 3, toDay: todayKey + 4 }],
});

/** Installs the read for the story and returns nothing: call it from a story's `makePort`. */
export function shareAvailabilityInStory(todayKey: number): void {
  configureAvailability({
    read: async () => ({ state: 'shared', availability: storyAvailability(todayKey) }),
  });
}
export function noAvailabilityInStory(): void {
  configureAvailability(null);
}
