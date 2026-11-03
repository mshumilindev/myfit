import { useEffect, useRef } from 'react';
import './Call.css';

export interface CallVideoProps {
  /** The stream to show; `null` draws nothing useful (the tile shows the avatar instead). */
  stream: MediaStream | null;
  /** Your own preview: mirrored and always muted. */
  self?: boolean;
  label?: string;
}

/**
 * The live picture of a call (kit group `Call`): a `<video>` bound to a `MediaStream`. Put it in `CallTile video`. The
 * remote one plays its sound; your own is muted so you never hear yourself.
 */
export function CallVideo({ stream, self, label }: CallVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={ref}
      className={self ? 'uicall-video uicall-video--mirror' : 'uicall-video'}
      autoPlay
      playsInline
      muted={self}
      aria-label={label}
    />
  );
}
