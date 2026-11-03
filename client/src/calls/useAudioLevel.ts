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

/** Fall of the held level per 50 ms sample: a short sound stays visible for about a third of a second. */
const HOLD_DECAY = 0.85;

/**
 * Live loudness 0..1 of a media stream, ~20 updates a second, for the call waveform (`CallWave level`).
 * Reads the audio only to measure it; nothing is recorded or kept.
 */
export function useAudioLevel(stream: MediaStream | null | undefined, active = true): number {
  const [level, setLevel] = useState(0);
  // The audio track of a remote stream can arrive after the stream object itself (ontrack): re-arm when it does.
  const audioTracks = stream?.getAudioTracks().length ?? 0;
  useEffect(() => {
    if (!stream || !active || audioTracks === 0) return;
    const Ctx: typeof AudioContext | undefined =
      typeof AudioContext === 'undefined' ? undefined : AudioContext;
    if (!Ctx) return;
    // Chromium feeds an analyser silence for a remote WebRTC stream until a media element consumes it too (crbug 933677).
    // A muted element here makes the meter independent of when the visible <audio> of the call mounts.
    const sink = document.createElement('audio');
    sink.muted = true;
    sink.srcObject = stream;
    try {
      void Promise.resolve(sink.play()).catch(() => {});
    } catch {
      // jsdom and some embedded webviews do not implement play(); the analyser still works there
    }
    const ctx = new Ctx();
    // a context made outside a user gesture starts suspended and would read silence
    void ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    let held = 0;
    const id = setInterval(() => {
      an.getByteTimeDomainData(buf);
      // peak hold with a gentle fall (like any level meter): a 5 ms window would otherwise miss short sounds
      held = Math.max(rmsLevel(buf), held * HOLD_DECAY);
      setLevel(held);
    }, 50);
    return () => {
      clearInterval(id);
      sink.srcObject = null;
      src.disconnect();
      void ctx.close().catch(() => {});
    };
  }, [stream, active, audioTracks]);
  const measuring = !!stream && active && stream.getAudioTracks().length > 0;
  return measuring ? level : 0;
}
