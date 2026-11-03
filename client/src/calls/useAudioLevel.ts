import { useEffect, useState } from 'react';

/** RMS of a time-domain buffer centred on 128, scaled so normal speech reaches ~0.6 and shouting 1. Pure. */
export function rmsLevel(buf: ArrayLike<number>): number {
  if (!buf.length) return 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / buf.length) * 3);
}

/**
 * Live loudness 0..1 of a media stream, ~20 updates a second, for the call waveform (`CallWave level`).
 * Reads the audio only to measure it; nothing is recorded or kept.
 */
export function useAudioLevel(stream: MediaStream | null | undefined, active = true): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream || !active || stream.getAudioTracks().length === 0) return;
    const Ctx: typeof AudioContext | undefined =
      typeof AudioContext === 'undefined' ? undefined : AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // a context made outside a user gesture starts suspended and would read silence
    void ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const id = setInterval(() => {
      an.getByteTimeDomainData(buf);
      setLevel(rmsLevel(buf));
    }, 50);
    return () => {
      clearInterval(id);
      src.disconnect();
      void ctx.close().catch(() => {});
    };
  }, [stream, active]);
  const measuring = !!stream && active && stream.getAudioTracks().length > 0;
  return measuring ? level : 0;
}
