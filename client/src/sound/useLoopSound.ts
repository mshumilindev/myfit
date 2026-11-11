import { useEffect } from 'react';

/**
 * A ringtone in both formats: ogg/opus first, mp3 where ogg/opus is not supported. The files live in public/sounds and belong to
 * the add-ons that ring (sizeEntries.json assets): they are downloaded into the offline media pack when such an add-on is
 * installed, and are never part of the app shell.
 */
export interface RingSound {
  ogg: string;
  mp3: string;
}
const at = (f: string): string => `${import.meta.env.BASE_URL ?? '/'}sounds/${f}`;
export const PLAN_SOUND: RingSound = { ogg: at('spotter_plan.ogg'), mp3: at('spotter_plan.mp3') };
export const CALL_SOUND: RingSound = { ogg: at('spotter_call.ogg'), mp3: at('spotter_call.mp3') };

const pick = (s: RingSound): string => {
  const ogg = document.createElement('audio').canPlayType?.('audio/ogg; codecs="opus"');
  return ogg ? s.ogg : s.mp3;
};

/**
 * Plays a ringtone in a loop while `active`, and stops it the moment it is not (answered, declined, dismissed, snoozed, or dismissed on
 * another device). A browser that refuses autoplay stays silent until the first tap, then starts - never throws, never blocks the UI.
 */
export function useLoopSound(sound: RingSound | null, active: boolean): void {
  useEffect(() => {
    if (!active || !sound || typeof Audio === 'undefined') return;
    const src = pick(sound);
    let live = true;
    let audio: HTMLAudioElement | null = null;
    let blobUrl: string | null = null;
    let armed = false;
    const disarm = () => {
      armed = false;
      document.removeEventListener('pointerdown', start);
      document.removeEventListener('keydown', start);
    };
    const arm = () => {
      if (armed) return;
      armed = true;
      document.addEventListener('pointerdown', start, { once: true });
      document.addEventListener('keydown', start, { once: true });
    };
    function start() {
      if (!live || !audio) return;
      try {
        audio.loop = true;
        const p = audio.play();
        if (p) p.then(disarm).catch(arm);
        else disarm();
      } catch {
        /* no audio here - the vibration and the screen still ring */
      }
    }
    // Played from a Blob, not from the URL: the offline copy comes from the service worker's cache, and Safari refuses
    // media whose Range requests get a whole-file answer. Fall back to the plain URL when the fetch fails.
    void (async () => {
      let url = src;
      try {
        const r = await fetch(src);
        if (r.ok) {
          blobUrl = URL.createObjectURL(await r.blob());
          url = blobUrl;
        }
      } catch {
        /* offline and not downloaded yet: try the plain URL */
      }
      if (!live) return;
      audio = new Audio(url);
      start();
    })();
    return () => {
      live = false;
      disarm();
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [sound, active]);
}
