/**
 * Onboarding step 5 (SPO-500 I5): "Make it yours". One question, a few ready sets for the role, the recommended one
 * preselected — a person who just presses Continue gets a sensible start; Skip changes nothing (Today offers it later).
 * "What's inside" opens the real store page of the set's headline item in a sheet, so a person can see what they would get
 * without leaving onboarding. No prices here: buying belongs to the store, at the moment a person wants something.
 */
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { enableAddons, useEnabledAddons } from '../addons/enabledSet';
import { headlineOf, packsFor } from '../addons/starterPacks';
import { markInviteSeen } from '../addons/startInvite';
import { useQueuedAddons } from '../addons/queue';
import { useOnline } from '../addons/useOnline';
import { getRole } from '../api';
import { Button } from '../components/ui/Button';
import { IconTile } from '../components/ui/IconTile';
import { OptionCard, OptionCardGrid } from '../components/ui/OptionCard';
import { Sheet } from '../components/ui/Overlays';
import { useT } from '../i18n';
import { useAddonStoreT } from '../i18n/addonStore';
import { Icon } from '../ui';

const ItemPreview = lazy(() => import('./OnboardingAddonPreview'));

export function OnboardingAddonsStep({
  rail,
  onContinue,
}: {
  rail: ReactNode;
  onContinue: () => void;
}) {
  const { t } = useT();
  const { st } = useAddonStoreT();
  const role = getRole();
  const packs = useMemo(() => packsFor(role), [role]);
  const [sel, setSel] = useState(packs.find((p) => p.recommended)?.id ?? packs[0]?.id);
  const [peek, setPeek] = useState<string | null>(null);
  const enabled = useEnabledAddons();
  const queued = useQueuedAddons();
  const online = useOnline();
  const cur = packs.find((p) => p.id === sel);
  const names = (ids: readonly string[]) =>
    ids.map((id) => st.items[id as keyof typeof st.items]?.name ?? id);
  const coach = role !== 'member';
  const head = cur ? headlineOf(cur) : null;
  return (
    <div className="onb-card">
      {rail}
      <h2 className="display sm">{coach ? t.onbAddonsLeadCoach : t.onbAddonsLead}</h2>
      <p className="lead">{t.onbAddonsNote}</p>
      <OptionCardGrid columns={1} label={coach ? t.onbAddonsLeadCoach : t.onbAddonsLead}>
        {packs.map((p) => {
          const list = names(p.ids).join(', ');
          const sub = [p.recommended ? t.onbPackRec : '', list || t.onbPackNone]
            .filter(Boolean)
            .join(' · ');
          return (
            <OptionCard
              key={p.id}
              icon={<IconTile icon={p.icon} tone={p.tone} size={40} />}
              title={t[`onbPack_${p.id}` as const]}
              sub={sub}
              selected={sel === p.id}
              onSelect={() => setSel(p.id)}
            />
          );
        })}
      </OptionCardGrid>
      {head && cur ? (
        <Button variant="link" onClick={() => setPeek(head)}>
          {t.onbAddonsInside(names(cur.ids).join(' · '))} <Icon name="caret-right" />
        </Button>
      ) : null}
      <Button
        variant="primary"
        size="lg"
        onClick={() => {
          if (cur?.ids.length) enableAddons([...cur.ids], role);
          markInviteSeen();
          onContinue();
        }}
      >
        {t.onbContinue} <Icon name="arrow-right" />
      </Button>
      <Button variant="link" onClick={onContinue}>
        {t.onbAddonsSkip}
      </Button>
      {peek ? (
        <Sheet onClose={() => setPeek(null)} label={names([peek])[0]} padded>
          <Suspense fallback={null}>
            <ItemPreview id={peek} st={st} enabled={enabled} queued={queued} online={online} />
          </Suspense>
        </Sheet>
      ) : null}
    </div>
  );
}
