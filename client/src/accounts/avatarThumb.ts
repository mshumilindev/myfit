/**
 * The landing shows remembered people before any session exists, and avatars in Storage need one.
 * So at a remembered sign-in the photo is downloaded once and kept as a small square JPEG (a data: URL, a few KB).
 */
import { getBlob, ref } from 'firebase/storage';
import { storage } from '../firebase';

const SIZE = 96;

export async function fetchAvatarThumb(uid: string): Promise<string | undefined> {
  try {
    const blob = await getBlob(ref(storage, `avatars/${uid}/photo`));
    const bmp = await createImageBitmap(blob);
    const side = Math.min(bmp.width, bmp.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
    bmp.close?.();
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return undefined; // no photo / offline: the landing shows initials
  }
}
