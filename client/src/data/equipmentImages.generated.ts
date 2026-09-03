/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Populated by `scripts/fetch-equipment-images.mjs`, which pulls one
 * license-clean photo per equipment id from Wikimedia Commons (CC/PD),
 * saves it under `client/public/equipment/<id>.<ext>`, and records the
 * attribution here. Until that script is run on a network that can reach
 * Wikimedia Commons, this map is empty and no equipment images render.
 *
 * `thumbUrl` is a repo-local path (served from /equipment/...), so images
 * never hotlink Wikimedia and never rot. `pageUrl`/`author`/`license`
 * carry the attribution required by the image licence.
 */
import type { EquipmentImage } from './equipmentCatalog';

export const EQUIPMENT_IMAGES: Record<string, EquipmentImage> = {};
