import { useEffect } from 'react';

/** A ringtone in both formats: ogg/opus first, mp3 where ogg/opus is not supported. Each add-on imports its own files (`?url`), so a sound ships only with its add-on. */
export interface RingSound {
  ogg: string;
  mp3: string;
}

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
    let audio: HTMLAudioElement | null = null;
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
      try {
        audio ??= new Audio(src);
        audio.loop = true;
        const p = audio.play();
        if (p) p.then(disarm).catch(arm);
        else disarm();
      } catch {
        /* no audio here - the vibration and the screen still ring */
      }
    }
    start();
    return () => {
      disarm();
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    };
  }, [sound, active]);
}
