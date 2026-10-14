/**
 * Test helper: the DOM skeleton of the program editor page (tags, roles, kit / `pe-` classes), so two hosts can be
 * compared structurally. Used by the identity tests only.
 */

/** Functional slots whose CONTAINER is common: the box is compared, what the host puts in it is not. */
export const CONTAINERS = [
  '.pe-band-body', // the host's rows of the info band
  '.pe-day-tags', // tags beside a day (trainer days / activity count / dayTag slot)
  '.pe-dc-t', // the day card title: an editable name in the athlete host
  '.pe-dc-f', // day card footer actions differ by feature (cardio, copy day, library)
  '.pe-insp-b', // the inspector pane: the selected thing's own editor
];
/** Functional parts that exist in one host only (a host feature or a host action): not part of the common skeleton. */
export const OPTIONAL = [
  '.pe-weekset', // week setup (`weekSetup`): the athlete host
  '.pe-dc-tag', // "with the trainer / solo" beside the day: only where there is a partner (Coach)
  '.pe-page-foot', // a quiet note under the page (the athlete's weight note, activities on rest days)
  '.pe-band-note', // the band's one note (readiness / send gate): a host decides if there is one
  '.pe-page-cluster > .uibtn', // the host's action buttons (their count and labels are the host's)
  '.pe-page-bar .uibtn', // the same buttons in the phone bar
  '.pe-page-cluster > .amenu-anchor', // the host's overflow menu
];

const tokens = (el: Element) =>
  [...el.classList].filter((c) => /^(pe-|ui|uit)/.test(c) && !/^uit--/.test(c)).sort();

export function skeleton(
  el: Element,
  extraContainers: readonly string[] = [],
  depth = 0,
): string[] {
  const role = el.getAttribute('role');
  const label = `${'  '.repeat(depth)}${el.tagName.toLowerCase()}${role ? `[${role}]` : ''}.${tokens(el).join('.')}`;
  if (OPTIONAL.some((s) => el.matches(s))) return [];
  if ([...CONTAINERS, ...extraContainers].some((s) => el.matches(s))) return [`${label} {slot}`];
  return [label, ...[...el.children].flatMap((c) => skeleton(c, extraContainers, depth + 1))];
}

export const firstToken = (el: Element): string | undefined => tokens(el)[0];
