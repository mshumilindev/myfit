import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '../../ui';
import { Button } from './Button';
import { ConsentLevelPicker, type ConsentLevelId, type ConsentPickerRow } from './ConsentControls';
import { Field } from './Field';
import { Notice } from './Notice';
import { Segmented } from './Segmented';
import './InvitePanel.css';

/**
 * The invite form (story group `Coach/Invite`). ONE component for the roster side panel, the phone inline form
 * and the empty-roster card, so they cannot drift (S-18 AC). Strings in, no dictionary, no domain imports.
 * The consent levels are a REQUEST the client answers at accept; program-only has none (nothing to log, no link).
 */
export type InviteMode = 'app' | 'hybrid' | 'program';

export interface InviteCategory {
  id: string;
  label: string;
  what?: string;
}

export interface InviteLabels {
  title: string;
  /** Under the title (the empty-roster card explains signals here). */
  intro?: string;
  modeGroup: string;
  modes: Record<InviteMode, { label: string; hint: string; submit: string }>;
  nameLabel: string;
  namePlaceholder: string;
  nameNeeded: string;
  nameTooShort: string;
  consentToggleShow: string;
  consentToggleHide: string;
  consentLegend: string;
  consentNote: string;
  levels: Record<ConsentLevelId, string>;
  categories: InviteCategory[];
  sending: string;
  errorOffline: string;
  errorFailed: string;
  sent: Record<InviteMode, string>;
  linkLabel: string;
  copy: string;
  copied: string;
  share: string;
  sendInChat: string;
  expires: (days: number) => string;
  another: string;
  openProfile: string;
}

export interface InviteCreated {
  id: string;
  /** null = program-only: added at once, no link. */
  url: string | null;
  expiresInDays: number | null;
}

export interface InvitePanelProps {
  labels: InviteLabels;
  /** Starting consent request for a mode (the caller owns the defaults). */
  defaultRequest: (mode: InviteMode) => Record<string, ConsentLevelId>;
  /** Resolve with the result; throw (any error, `code: 'offline'` for no network) to show the error and keep the form. */
  onCreate: (req: {
    name: string;
    mode: InviteMode;
    request: Record<string, ConsentLevelId>;
  }) => Promise<InviteCreated>;
  initialMode?: InviteMode;
  initialName?: string;
  /** Show the sent state immediately (stories). */
  initialSent?: InviteCreated & { name: string; mode: InviteMode };
  /** Larger title for the empty-roster card. */
  hero?: boolean;
  onSendInChat?: (url: string) => void;
  onOpenProfile?: (id: string) => void;
}

const isOffline = (e: unknown): boolean =>
  (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'offline') ||
  (typeof navigator !== 'undefined' && navigator.onLine === false);

export function InvitePanel({
  labels,
  defaultRequest,
  onCreate,
  initialMode = 'app',
  initialName = '',
  initialSent,
  hero,
  onSendInChat,
  onOpenProfile,
}: InvitePanelProps) {
  const [mode, setMode] = useState<InviteMode>(initialMode);
  const [name, setName] = useState(initialName);
  const [touched, setTouched] = useState(false);
  const [request, setRequest] = useState(() => defaultRequest(initialMode));
  const [showConsent, setShowConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'offline' | 'failed' | null>(null);
  const [sent, setSent] = useState<(InviteCreated & { name: string; mode: InviteMode }) | null>(
    initialSent ?? null,
  );
  const nameRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const short = trimmed.length > 0 && trimmed.length < 2;
  const asks = mode !== 'program';
  const m = labels.modes[mode];

  const pick = (next: InviteMode) => {
    setMode(next);
    setRequest(defaultRequest(next));
    setError(null);
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (busy || trimmed.length < 2) {
      nameRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await onCreate({ name: trimmed, mode, request: asks ? request : {} });
      setSent({ ...res, name: trimmed, mode });
      setName('');
      setTouched(false);
    } catch (err) {
      setError(isOffline(err) ? 'offline' : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const rows: ConsentPickerRow[] = labels.categories.map((c) => ({
    id: c.id,
    label: c.label,
    what: c.what,
    value: request[c.id] ?? 'off',
  }));

  const nameError =
    touched && !trimmed ? labels.nameNeeded : short ? labels.nameTooShort : undefined;

  return (
    <section className={`inv${hero ? ' inv--hero' : ''}`} aria-labelledby="inv-title">
      <h2 id="inv-title" className="inv-h">
        {labels.title}
      </h2>
      {labels.intro && <p className="inv-intro">{labels.intro}</p>}

      {sent && (
        <div className="inv-sent" role="status">
          <Notice tone="ok" icon="check-circle">
            {labels.sent[sent.mode]}
          </Notice>
          {sent.url && (
            <InviteLink
              url={sent.url}
              label={labels.linkLabel}
              copy={labels.copy}
              copied={labels.copied}
              share={labels.share}
              shareText={sent.name}
              expires={sent.expiresInDays != null ? labels.expires(sent.expiresInDays) : undefined}
              onSendInChat={onSendInChat ? () => onSendInChat(sent.url!) : undefined}
              sendInChat={labels.sendInChat}
            />
          )}
          <div className="inv-btns">
            {!sent.url && onOpenProfile && (
              <Button
                variant="secondary"
                size="sm"
                iconTrailing="arrow-right"
                onClick={() => onOpenProfile(sent.id)}
              >
                {labels.openProfile}
              </Button>
            )}
            <Button variant="ghost" size="sm" icon="plus" onClick={() => setSent(null)}>
              {labels.another}
            </Button>
          </div>
        </div>
      )}

      {!sent && (
        <form className="inv-form" onSubmit={submit} noValidate>
          <Segmented<InviteMode>
            size="sm"
            hug
            label={labels.modeGroup}
            value={mode}
            onChange={pick}
            options={(['app', 'hybrid', 'program'] as const).map((v) => ({
              value: v,
              label: labels.modes[v].label,
            }))}
          />
          <p className="inv-hint">{m.hint}</p>
          <Field
            ref={nameRef}
            label={labels.nameLabel}
            placeholder={labels.namePlaceholder}
            value={name}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            error={nameError}
            hint={!trimmed ? labels.nameNeeded : undefined}
          />
          {asks && (
            <div className="inv-consent">
              <Button
                variant="link"
                size="sm"
                type="button"
                iconTrailing={showConsent ? 'caret-up' : 'caret-down'}
                aria-expanded={showConsent}
                onClick={() => setShowConsent((s) => !s)}
              >
                {showConsent ? labels.consentToggleHide : labels.consentToggleShow}
              </Button>
              {showConsent && (
                <>
                  <ConsentLevelPicker
                    legend={labels.consentLegend}
                    rows={rows}
                    levelLabels={labels.levels}
                    onChange={(id, lv) => setRequest((r) => ({ ...r, [id]: lv }))}
                  />
                  <p className="inv-note">
                    <Icon name="info" /> {labels.consentNote}
                  </p>
                </>
              )}
            </div>
          )}
          {error && (
            <Notice tone="danger" icon="warning-circle" role="alert">
              {error === 'offline' ? labels.errorOffline : labels.errorFailed}
            </Notice>
          )}
          <div className="inv-btns">
            <Button type="submit" variant="primary" loading={busy} disabled={!trimmed || short}>
              {busy ? labels.sending : m.submit}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Link + Copy (+ Share via the system sheet when there is one, + Send in chat). No QR yet (needs a generator). */
export function InviteLink({
  url,
  label,
  copy,
  copied,
  share,
  shareText,
  expires,
  onSendInChat,
  sendInChat,
}: {
  url: string;
  label: string;
  copy: string;
  copied: string;
  share: string;
  shareText: string;
  expires?: ReactNode;
  onSendInChat?: () => void;
  sendInChat: string;
}) {
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      ref.current?.select(); // the person can copy by hand
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 2000);
  };
  const doShare = async () => {
    try {
      await navigator.share({ title: shareText, url });
    } catch {
      /* dismissed: nothing to do */
    }
  };

  return (
    <div className="inv-link">
      <Field
        ref={ref}
        label={label}
        value={url}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
      />
      {expires != null && <p className="inv-msg">{expires}</p>}
      <div className="inv-btns">
        <Button
          variant="secondary"
          size="sm"
          icon={done ? 'check' : 'copy'}
          type="button"
          onClick={doCopy}
        >
          {done ? copied : copy}
        </Button>
        {canShare && (
          <Button variant="ghost" size="sm" icon="share-network" type="button" onClick={doShare}>
            {share}
          </Button>
        )}
        {onSendInChat && (
          <Button variant="ghost" size="sm" icon="envelope" type="button" onClick={onSendInChat}>
            {sendInChat}
          </Button>
        )}
      </div>
    </div>
  );
}
