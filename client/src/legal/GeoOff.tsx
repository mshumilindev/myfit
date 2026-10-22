/**
 * "Gym search is off" (SPO-293): what a search or map surface shows without the `geo-search` consent. Kit pieces only.
 * `Turn on` opens the consent prompt (`GeoConsentHost`). Nothing here calls a service.
 */
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Notice } from '../components/ui/Notice';
import { openGeoPrompt } from '../data/geoSearchGate';
import { useGeoT } from '../i18n/geoConsent';

/** A whole search area (the gym search list, the onboarding gym step). */
export function GeoOffState() {
  const g = useGeoT();
  return (
    <EmptyState icon="map-pin-slash" title={g.offTitle} body={g.offBody} titleAs="h3">
      <Button variant="secondary" onClick={openGeoPrompt}>
        {g.turnOn}
      </Button>
    </EmptyState>
  );
}

/** A small strip where a map would be, or above a nearby list. */
export function GeoOffNotice({ map = false }: { map?: boolean }) {
  const g = useGeoT();
  return (
    <Notice
      tone="neutral"
      icon="map-pin-slash"
      trail={
        <Button variant="link" inline onClick={openGeoPrompt}>
          {g.turnOn}
        </Button>
      }
    >
      {map ? g.mapOff : g.offTitle}
    </Notice>
  );
}
