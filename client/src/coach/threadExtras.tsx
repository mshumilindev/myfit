/**
 * Share + Notes inside a Coach chat thread (M5). `createCoachThreadExtras(opts)` returns the hook ThreadView calls
 * (`useThreadExtras`): the Share button and the pending-share chip next to the composer, share cards drawn in the
 * bubbles, the delete-share copy, the Notes button with its drawer / sheet, private-note mode, notes between the
 * messages, and the library peek. Nothing here reaches a server: shares travel as a sealed message body through the
 * chat port, notes through the notes port (both fixtures until the real adapters, see their port.ts files).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button, IconButton } from '../components/ui/Button';
import { ChatBubble } from '../components/ui/ChatBubble';
import { Chip } from '../components/ui/Chip';
import { Snackbar } from '../components/ui/Snackbar';
import { useNotesT } from '../i18n/coachNotes';
import type { ThreadExtras, ThreadExtrasCtx } from './chat/ThreadView';
import type { ChatMessage } from './chat/types';
import { NoteDeleteDialog } from './notes/NotesPanel';
import { NotesHost } from './notes/NotesHost';
import type { NotesPanelProps } from './notes/NotesPanel';
import type { NotesPort } from './notes/port';
import { useClientNotes } from './notes/useNotes';
import type { Note, NoteAnchor } from './notes/types';
import { programPageRoute, type CoachRoute } from './routes';
import { AskCard } from './share/AskCard';
import { askBody, askedRecently, parseAskReqId } from './share/askShare';
import { useSafeT } from '../i18n/coachSafe';
import { LibraryPeek } from './share/LibraryPeek';
import { ShareCardView, useWords } from './share/ShareCardView';
import { ShareMessage } from './share/ShareMessage';
import { SharePicker } from './share/SharePicker';
import type { ShareSourcePort } from './share/port';
import { resolveShare } from './share/resolve';
import { rememberShare, type Filter } from './share/search';
import { parseShareRef, type ShareRef, type ShareView } from './share/types';
import { useShareSource } from './share/useShare';
import './threadExtras.css';

/** Stories and tests: open parts of the feature at mount. */
export interface ThreadExtrasInitial {
  picker?: { q?: string; filter?: Filter };
  pending?: ShareRef;
  peek?: ShareRef;
  notesOpen?: boolean;
  notes?: NotesPanelProps['initial'];
  highlightNote?: string;
  noteMode?: boolean;
}

export interface CoachThreadExtrasOpts {
  initial?: ThreadExtrasInitial;
  onNavigate?: (r: CoachRoute) => void;
  sharePort?: ShareSourcePort;
  notesPort?: NotesPort;
  /** Overrides the default ask (a real `request` message through the chat port, see share/askShare.ts). */
  onAskShare?: (clientId: string, kind: ShareRef['kind']) => void;
}

const sharesIn = (messages: readonly ChatMessage[]): ShareRef[] =>
  messages
    .filter((m) => !m.deleted && m.body.kind === 'share')
    .map((m) => (m.body.kind === 'share' ? parseShareRef(m.body.share) : null))
    .filter((r): r is ShareRef => !!r)
    .reverse();

export function createCoachThreadExtras(opts: CoachThreadExtrasOpts = {}) {
  return function useCoachThreadExtras(ctx: ThreadExtrasCtx): ThreadExtras {
    const w = useWords();
    const { sh } = w;
    const { nt } = useNotesT();
    const { sf } = useSafeT();
    const viewer = useMemo(
      () => ({ side: 'trainer' as const, clientId: ctx.clientId }),
      [ctx.clientId],
    );

    const [pickerOpen, setPickerOpen] = useState(!!opts.initial?.picker);
    const [pending, setPending] = useState<ShareRef | null>(opts.initial?.pending ?? null);
    const [peek, setPeek] = useState<ShareRef | null>(opts.initial?.peek ?? null);
    const [noteMode, setNoteMode] = useState(!!opts.initial?.noteMode);
    const [notesOpen, setNotesOpen] = useState(!!opts.initial?.notesOpen);
    const [hl, setHl] = useState<string | undefined>(opts.initial?.highlightNote);
    const [confirmNote, setConfirmNote] = useState<Note | null>(null);
    const [flash, setFlash] = useState<string | null>(null);
    const anchor = useRef<HTMLElement | null>(null);
    const [, setAnchorEl] = useState<HTMLElement | null>(null);
    /** Stories open the picker at mount: the button is the anchor before any click. */
    const takeAnchor = (el: HTMLElement | null) => {
      if (el && !anchor.current) {
        anchor.current = el;
        setAnchorEl(el);
      }
    };
    const { source } = useShareSource(ctx.clientId, opts.sharePort);
    const { notes, store: notesStore } = useClientNotes(ctx.clientId, opts.notesPort);

    const pendingView = useMemo<ShareView | null>(
      () => (pending && source ? resolveShare(pending, viewer, source) : null),
      [pending, source, viewer],
    );
    const last = ctx.messages[ctx.messages.length - 1];
    const anchors = useMemo<NoteAnchor[]>(
      () => (last && !last.deleted ? [{ kind: 'message', id: last.id, at: last.at }] : []),
      [last],
    );

    const openTarget = useCallback(
      (v: ShareView) => {
        const t = v.openTarget;
        if (t.overlay) {
          setPeek({
            kind: v.kind,
            id: v.ref.id,
            ...(v.ref.ownerId ? { ownerId: v.ref.ownerId } : {}),
          });
          return;
        }
        const go = opts.onNavigate;
        if (!go) return;
        if (t.screen === 'programs') go({ screen: 'programs' });
        else if (t.screen === 'editor') go(programPageRoute(ctx.clientId, 'edit', 'client'));
        else if (t.screen === 'client360')
          go({ screen: 'client', cid: t.params.id ?? ctx.clientId, tab: t.params.tab });
      },
      [ctx.clientId],
    );

    const jump = useCallback(
      (a: NoteAnchor) => {
        if (a.kind === 'message' && a.id) {
          const el = document.getElementById(`msg-${a.id}`);
          if (!el) {
            setFlash(nt.nJumpGone);
            return;
          }
          setNotesOpen(false);
          el.scrollIntoView({ block: 'center' });
          return;
        }
        const go = opts.onNavigate;
        if (!go) return;
        if (a.kind === 'decision') go({ screen: 'decisions' });
        else if (a.kind === 'day' || a.kind === 'exercise')
          go({ screen: 'client', cid: ctx.clientId, tab: 'program' });
      },
      [ctx.clientId, nt.nJumpGone],
    );

    const card = useCallback(
      (m: ChatMessage) => {
        if (m.body.kind === 'request') {
          const k = parseAskReqId(m.body.reqId);
          return k ? <AskCard kind={k} side="trainer" mine={m.from === 'trainer'} /> : undefined;
        }
        if (m.body.kind !== 'share') return undefined;
        const ref = parseShareRef(m.body.share);
        if (!ref)
          return (
            <ChatBubble side={m.from === 'trainer' ? 'me' : 'them'} muted icon="info">
              {sh.unsupportedShare}
            </ChatBubble>
          );
        return (
          <ShareMessage
            share={ref}
            caption={m.body.text}
            mine={m.from === 'trainer'}
            senderFirst={ctx.first}
            ownerFirst={ctx.first}
            viewer={viewer}
            port={opts.sharePort}
            onOpen={openTarget}
          />
        );
      },
      [sh.unsupportedShare, ctx.first, viewer, openTarget],
    );

    const shareDelete = useCallback(
      (m: ChatMessage) => {
        if (m.body.kind !== 'share' || m.from !== 'trainer') return undefined;
        const ref = parseShareRef(m.body.share);
        if (!ref) return undefined;
        return {
          title: sh.delTitle,
          body: sh.delBody(ctx.first, ref.kind),
          effects: [{ icon: 'eye-slash', text: sh.delWho(ctx.first) }],
          confirmLabel: sh.delConfirm,
        };
      },
      [sh, ctx.first],
    );

    const noteItems = useMemo(
      () =>
        notes
          .filter((n) => n.anchor.kind === 'message' || n.anchor.kind === 'none')
          .map((n) => ({
            id: n.id,
            at: n.at,
            node: (
              <ChatBubble
                side="me"
                tone="note"
                kind={{
                  icon: n.vis === 'private' ? 'lock-simple' : 'eye',
                  label: n.vis === 'private' ? nt.nBubblePrivate : nt.nBubbleShared(ctx.first),
                }}
              >
                {n.text}
                <span className="shx-note-act">
                  <IconButton
                    icon="pencil-simple"
                    size="sm"
                    label={nt.nMenuEdit}
                    onClick={() => {
                      setHl(n.id);
                      setNotesOpen(true);
                    }}
                  />
                  <IconButton
                    icon="trash"
                    size="sm"
                    label={nt.nMenuDelete}
                    onClick={() => setConfirmNote(n)}
                  />
                </span>
              </ChatBubble>
            ),
          })),
      [notes, nt, ctx.first],
    );

    const intercept = useCallback(
      (text: string) => {
        if (!noteMode) return false;
        const t = text.trim();
        if (!t) return true;
        void notesStore
          .add({
            clientId: ctx.clientId,
            text: t,
            vis: 'private',
            anchor: anchors[0] ?? { kind: 'none' },
          })
          .then((n) => n && setFlash(nt.nModeSaved));
        return true;
      },
      [noteMode, notesStore, ctx.clientId, anchors, nt.nModeSaved],
    );

    /** The ask is a real message: sealed, in the outbox with retry, and one card per kind per day. */
    const askShare = (k: ShareRef['kind']) => {
      if (opts.onAskShare) return opts.onAskShare(ctx.clientId, k);
      const now = ctx.now();
      if (askedRecently(ctx.messages, k, now)) return;
      ctx.send(sf.askMsg(sh.kindPlural[k]), askBody(k, now));
    };

    const body = pending ? ({ kind: 'share', share: pending } as const) : undefined;

    return {
      lead: (
        <>
          <span ref={takeAnchor} className="shx-anchor">
            <IconButton
              icon="share-network"
              variant="secondary"
              shape="round"
              label={sh.pickAria}
              disabled={noteMode}
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              onClick={(e) => {
                anchor.current = e.currentTarget;
                setPickerOpen(true);
              }}
            />
          </span>
        </>
      ),
      chips: (
        <>
          {pendingView && (
            <div className="shx-pend">
              <ShareCardView view={pendingView} who={ctx.first} density="dock" />
              <IconButton icon="x" label={sh.pendingRemove} onClick={() => setPending(null)} />
            </div>
          )}
          <Chip
            icon="lock-simple"
            selected={noteMode}
            aria-pressed={noteMode}
            onClick={() => setNoteMode(!noteMode)}
          >
            {noteMode ? nt.nModeOn : nt.nModeOff}
          </Chip>
          {noteMode && <small className="shx-hint">{nt.nModeHint(ctx.first)}</small>}
        </>
      ),
      body,
      placeholder: noteMode ? nt.nModePlaceholder : pending ? sh.pendingPlaceholder : undefined,
      intercept,
      sent: () => {
        if (pending) rememberShare(pending);
        setPending(null);
      },
      barActions: (
        <Button
          variant="ghost"
          size="sm"
          icon="pencil-simple"
          aria-expanded={notesOpen}
          aria-label={nt.nButtonAria(notes.length)}
          onClick={(e) => {
            anchor.current = e.currentTarget;
            setNotesOpen(true);
          }}
        >
          {nt.nButton}
          <Badge n={notes.length} tone="neutral" anchor="none" />
        </Button>
      ),
      noteItems,
      card,
      shareDelete,
      overlay: (
        <>
          <SharePicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            anchorRef={anchor}
            viewer={viewer}
            who={ctx.first}
            inChat={sharesIn(ctx.messages)}
            port={opts.sharePort}
            initialQuery={opts.initial?.picker?.q}
            initialFilter={opts.initial?.picker?.filter}
            onAsk={(k) => askShare(k)}
            onPick={(r) => {
              setPending(r);
              setPickerOpen(false);
            }}
          />
          <LibraryPeek
            open={!!peek}
            onClose={() => setPeek(null)}
            target={peek}
            viewer={viewer}
            who={ctx.first}
            port={opts.sharePort}
          />
          <NotesHost
            open={notesOpen}
            onClose={() => {
              setNotesOpen(false);
              setHl(undefined);
            }}
            clientId={ctx.clientId}
            first={ctx.first}
            anchors={anchors}
            onJump={jump}
            highlightId={hl}
            initial={opts.initial?.notes}
            port={opts.notesPort}
          />
          {confirmNote && (
            <NoteDeleteDialog
              n={confirmNote}
              first={ctx.first}
              onCancel={() => setConfirmNote(null)}
              onConfirm={() => {
                notesStore.remove(confirmNote);
                setConfirmNote(null);
              }}
            />
          )}
          {flash && (
            <div className="shx-flash" onAnimationEnd={() => setFlash(null)}>
              <Snackbar position="inline" text={flash} icon="check-circle" />
            </div>
          )}
        </>
      ),
    };
  };
}

let global: Partial<CoachThreadExtrasOpts> = {};
/** Stories / tests / the future real adapters: the options every chat screen created by `ChatWithExtras` uses. */
export function configureThreadExtras(o: Partial<CoachThreadExtrasOpts> | null): void {
  global = o ?? {};
}
export const getThreadExtrasOpts = (): Partial<CoachThreadExtrasOpts> => global;
