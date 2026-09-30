/**
 * The app's ambient background: three soft glows that drift like a lava lamp.
 * At rest they sit exactly where the old static gradient's spots were, so with
 * animation off (slow device, reduced motion, Save-Data) the screen looks the
 * same as before. Motion is CSS-only (transform, GPU-composited) and is gated by
 * `html[data-motion]` — see motion.ts. Colours come from `--lava-*` (glass.css).
 */
export function LavaBackground() {
  return (
    <div className="lava" aria-hidden="true">
      <span className="lava-blob lava-c" />
      <span className="lava-blob lava-b" />
      <span className="lava-blob lava-a" />
    </div>
  );
}
