/**
 * Christmas Start button (SPO-393): a fir wreath with a gold-embossed plus, three berries that glow in the attention
 * state. Rendered inside the Start button only while the Christmas theme is active; the stylesheet shows it in the Gym
 * only (the other apps keep the round skin-coloured button). Still by default; the berry glow runs only in the
 * attention state (`.is-attention`) and never under reduced motion or at night.
 */
import { useTheme } from '../../themes/registry';
import './ChristmasWreath.css';

const SPARK = 'M0 -8L2 -2L8 0L2 2L0 8L-2 2L-8 0L-2 -2Z';
const ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" class="xw-art"><image class="xw-material" href="/christmas/wreath.webp" width="72" height="72"/><circle class="xw-bl" cx="60.1" cy="47.4" r="8"/><circle class="xw-bl xw-bl2" cx="13.9" cy="25.8" r="8"/><circle class="xw-bl xw-bl3" cx="43.6" cy="12" r="8"/>' +
  '<g class="xw-plus"><path class="xw-plus-halo" d="M36 22V50M22 36H50"/><path class="xw-plus-core" d="M36 22V50M22 36H50"/></g>' +
  [
    [6, 22],
    [66, 30],
    [60, 64],
    [12, 62],
    [38, 3],
  ]
    .map(
      ([x, y], i) =>
        `<path class="xw-sp xw-sp${i}" transform="translate(${x} ${y})" d="${SPARK}"/>`,
    )
    .join('') +
  '</svg>';

export function ChristmasWreath() {
  if (useTheme() !== 'christmas') return null;
  // Static, trusted markup (generated from the approved design board).
  return (
    <span className="xw-wreath" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART }} />
  );
}
