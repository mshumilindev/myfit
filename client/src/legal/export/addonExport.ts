/**
 * Add-ons add their own data to the export (Art. 15 / 20) without the core knowing their data. An add-on registers a reader
 * (decrypted on this device, from what it already holds); `buildTraining` appends what the readers return. An add-on whose code
 * is not loaded (not installed) still names itself here as "not included", never silently left out.
 */
import type { ExportFile, Missing } from './exportTypes';

export interface AddonExportPart {
  files: ExportFile[];
  missing: Missing[];
}
const sources = new Map<string, () => AddonExportPart>();

export function registerAddonExport(id: string, read: () => AddonExportPart): () => void {
  sources.set(id, read);
  return () => sources.delete(id);
}

export function addonExportParts(): AddonExportPart {
  const out: AddonExportPart = { files: [], missing: [] };
  for (const read of sources.values()) {
    const p = read();
    out.files.push(...p.files);
    out.missing.push(...p.missing);
  }
  return out;
}
