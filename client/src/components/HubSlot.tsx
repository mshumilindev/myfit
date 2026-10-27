/**
 * Where announcements may appear (SPO-355). A HUB SURFACE is a screen that carries the app's hub navigation
 * on a phone (Today, Coach Agenda): the places a person lands in. Each surface is named once in
 * `HUB_SURFACES` and mounts ONE `<HubSlot surface="…" />` at the top of its content; what shows there is
 * the `HUB_ANNOUNCEMENTS` registry. To announce something new: add an entry (and its component); to
 * make another screen a hub surface: add it to `HUB_SURFACES` and mount the slot. Nothing is hard-coded
 * per screen, and `hubSlot.guard.test.ts` fails if a surface has no slot or a slot names an unknown surface.
 */
import type { ComponentType } from 'react';
import { ThemeInvite } from './ThemeAnnouncement';

/** Screens with the hub navigation on a phone. The value says where the slot sits (for the guard and the next reader). */
export const HUB_SURFACES = {
  today: 'views/TodayView.tsx — under the day heading',
  coachAgenda: 'coach/today/TodayScreen.tsx — under the agenda header',
} as const;
export type HubSurface = keyof typeof HUB_SURFACES;

export interface HubAnnouncement {
  id: string;
  /** Surfaces it may appear on. */
  surfaces: readonly HubSurface[];
  /** Renders nothing when there is nothing to say (it owns its own "show once" rule). */
  Component: ComponentType;
}

/** In order of appearance. */
export const HUB_ANNOUNCEMENTS: readonly HubAnnouncement[] = [
  { id: 'new-theme', surfaces: ['today', 'coachAgenda'], Component: ThemeInvite },
];

export function HubSlot({ surface }: { surface: HubSurface }) {
  return (
    <>
      {HUB_ANNOUNCEMENTS.filter((a) => a.surfaces.includes(surface)).map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </>
  );
}
