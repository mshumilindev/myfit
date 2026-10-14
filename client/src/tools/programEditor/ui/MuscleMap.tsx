import type { ProgramEditorHost, MuscleMapProps } from '../host';

/** The anatomy figure comes from the host (`slots.muscleMap`); without one the chip grid next to it is the picker. */
export function MuscleMap({ host, ...rest }: MuscleMapProps & { host: ProgramEditorHost }) {
  const Slot = host.slots?.muscleMap;
  return Slot ? <Slot {...rest} /> : null;
}
