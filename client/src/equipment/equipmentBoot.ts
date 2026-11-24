/**
 * Boot of the Equipment chunk: puts the inventory board and the equipment picker into the core's `equipmentHost` and announces it
 * is ready. Imported lazily (and only) by `addons/useAddonRuntime.ts` while the module is installed.
 */
import { BandLibraryCard } from '../components/BandLibraryCard';
import { EquipmentBoard } from '../components/EquipmentBoard';
import { EquipmentPickerSheet } from '../components/EquipmentPickerSheet';
import { equipmentHost } from '../equipmentApi';
import { provide, trackerReady } from '../trackerRt';

provide(equipmentHost, {
  Board: EquipmentBoard,
  PickerSheet: EquipmentPickerSheet,
  BandLibrary: BandLibraryCard,
});
trackerReady('equipment');
