import { WAVE_BARS, waveSteps } from './waveSteps';
import './Call.css';

export interface CallWaveProps {
  /**
   * The live voice level, 0..1. Given: the bars follow it like an equaliser (the host feeds it ~15 times a second from the
   * microphone / the remote stream). Omitted: the bars breathe on their own (still, under reduced motion).
   */
  level?: number;
  /** Any number that grows between frames; keeps the bars from moving in lockstep. */
  phase?: number;
  active?: boolean;
}

/** Voice bars for a voice-only call (kit group `Call`). */
export function CallWave({ level, phase = 0, active = true }: CallWaveProps) {
  const live = level != null;
  const steps = live ? waveSteps(level, phase) : null;
  return (
    <span
      className={[
        'uicall-wave',
        live ? 'uicall-wave--live' : '',
        !live && active ? 'uicall-wave--on' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {Array.from({ length: WAVE_BARS }, (_, i) => (
        <i
          key={i}
          className={`uicall-wave-b uicall-wave-b--${i + 1}`}
          data-step={steps ? steps[i] : undefined}
        />
      ))}
    </span>
  );
}
