/**
 * Share bottom sheet for the Apex stat cards (awards · standards). A live canvas preview, a story/square toggle and
 * native-share / save / copy (shared frame: CardShareSheet). Drawing is offline (data/shareCard).
 */
import { useCallback } from 'react';
import { CardShareSheet } from './CardShareSheet';
import { drawStatCard, type StatShareModel, type ShareFormat } from '../data/shareCard';

export function StatShareSheet({
  model,
  fileBase,
  onClose,
}: {
  model: StatShareModel;
  fileBase: string;
  onClose: () => void;
}) {
  const draw = useCallback(
    (cv: HTMLCanvasElement, format: ShareFormat) => drawStatCard(cv, model, format),
    [model],
  );
  return (
    <CardShareSheet
      title={model.kicker}
      fileName={`${fileBase}.png`}
      shareTitle={model.headline}
      draw={draw}
      onClose={onClose}
    />
  );
}
