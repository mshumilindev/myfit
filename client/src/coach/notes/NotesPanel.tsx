import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button, IconButton } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { ConfirmEffectsDialog } from '../../components/ui/ConfirmEffectsDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { FailedState } from '../../components/ui/FailedState';
import { Notice } from '../../components/ui/Notice';
import { NoteCard } from '../../components/ui/NoteCard';
import { SearchField } from '../../components/ui/SearchField';
import { Segmented } from '../../components/ui/Segmented';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Textarea } from '../../components/ui/Textarea';
import { UndoToast } from '../../components/ui/UndoToast';
import { Icon } from '../../ui';
import { useChatT } from '../../i18n/coachChat';
import { useNotesT } from '../../i18n/coachNotes';
import { ANCHOR_ICON, anchorChipLabel, anchorLabel, noteMatches, noteTime } from './labels';
import type { NotesPort } from './port';
import { useClientNotes } from './useNotes';
import { MAX_NOTE, NOTE_UNDO_MS, type Note, type NoteAnchor, type NoteVis } from './types';
import './NotesPanel.css';

export interface NotesPanelProps {
  clientId: string;
  /** Client first name (data). */
  first: string;
  /** Trainer first name, shown on the client side. */
  coachFirst?: string;
  /** The client's app shows the shared subset, read-only. */
  side?: 'trainer' | 'client';
  variant?: 'drawer' | 'sheet' | 'page';
  /** Contexts a new note can hang on (the chat: last message, open decision). "General" is always offered. */
  anchors?: readonly NoteAnchor[];
  onClose?: () => void;
  /** Tap on a context line: a message anchor scrolls the thread, others open their page. */
  onJump?: (a: NoteAnchor) => void;
  /** A note to mark as the one just jumped to. */
  highlightId?: string;
  port?: NotesPort;
  /** Stories: pre-fill. */
  initial?: { q?: string; text?: string; vis?: NoteVis; editId?: string; confirmId?: string };
  /** Stories / tests: the clock. */
  now?: number;
}

const GENERAL: NoteAnchor = { kind: 'none' };

/**
 * ONE list of a client's notes (S-16d). Used as the chat Notes drawer (desktop), the bottom sheet (phone), the page of
 * Client 360 > Notes (`variant="page"`), and, with `side="client"`, as the client's read-only "Notes from my trainer".
 * Newest first. Add field with visibility and context, search, per note: Edit / Share or Make private / Delete.
 * Delete = confirm + 8 s Undo. Loading is skeleton rows, an offline error keeps the notes already shown.
 */
export function NotesPanel(p: NotesPanelProps) {
  const { nt, locale } = useNotesT();
  const { ch } = useChatT();
  const side = p.side ?? 'trainer';
  const client = side === 'client';
  const { notes, status, store, state } = useClientNotes(p.clientId, p.port);
  const now = p.now ?? store.port.now();
  const list = useMemo(
    () => (client ? notes.filter((n) => n.vis === 'shared') : notes),
    [notes, client],
  );

  const [q, setQ] = useState(p.initial?.q ?? '');
  const [text, setText] = useState(p.initial?.text ?? '');
  const [vis, setVis] = useState<NoteVis>(p.initial?.vis ?? 'private');
  const [ctx, setCtx] = useState(0);
  const [editId, setEditId] = useState<string | null>(p.initial?.editId ?? null);
  const [draft, setDraft] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(p.initial?.confirmId ?? null);
  const [flash, setFlash] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const ctxs: NoteAnchor[] = [GENERAL, ...(p.anchors ?? [])];

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 2200);
    return () => window.clearTimeout(id);
  }, [flash]);

  const anchorText = (n: Note) => anchorLabel(ch, nt, locale, n.anchor, now);
  const shown = list.filter((n) => noteMatches(n, q, anchorText(n)));
  const doomed = confirmId ? notes.find((n) => n.id === confirmId) : undefined;
  const pending =
    state.pending && state.pending.note.clientId === p.clientId ? state.pending : null;
  const title = client ? nt.nTitleClient(p.coachFirst ?? '') : nt.nTitle(p.first);
  const tooLong = text.length > MAX_NOTE;

  const add = async () => {
    if (!text.trim() || tooLong) return;
    const n = await store.add({ clientId: p.clientId, text, vis, anchor: ctxs[ctx] ?? GENERAL });
    if (!n) return;
    setText('');
    if (vis === 'shared') setFlash(nt.nToastShared(p.first));
    if (body.current) body.current.scrollTop = 0;
  };

  return (
    <section className={`nts is-${p.variant ?? 'drawer'}`} aria-label={title} data-panel="notes">
      <header className="nts-h">
        <h2 className="nts-t">
          <Icon name={client ? 'eye' : 'pencil-simple'} />
          <span>{title}</span>
          <Badge n={list.length} tone="neutral" anchor="none" label={nt.nCount(list.length)} />
        </h2>
        {p.onClose && p.variant !== 'sheet' && (
          <IconButton icon="x" label={nt.nClose} onClick={p.onClose} />
        )}
      </header>

      <div className="nts-b" ref={body}>
        {client ? (
          <Notice tone="note" icon="info">
            {nt.nReadOnly(p.coachFirst ?? '')}
          </Notice>
        ) : (
          <div className="nts-add">
            <Textarea
              rows={2}
              value={text}
              placeholder={nt.nAddPlaceholder(p.first)}
              aria-label={nt.nAddAria}
              error={tooLong ? nt.nTooLong(MAX_NOTE) : undefined}
              onChange={(e) => setText(e.target.value)}
            />
            <Segmented
              size="sm"
              fill
              label={nt.nWho}
              value={vis}
              onChange={(v) => setVis(v)}
              options={[
                { value: 'private', label: nt.nPrivate, icon: 'lock-simple' },
                { value: 'shared', label: nt.nSharedWith(p.first), icon: 'eye', compact: true },
              ]}
            />
            {ctxs.length > 1 && (
              <div className="nts-ctx" role="group" aria-label={nt.nAttach}>
                {ctxs.map((c, i) => (
                  <Chip
                    key={`${c.kind}:${c.id ?? ''}`}
                    icon={ANCHOR_ICON[c.kind]}
                    selected={ctx === i}
                    aria-pressed={ctx === i}
                    onClick={() => setCtx(i)}
                  >
                    {anchorChipLabel(nt, c)}
                  </Chip>
                ))}
              </div>
            )}
            {vis === 'shared' && (
              <Notice tone="note" icon="eye">
                {nt.nSharedHint(p.first)}
              </Notice>
            )}
            <div className="nts-addr">
              <small className="nts-enc">
                <Icon name="lock-simple" />
                {nt.nEncNote}
              </small>
              <Button
                variant="primary"
                size="sm"
                icon="plus"
                disabled={!text.trim() || tooLong}
                onClick={() => void add()}
              >
                {nt.nAdd}
              </Button>
            </div>
          </div>
        )}

        {state.failed && (
          <Notice
            tone="danger"
            icon="warning-circle"
            trail={
              <Button variant="secondary" size="sm" onClick={() => store.clearFailed()}>
                {nt.nCancel}
              </Button>
            }
          >
            {nt.nSaveFailed}
          </Notice>
        )}
        {status === 'error' && (
          <Notice
            tone="note"
            icon="cloud-slash"
            trail={
              <Button variant="secondary" size="sm" onClick={() => store.restart(p.clientId)}>
                {nt.nRetry}
              </Button>
            }
          >
            {list.length > 0 ? nt.nUnavailableOffline : nt.nLoadFailed}
          </Notice>
        )}

        {status === 'loading' && list.length === 0 && <SkeletonRows rows={3} label={title} />}

        {list.length > 0 && (
          <SearchField
            value={q}
            onChange={setQ}
            placeholder={nt.nSearch}
            clearLabel={nt.nSearchClear}
            hint={q ? undefined : nt.nCount(list.length)}
          />
        )}
        {q && list.length > 0 && (
          <small className="nts-found" role="status">
            {nt.nFound(shown.length)}
          </small>
        )}

        {shown.length > 0 && (
          <ul className="nts-list" aria-label={nt.nListAria}>
            {shown.map((n) => {
              const editing = editId === n.id;
              const a = n.anchor;
              return (
                <li key={n.id} data-note={n.id}>
                  <NoteCard
                    vis={n.vis}
                    visLabel={
                      client
                        ? nt.nFrom(p.coachFirst ?? '')
                        : n.vis === 'shared'
                          ? nt.nSharedWith(p.first)
                          : nt.nPrivate
                    }
                    time={noteTime(ch, nt, locale, n, now)}
                    text={n.text}
                    highlighted={p.highlightId === n.id}
                    expandLabel={nt.nExpand}
                    collapseLabel={nt.nCollapse}
                    context={{
                      icon: ANCHOR_ICON[a.kind],
                      label: anchorText(n),
                      onOpen: a.kind !== 'none' && p.onJump ? () => p.onJump?.(a) : undefined,
                      actionLabel: a.kind === 'message' ? nt.nJump : nt.nOpenCtx,
                    }}
                    editing={
                      editing ? (
                        <div className="nts-edit">
                          <Textarea
                            rows={3}
                            value={draft}
                            aria-label={nt.nEditAria}
                            onChange={(e) => setDraft(e.target.value)}
                          />
                          <div className="nts-editr">
                            <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>
                              {nt.nCancel}
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={!draft.trim() || draft.length > MAX_NOTE}
                              onClick={() =>
                                void store
                                  .edit(p.clientId, n.id, draft)
                                  .then((ok) => ok && setEditId(null))
                              }
                            >
                              {nt.nSave}
                            </Button>
                          </div>
                        </div>
                      ) : undefined
                    }
                    actions={
                      client ? undefined : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="pencil-simple"
                            onClick={() => {
                              setDraft(n.text);
                              setEditId(n.id);
                            }}
                          >
                            {nt.nEdit}
                          </Button>
                          {n.vis === 'shared' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="eye-slash"
                              onClick={() =>
                                void store
                                  .setVis(p.clientId, n.id, 'private')
                                  .then((ok) => ok && setFlash(nt.nToastPrivate(p.first)))
                              }
                            >
                              {nt.nMakePrivate}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="eye"
                              onClick={() =>
                                void store
                                  .setVis(p.clientId, n.id, 'shared')
                                  .then((ok) => ok && setFlash(nt.nToastShared(p.first)))
                              }
                            >
                              {nt.nShareWith(p.first)}
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            icon="trash"
                            onClick={() => setConfirmId(n.id)}
                          >
                            {nt.nDelete}
                          </Button>
                        </>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}

        {status !== 'loading' && list.length === 0 && (
          <EmptyState
            titleAs="h2"
            icon="pencil-simple"
            title={client ? nt.nEmptyClientH : nt.nEmptyH(p.first)}
            body={client ? nt.nEmptyClientB(p.coachFirst ?? '') : nt.nEmptyB(p.first)}
          />
        )}
        {list.length > 0 && shown.length === 0 && (
          <EmptyState
            titleAs="h2"
            icon="magnifying-glass"
            title={nt.nNoMatchH(q)}
            body={nt.nNoMatchB}
          />
        )}
        {status === 'error' && list.length === 0 && (
          <FailedState
            title={nt.nLoadFailed}
            icon="cloud-slash"
            retryLabel={nt.nRetry}
            onRetry={() => store.restart(p.clientId)}
          />
        )}
      </div>

      {(pending || flash) && (
        <div className="nts-dock">
          {pending ? (
            <UndoToast
              key={pending.until}
              text={nt.nDeleted}
              undoLabel={nt.nUndo}
              countdownLabel={nt.nUndoCountdown}
              durationMs={NOTE_UNDO_MS}
              onUndo={() => store.undo()}
            />
          ) : (
            <div role="status" className="nts-flash">
              <Icon name="check-circle" />
              {flash}
            </div>
          )}
        </div>
      )}

      {doomed && (
        <NoteDeleteDialog
          n={doomed}
          first={p.first}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => {
            store.remove(doomed);
            setConfirmId(null);
          }}
        />
      )}
    </section>
  );
}

/** The delete dialog of one note: the panel and the thread bubble say the same words. */
export function NoteDeleteDialog({
  n,
  first,
  onCancel,
  onConfirm,
}: {
  n: Note;
  first: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { nt } = useNotesT();
  return (
    <ConfirmEffectsDialog
      title={nt.nDelTitle}
      body={n.vis === 'shared' ? nt.nDelBodyShared(first) : nt.nDelBodyPrivate}
      quote={n.text}
      effects={
        n.vis === 'shared' ? [{ icon: 'eye-slash', text: nt.nDelWhoShared(first) }] : undefined
      }
      small={nt.nUndoSmall}
      confirmLabel={nt.nDelConfirm}
      cancelLabel={nt.nCancel}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
