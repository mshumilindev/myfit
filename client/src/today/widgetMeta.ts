/** Light picker metadata of a Today widget; apart from `registry.tsx` so lazy files stay cycle-free. */
import type { Tone } from '../components/ui/tones';
import type { TodayStrings } from './strings';

export type WidgetGroup =
  | 'training'
  | 'plan'
  | 'strength'
  | 'muscles'
  | 'body'
  | 'cardio'
  | 'apex'
  | 'learn'
  | 'atlas'
  | 'discover'
  | 'fun'
  | 'calendar';

export interface WidgetMeta {
  id: string;
  group: WidgetGroup;
  icon: string;
  tone: Tone;
  /** Picker label. */
  name: (tw: TodayStrings) => string;
}
