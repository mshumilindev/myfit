/* The Nicotine / Cycle / Alcohol / Supplements pages, each behind its own health consent (SPO-290). Leaf module. */
import { HealthGate } from '../../legal/HealthOff';
import { NicotineScreens } from './nicotine/NicotineScreens';
import { CycleScreens, type CycleScreen } from './cycle/CycleScreens';
import { AlcoholScreens } from './alcohol/AlcoholScreens';
import { SupplementScreens } from './supplements/SupplementScreens';

type Nic = 'hub' | 'products' | 'calc';
type Alc = 'hub' | 'products' | 'days' | 'calc';
type Sup = 'hub' | 'products' | 'calc';

export function HealthFeatureScreen(props: {
  nic?: Nic;
  cyc?: CycleScreen;
  alc?: Alc;
  sup?: Sup;
  go: (o: { nic?: Nic; cyc?: CycleScreen; alc?: Alc; sup?: Sup; cond?: undefined }) => void;
  onBack: () => void;
}) {
  const { go, onBack } = props;
  if (props.nic)
    return (
      <HealthGate feature="nicotine" onBack={onBack}>
        <NicotineScreens screen={props.nic} onOpen={(nic) => go({ nic })} onBack={onBack} />
      </HealthGate>
    );
  if (props.cyc)
    return (
      <HealthGate feature="cycle" onBack={onBack}>
        <CycleScreens
          screen={props.cyc}
          onOpen={(cyc) => go({ cyc })}
          onBack={onBack}
          onOpenStates={() => go({ cond: undefined })}
        />
      </HealthGate>
    );
  if (props.alc)
    return (
      <HealthGate feature="alcohol" onBack={onBack}>
        <AlcoholScreens screen={props.alc} onOpen={(alc) => go({ alc })} onBack={onBack} />
      </HealthGate>
    );
  if (props.sup)
    return (
      <HealthGate feature="supplements" onBack={onBack}>
        <SupplementScreens screen={props.sup} onOpen={(sup) => go({ sup })} onBack={onBack} />
      </HealthGate>
    );
  return null;
}
