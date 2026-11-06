/** Whether the device is online. Offline is a normal state in this app: the hook only reports it. */
import { useSyncExternalStore } from 'react';

function subscribe(fn: () => void): () => void {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => {
    window.removeEventListener('online', fn);
    window.removeEventListener('offline', fn);
  };
}
const read = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}
