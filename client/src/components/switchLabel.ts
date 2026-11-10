/**
 * The word on the app-switch gate ("Loading"): CSS cannot read the locale, so while `html[data-glitch]` is set the current
 * string goes to `html[data-switch-label]`, which the gate shows through `attr()` (themes/_studio.switch.css).
 */
import { t } from '../i18n';

export function initSwitchLabel(): () => void {
  const root = document.documentElement;
  const sync = () => {
    if (root.dataset.glitch) root.dataset.switchLabel = t().loadingApp;
  };
  const mo = new MutationObserver(sync);
  mo.observe(root, { attributes: true, attributeFilter: ['data-glitch'] });
  return () => mo.disconnect();
}
