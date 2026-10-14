import type { GymWeek } from '../hours';
import type { Gym } from '../types';

const weekdays = (open: number, close: number, wOpen: number, wClose: number): GymWeek =>
  Array.from({ length: 7 }, (_, i) => (i < 5 ? [[open, close]] : [[wOpen, wClose]]));
/**
 * The two gyms of the lab fixtures. They are what stories and tests offer (`register.ts`), and nothing else: Iron Yard
 * keeps ordinary hours, FitHub never closes (so the 24 h calendar can be seen).
 */
export const GYMS: readonly Gym[] = [
  { id: 'iron-yard', name: 'Iron Yard', short: 'Iron Yard', hours: weekdays(360, 1380, 480, 1200) },
  {
    id: 'fithub',
    name: 'FitHub Pozniaky',
    short: 'FitHub',
    hours: Array.from({ length: 7 }, () => [[0, 1440]]),
  },
];
