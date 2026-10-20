import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { ResponsivePanel } from '../../components/ui/ResponsivePanel';
import { Segmented } from '../../components/ui/Segmented';
import { useTeamT } from '../../i18n/coachTeam';

export interface InviteTrainer {
  id: string;
  name: string;
}

const shortName = (full: string): string => {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1]![0]}.` : full;
};

/**
 * A manager invites a client for one of the team's trainers (SPO-202): the client's name and the trainer. The result is the
 * same link a trainer would send; the client accepts it and shares what they choose with that trainer.
 */
export function InviteClientSheet({
  trainers,
  defaultTrainerId,
  onClose,
  onSend,
}: {
  trainers: readonly InviteTrainer[];
  defaultTrainerId?: string;
  onClose: () => void;
  onSend: (trainerId: string, name: string) => Promise<{ ok: true; url: string } | { ok: false }>;
}) {
  const { tm } = useTeamT();
  const anchor = useRef<HTMLElement | null>(null);
  const [name, setName] = useState('');
  const [trainerId, setTrainerId] = useState(defaultTrainerId ?? trainers[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const trainer = trainers.find((t) => t.id === trainerId);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (sending) return;
    if (name.trim().length < 2) return setError(tm.icErrName);
    if (!trainerId) return setError(tm.icErrTrainer);
    setSending(true);
    const r = await onSend(trainerId, name.trim());
    setSending(false);
    if (r.ok) return setLink(r.url);
    setError(tm.tmErrGeneric);
  };
  const copy = () => {
    if (!link) return;
    void navigator.clipboard?.writeText(link).catch(() => undefined);
    setCopied(true);
  };

  if (link)
    return (
      <ResponsivePanel
        open
        mode="sheet"
        anchorRef={anchor}
        onClose={onClose}
        label={tm.icLinkTitle}
        title={tm.icLinkTitle}
        footer={
          <div className="tm-sheet-actions">
            <Button variant="primary" icon={copied ? 'check' : undefined} onClick={copy}>
              {copied ? tm.tmLinkCopied : tm.tmCopyLink}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              {tm.tmDone}
            </Button>
          </div>
        }
      >
        <div className="tm-sheet">
          <p className="tm-sheet-sub">
            {tm.icLinkBody(name.trim(), shortName(trainer?.name ?? ''))}
          </p>
          <Field
            label={tm.tmCopyLink}
            value={link}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      </ResponsivePanel>
    );

  return (
    <ResponsivePanel
      open
      mode="sheet"
      anchorRef={anchor}
      onClose={onClose}
      label={tm.icTitle}
      title={tm.icTitle}
      footer={
        <div className="tm-sheet-actions">
          <Button variant="primary" loading={sending} onClick={() => void submit()}>
            {tm.icCreate}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {tm.tmCancel}
          </Button>
        </div>
      }
    >
      <form className="tm-sheet" onSubmit={(e) => void submit(e)} noValidate>
        <Field
          label={tm.icName}
          autoComplete="off"
          autoFocus
          value={name}
          error={error}
          hint={tm.icNameHint}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        {trainers.length > 1 && (
          <Segmented
            label={tm.icTrainerLabel}
            variant="track"
            hug
            scroll
            value={trainerId}
            onChange={setTrainerId}
            options={trainers.map((t) => ({ value: t.id, label: shortName(t.name) }))}
          />
        )}
        <p className="tm-sheet-sub">{tm.icBody(shortName(trainer?.name ?? ''))}</p>
      </form>
    </ResponsivePanel>
  );
}
