/**
 * Halloween Start button (SPO-378): a pumpkin lantern with a carved plus, lit by one candle. Rendered inside the Start
 * button only while the Halloween theme is active; the stylesheet shows it in the Gym only (the other apps keep the
 * round skin-coloured button). Still by default; the candle and a slow sway run only in the attention state
 * (`.is-attention`) and never under reduced motion or at night.
 */
import { useTheme } from '../../themes/registry';
import './HalloweenLantern.css';

const ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none" class="hwl-art"><defs><clipPath id="hwl-aperture"><path d="M468 593L521 595L520 655L579 670L580 716L524 718L524 780L468 782L468 724L396 723L396 680L467 661Z"/></clipPath><radialGradient id="hwl-aura"><stop stop-color="#FFF4AC" stop-opacity=".9"/><stop offset=".35" stop-color="#FFB52C" stop-opacity=".6"/><stop offset="1" stop-color="#FF7500" stop-opacity="0"/></radialGradient><linearGradient id="hwl-fire" x1="495" y1="680" x2="495" y2="785" gradientUnits="userSpaceOnUse"><stop stop-color="#FF8C0A" stop-opacity="0"/><stop offset=".3" stop-color="#FFCC42"/><stop offset=".75" stop-color="#FFF8B7"/><stop offset="1" stop-color="#FFFDE7"/></linearGradient><filter id="hwl-soft" x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs><image class="hwl-material" href="/halloween/pumpkin.webp" width="1000" height="1000"/><g clip-path="url(#hwl-aperture)"><path class="hwl-shadow" d="M380 580H600V800H380Z" fill="#421401"/><ellipse class="hwl-glow" cx="496" cy="754" rx="84" ry="116" fill="url(#hwl-aura)"/><g class="hwl-flame"><path d="M480 782C456 758 482 736 490 722C500 706 491 693 499 680C500 705 514 718 510 735C532 756 515 785 502 791Z" fill="url(#hwl-fire)" filter="url(#hwl-soft)"/><path d="M488 782C480 770 493 757 497 745C500 761 510 772 502 784Z" fill="#FFF9CD" opacity=".9"/></g></g><path class="hwl-wall-light" d="M464 587L526 590L525 652L586 666L587 723L530 724L530 787L461 789L461 730L389 730L389 675L461 656Z" fill="none" stroke="#FFB733" stroke-width="9" stroke-linejoin="round" filter="url(#hwl-soft)"/></svg>';

export function HalloweenLantern() {
  if (useTheme() !== 'halloween') return null;
  // Static, trusted markup (generated from the approved design board).
  return (
    <span className="hw-lantern" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART }} />
  );
}
