/** The gym's kit as chips on the My-gym widget (Equipment): the first five, a count of the rest, or the "not listed" chip. */
import { equipmentLabel } from '../../components/Muscle';
import { Chip } from '../../components/ui/Chip';

export function KitChips({ kit, empty }: { kit: string[]; empty: string }) {
  if (kit.length === 0)
    return (
      <Chip size="xs" tone="neutral">
        {empty}
      </Chip>
    );
  return (
    <>
      {kit.slice(0, 5).map((id) => (
        <Chip key={id} size="xs" tone="neutral">
          {equipmentLabel(id)}
        </Chip>
      ))}
      {kit.length > 5 && (
        <Chip size="xs" tone="neutral">
          {`+${kit.length - 5}`}
        </Chip>
      )}
    </>
  );
}
