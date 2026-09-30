import { upsertGym } from '../store';
import type { Gym } from '../types';
import { AMENITY_CATALOG, detectedAmenities, effectiveAmenities } from '../data/gymAmenities';
import { useT } from '../i18n';
import { Icon } from '../ui';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import './AmenitiesCard.css';

/** Gym amenities editor: toggle what this gym really has; detected ones are hinted. */
export function AmenitiesCard({ gym }: { gym: Gym }) {
  const { t } = useT();
  const active = new Set(effectiveAmenities(gym));
  const detected = new Set(detectedAmenities(gym));
  const confirmed = gym.amenities !== undefined;
  const differs =
    confirmed &&
    (gym.amenities!.length !== detected.size || gym.amenities!.some((a) => !detected.has(a)));

  const toggle = (id: string) => {
    const next = new Set(active);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    upsertGym({
      ...gym,
      amenities: AMENITY_CATALOG.filter((a) => next.has(a.id)).map((a) => a.id),
    });
  };
  const reset = () => {
    const { amenities: _drop, ...rest } = gym;
    void _drop;
    upsertGym({ ...rest, amenitiesAuto: [...detected] });
  };
  const label = (id: string) => t[`amen_${id}` as keyof typeof t] as string;

  return (
    <div className="detail-card amen-card">
      <div className="detail-card-head">
        <span className="label">
          <Icon name="sparkle" /> {t.amenTitle}
        </span>
      </div>
      <div className="detail-muted amen-hint">{t.amenHint}</div>
      <div className="amen-chips">
        {AMENITY_CATALOG.map((a) => (
          <Chip
            key={a.id}
            icon={a.icon}
            selected={active.has(a.id)}
            aria-pressed={active.has(a.id)}
            onClick={() => toggle(a.id)}
          >
            {label(a.id)}
            {detected.has(a.id) && <span className="amen-auto">{t.amenAuto}</span>}
          </Chip>
        ))}
      </div>
      {differs && (
        <Button variant="link" size="sm" onClick={reset}>
          {t.amenReset}
        </Button>
      )}
    </div>
  );
}
