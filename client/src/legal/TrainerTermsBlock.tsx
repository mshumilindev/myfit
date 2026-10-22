/**
 * The Trainer Terms + DPA part of drawer 1 of the legal gate (SPO-289, SPO-295): the "Draft" line and the key points
 * ("In short"). A SUMMARY, not the contract: the two full documents decide (`summaryNote`), they open from the agreement
 * rows of the gate, and the one "I have read and accept" flow records the acceptance. Built only from kit pieces.
 */
import { useTrainerTermsT } from '../i18n/trainerTerms';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import './LegalGate.css';

export function TrainerTermsBlock() {
  const s = useTrainerTermsT();
  return (
    <>
      <p className="lgg-lead ut-sm ut-w7">{s.draftBadge}</p>
      <GroupedList surface="raised" header={s.pointsHeader} footer={s.summaryNote}>
        {s.points.map((p) => (
          <ListRow key={p} icon={<IconTile size={30} icon="check" />} label={p} />
        ))}
      </GroupedList>
    </>
  );
}
