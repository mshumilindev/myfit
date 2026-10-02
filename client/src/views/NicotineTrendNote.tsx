/**
 * Progress › fatigue / readiness lens: one quiet line saying the readings include the user's
 * nicotine and / or alcohol use. Each is named only while its effects are active AND its own
 * Trends switch is on; with neither, nothing. Context only: it changes no number.
 * Supplements get their own second line, only while late caffeine adds to the sleep need
 * (readiness reads the sleep need): creatine's strength expectation has no place in these
 * lenses, so it is not mentioned here.
 */
import { useT } from '../i18n';
import { surfaceOn } from '../nicotine';
import { surfaceOn as alcoholSurfaceOn } from '../alcohol';
import { useAlcohol, useAlcoholEffects, useNicotine, useNicotineEffects } from '../store';
import { SupplementTrendNote } from './SupplementNotes';

export function NicotineTrendNote() {
  const { t } = useT();
  const nic = useNicotine();
  const nicEffects = useNicotineEffects();
  const alc = useAlcohol();
  const alcEffects = useAlcoholEffects();
  const nicOn = !!nicEffects && surfaceOn(nic.settings, 'trends');
  const alcOn = !!alcEffects && alcoholSurfaceOn(alc.settings, 'trends');
  const text = nicOn && alcOn ? t.alcFxTrendBoth : alcOn ? t.alcFxTrendNote : t.nicFxTrendNote;
  return (
    <>
      {(nicOn || alcOn) && <p className="ut-xs ut-faint">{text}</p>}
      <SupplementTrendNote />
    </>
  );
}
