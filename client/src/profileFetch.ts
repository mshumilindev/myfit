/**
 * The one way to load a person's profile. Decrypts vault-sealed history on this device
 * when the viewer holds the athlete's grant; otherwise returns the server payload as is.
 */
import { callFn } from './api';
import { exerciseVolumeKg, workoutVolumeKg } from './store';
import { loadOwnCoachKey, vault } from './vaultIO';
import { openProfile } from './profileOpen';

export async function fetchProfile<T extends object>(id: string): Promise<T> {
  const data = await callFn<T>('profileUser', { id });
  try {
    return await openProfile(
      data,
      vault,
      { loadOwnCoachKey },
      { exerciseVolumeKg, workoutVolumeKg },
    );
  } catch {
    return data; // never let decryption break the page
  }
}
