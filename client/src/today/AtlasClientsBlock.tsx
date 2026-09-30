/**
 * Today's "Atlas & clients" core block (designs A1 variants, A2 settings,
 * T5 strip). One block, shaped by its settings:
 *
 *  - Together (A): one stories strip — Atlas first (coral ring + unread
 *    count), a hairline, then clients by ring state, then "+N more".
 *  - Split (B): Atlas in his chosen view — note of the day (C), quick chat (D),
 *    compact row (E) or that row only while a note is unread — then the
 *    clients section (header, "Live now", stories or list F), in either order.
 *    With a main column ≥ 720px the two sit side by side (desktop frame).
 *  - Without clients (members; admins/trainers with none): Atlas alone, in his
 *    chosen view; "compact" is the full-width solo row (T5 A).
 *
 * Everything shown is real: Atlas's notes feed (buildNotes, read state =
 * coach.readAt), his temper, the on-device chat log; the roster call and the
 * realtime live-sessions feed for clients.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { setCoach, useStore } from '../store';
import { fmtClock, useT } from '../i18n';
import type { Strings } from '../i18n/en';
import { useAtlasFmt, useAtlasNotes, useMinuteClock, type AtlasNote } from '../atlas/notes';
import type { Fmt } from '../atlas/voice';
import { useChatLog } from '../atlas/chatLog';
import { temperIndex, type Temper } from '../atlas/types';
import { classifyTrainee } from '../trainerLive';
import type { LiveSession } from '../types';
import { AtlasFace } from '../components/AtlasFace';
import { Avatar } from '../components/Avatar';
import { Button, IconButton } from '../components/ui/Button';
import { Chip, ChipGroup, type ChipTone } from '../components/ui/Chip';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { ToneText } from '../components/ui/ToneText';
import {
  STORY_FACE_PX,
  StoryBubble,
  StoryDivider,
  StoryRow,
  type StoryRing,
  type StorySize,
} from '../components/ui/StoryBubble';
import { Icon } from '../ui';
import { atlasStarterChips, topNote } from './widgets/learnatlas';
import { useClientRoster, type RosterClient } from './clientRoster';
import type { AtlasOpts, AtlasView } from './layout';
import { Card } from '../components/ui/Card';

const DAY = 86_400_000;
const INACTIVE_MS = 30 * DAY;
const FRESH_MS = 2 * DAY;
/** Bubbles before "+N more": the strip scrolls; the split row fits a phone. */
const MAX_STRIP = 12;
const MAX_SPLIT_STORIES = 4;
/** Desktop grid tiles before "+N more". */
const MAX_GRID = 5;
/** Main column width from which Split goes side by side. */
const WIDE_PX = 720;

export interface AtlasClientsProps {
  opts: AtlasOpts;
  /** This role coaches people (admin / trainer) — look up the roster. */
  withClients: boolean;
  onOpenCoach: () => void;
  onOpenClient: (id: string) => void;
  /** Watch a client's live session. */
  onWatch: (s: LiveSession) => void;
  /** The Clients area ("All ›", "+N more"). */
  onAllClients: () => void;
}

export function AtlasClientsBlock(p: AtlasClientsProps) {
  const roster = useClientRoster(p.withClients);
  const hasClients = (roster?.length ?? 0) > 0;
  if (!hasClients) return <AtlasAlone view={p.opts.atlasView} onOpen={p.onOpenCoach} />;
  if (p.opts.layout === 'together') return <Together {...p} roster={roster!} />;
  return <Split {...p} roster={roster!} />;
}

/* ───────────────────────── Atlas data ───────────────────────── */

interface AtlasToday {
  on: boolean;
  temper: Temper;
  unread: number;
  /** The note of the day: the most important unread one, else today's. */
  note: AtlasNote | null;
  /** The newest unread note, else the newest one. */
  latest: AtlasNote | null;
}

function useAtlasToday(): AtlasToday {
  const { coach } = useStore();
  const { notes, temper, unread } = useAtlasNotes();
  const now = useMinuteClock();
  return useMemo(() => {
    const fresh = notes.filter((n) => n.at > coach.readAt);
    const today = notes.filter((n) => n.at > now - DAY);
    const last = <T,>(a: T[]): T | null => a[a.length - 1] ?? null;
    return {
      on: coach.enabled,
      temper: coach.enabled ? temper : 3,
      unread: coach.enabled ? unread : 0,
      note: topNote(fresh) ?? last(fresh) ?? topNote(today),
      latest: last(fresh) ?? last(notes),
    };
  }, [notes, temper, unread, coach.enabled, coach.readAt, now]);
}

/** Small facts under the note (only for notes that carry numbers). */
function noteTags(n: AtlasNote, fmt: Fmt): { text: string; tone: ChipTone; icon?: string }[] {
  const f = n.fact;
  switch (f.kind) {
    case 'pr':
      return [
        { text: `${fmt.exercise(f.exercise)} ${fmt.kg(f.weight)}`, tone: 'ok', icon: 'arrow-up' },
      ];
    case 'imbalance':
      return [
        {
          text: `${fmt.muscle(f.low)} / ${fmt.muscle(f.high)} ${(f.lowSets / Math.max(1, f.highSets)).toFixed(1)}`,
          tone: 'danger',
        },
      ];
    case 'stall':
      return [{ text: `${fmt.exercise(f.exercise)} · ${fmt.kg(f.weight)}`, tone: 'accent' }];
    case 'bodyweight':
      return [
        {
          text: `${fmt.kg(f.kg)} · ${f.deltaPct > 0 ? '+' : ''}${f.deltaPct.toFixed(1)}%`,
          tone: 'neutral',
        },
      ];
    default:
      return [];
  }
}

const face = (temper: Temper, size: StorySize) => (
  <AtlasFace temper={temper} size={STORY_FACE_PX[size]} ring={false} />
);

function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="tac-count">{n > 9 ? '9+' : n}</span>;
}

/* ───────────────────────── Atlas views ───────────────────────── */

/** Atlas without a clients section: his view, full width. */
function AtlasAlone({ view, onOpen }: { view: AtlasView; onOpen: () => void }) {
  const a = useAtlasToday();
  if (view === 'auto' && !(a.on && a.unread > 0)) return null;
  if (!a.on || view === 'compact' || view === 'auto') return <AtlasSolo a={a} onOpen={onOpen} />;
  return <AtlasCard view={view} a={a} onOpen={onOpen} wide={false} />;
}

/** T5 A: the full-width solo row — face, name + temper, the latest note in
 *  two lines, the unread count (or the invite while Atlas is off). */
function AtlasSolo({ a, onOpen }: { a: AtlasToday; onOpen: () => void }) {
  const { t } = useT();
  return (
    <div className="tac-band">
      <Card
        as="button"
        pad="none"
        emphasis="quiet"
        className="tac-solo"
        onClick={onOpen}
        aria-label={a.on ? (a.unread ? t.atlasStoryUnread(a.unread) : t.atlasName) : t.atlasInvite}
      >
        <StoryBubble
          size="lg"
          ring={a.on && a.unread ? 'atlas' : 'default'}
          media={face(a.temper, 'lg')}
        />
        <span className="tac-solo-text">
          <span className="tac-solo-name">
            {t.atlasName}
            {a.on && (
              <span className="tac-solo-temper"> · {t.atlasTemper[temperIndex(a.temper)]}</span>
            )}
          </span>
          <span className="tac-solo-line">
            {a.on ? (a.latest?.text ?? t.atlasEmpty) : t.atlasInviteLine}
          </span>
        </span>
        {a.on && a.unread > 0 ? (
          <Count n={a.unread} />
        ) : (
          <Icon name="caret-right" className="tac-go" />
        )}
      </Card>
    </div>
  );
}

/** Split's Atlas: the chosen view. Null = nothing to show (auto, no notes). */
function AtlasCard({
  view,
  a,
  onOpen,
  wide,
}: {
  view: AtlasView;
  a: AtlasToday;
  onOpen: () => void;
  wide: boolean;
}) {
  if (view === 'auto' && !(a.on && a.unread > 0)) return null;
  const cls = `tac-atlas${wide ? ' is-card' : ''}`;
  if (!a.on || view === 'compact' || view === 'auto')
    return <AtlasCompact a={a} onOpen={onOpen} cls={cls} />;
  if (view === 'chat') return <AtlasChat a={a} onOpen={onOpen} cls={cls} />;
  return <AtlasNoteCard a={a} onOpen={onOpen} cls={cls} wide={wide} />;
}

/** E: face + "Atlas · latest note" in one line + count + chevron. */
function AtlasCompact({ a, onOpen, cls }: { a: AtlasToday; onOpen: () => void; cls: string }) {
  const { t } = useT();
  return (
    <Card as="button" pad="none" emphasis="quiet" className={`${cls} tac-compact`} onClick={onOpen}>
      <StoryBubble size="xs" ring="atlas" media={face(a.temper, 'xs')} />
      <span className="tac-compact-line">
        <b>{t.atlasName}</b>
        {' · '}
        {a.on ? (a.latest?.text ?? t.atlasEmpty) : t.atlasInvite}
      </span>
      <Count n={a.unread} />
      <Icon name="caret-right" className="tac-go" />
    </Card>
  );
}

/** The header shared by the note and chat views. */
function AtlasHead({
  a,
  size,
  sub,
  subTone,
  trailing,
  onOpen,
}: {
  a: AtlasToday;
  size: StorySize;
  sub: ReactNode;
  subTone?: 'ok';
  trailing?: ReactNode;
  onOpen: () => void;
}) {
  const { t } = useT();
  return (
    <div className="tac-head">
      <StoryBubble
        size={size}
        ring="atlas"
        media={face(a.temper, size)}
        onClick={onOpen}
        aria-label={t.todayAtlasOpenChat}
      />
      <div className="tac-head-who">
        <div className="tac-head-name">
          <span>{t.atlasName}</span>
          {size === 'sm' && (
            <span className="tac-temper">{t.atlasTemper[temperIndex(a.temper)]}</span>
          )}
        </div>
        <div className={`tac-head-sub${subTone ? ` is-${subTone}` : ''}`}>{sub}</div>
      </div>
      {trailing}
    </div>
  );
}

/** C: note of the day — kicker, the note, its numbers, Reply / Got it. */
function AtlasNoteCard({
  a,
  onOpen,
  cls,
  wide,
}: {
  a: AtlasToday;
  onOpen: () => void;
  cls: string;
  wide: boolean;
}) {
  const { t } = useT();
  const fmt = useAtlasFmt();
  const n = a.note;
  if (!n)
    return (
      <section className={`${cls} tac-note`}>
        <AtlasHead a={a} size="sm" sub={t.todayAtlasCalm} onOpen={onOpen} />
        {wide && <AskMore onOpen={onOpen} />}
      </section>
    );
  const meta = [fmtClock(n.at), a.unread > 0 ? t.todayAtlasUnread(a.unread) : null]
    .filter(Boolean)
    .join(' · ');
  const tags = noteTags(n, fmt);
  return (
    <section className={`${cls} tac-note`}>
      <AtlasHead a={a} size="sm" sub={meta} trailing={<Count n={a.unread} />} onOpen={onOpen} />
      <div className="tac-kicker">{t.todayAtlasView.note}</div>
      <p className="tac-note-text">{n.text}</p>
      {tags.length > 0 && (
        <ChipGroup className="tac-tags">
          {tags.map((g) => (
            <Chip key={g.text} size="sm" tone={g.tone} icon={g.icon}>
              {g.text}
            </Chip>
          ))}
        </ChipGroup>
      )}
      <div className="tac-actions">
        <Button variant="primary" size="sm" onClick={onOpen}>
          {t.todayAtlasReply}
        </Button>
        {a.unread > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setCoach({ readAt: Date.now() })}>
            {t.todayAtlasGotIt}
          </Button>
        )}
      </div>
      {wide && <AskMore onOpen={onOpen} />}
    </section>
  );
}

/** Desktop note of the day: quick replies + the ask field under a hairline. */
function AskMore({ onOpen }: { onOpen: () => void }) {
  const chips = useQuickReplies();
  return (
    <>
      <hr className="tac-rule" />
      <ReplyChips chips={chips} onOpen={onOpen} wrap />
      <AskField onOpen={onOpen} />
    </>
  );
}

/** The last Atlas chat message's follow-ups, else starter questions from the log. */
function useQuickReplies(): string[] {
  const { workouts } = useStore();
  const { locale } = useT();
  const log = useChatLog();
  return useMemo(() => {
    const last = [...log].reverse().find((m) => m.from === 'atlas' && !m.notice && !m.pending);
    if (last?.chips?.length) return last.chips.slice(0, 3);
    return atlasStarterChips(workouts, locale).slice(0, 3);
  }, [log, workouts, locale]);
}

function ReplyChips({
  chips,
  onOpen,
  wrap,
}: {
  chips: string[];
  onOpen: () => void;
  wrap?: boolean;
}) {
  return (
    <div className={`tac-replies${wrap ? ' is-wrap' : ''}`}>
      {chips.map((c) => (
        <Chip key={c} tone="atlas" onClick={onOpen}>
          {c}
        </Chip>
      ))}
    </div>
  );
}

/** "Ask Atlas…" with mic and send — a field-shaped door into the chat (the
 *  chat has no prefill, so every part opens it). */
function AskField({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  return (
    <Card as="button" pad="none" emphasis="quiet" className="tac-ask" onClick={onOpen}>
      <span className="tac-ask-text">{t.todayAtlasAsk}</span>
      <span className="tac-ask-mic" aria-hidden>
        <Icon name="microphone" />
      </span>
      <span className="tac-ask-send" aria-hidden>
        <Icon name="arrow-up" />
      </span>
    </Card>
  );
}

/** D: quick chat — Atlas's last message, three replies, the ask field. */
function AtlasChat({ a, onOpen, cls }: { a: AtlasToday; onOpen: () => void; cls: string }) {
  const { t } = useT();
  const log = useChatLog();
  const chips = useQuickReplies();
  const msg = useMemo(() => {
    const m = [...log].reverse().find((x) => x.from === 'atlas' && !x.notice && !x.pending);
    if (m) return { text: m.text, at: m.at as number | null };
    // No chat yet: what he last wrote in his notes.
    if (a.latest) return { text: a.latest.text, at: a.latest.at as number | null };
    return { text: t.atlasEmpty, at: null };
  }, [log, a.latest, t.atlasEmpty]);
  return (
    <section className={`${cls} tac-chat`}>
      <AtlasHead
        a={a}
        size="xs"
        sub={
          <>
            <i className="tac-online" aria-hidden />
            {t.todayAtlasOnline}
          </>
        }
        subTone="ok"
        onOpen={onOpen}
        trailing={
          <IconButton
            icon="corners-out"
            size="sm"
            label={t.todayAtlasOpenChat}
            onClick={onOpen}
            className="tac-expand"
          />
        }
      />
      <Card as="button" pad="none" emphasis="quiet" className="tac-bubble-wrap" onClick={onOpen}>
        <span className="tac-bubble">{msg.text}</span>
        {msg.at !== null && <span className="tac-bubble-time">{fmtClock(msg.at)}</span>}
      </Card>
      <ReplyChips chips={chips} onOpen={onOpen} />
      <AskField onOpen={onOpen} />
    </section>
  );
}

/* ───────────────────────── Clients ───────────────────────── */

interface ClientVM {
  c: RosterClient;
  live: LiveSession | null;
  ring: StoryRing;
}

function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/** Clients with their live session and ring, filtered and ordered by the options. */
function useClients(roster: RosterClient[], opts: AtlasOpts, now: number): ClientVM[] {
  const liveTrainees = useStore().liveTrainees;
  return useMemo(() => {
    const live = new Map<string, LiveSession>();
    for (const s of liveTrainees) if (classifyTrainee(s, now) === 'live') live.set(s.id, s);
    const vms: ClientVM[] = roster.map((c) => {
      const ls = live.get(c.id) ?? null;
      const ring: StoryRing = ls
        ? 'live'
        : c.dormantDays !== null
          ? 'alert'
          : c.lastSessionAt !== null && now - c.lastSessionAt < FRESH_MS
            ? 'new'
            : 'default';
      return { c, live: ls, ring };
    });
    const shown = opts.hideInactive
      ? vms.filter(
          (v) => v.live || (v.c.lastSessionAt !== null && now - v.c.lastSessionAt < INACTIVE_MS),
        )
      : vms;
    // Anyone training now leads; then most-recently-trained first, never-trained last.
    return [...shown].sort((a, b) => {
      if (opts.liveFirst) {
        const d = (b.live ? 1 : 0) - (a.live ? 1 : 0);
        if (d) return d;
      }
      return (b.c.lastSessionAt ?? 0) - (a.c.lastSessionAt ?? 0);
    });
  }, [roster, liveTrainees, now, opts.hideInactive, opts.liveFirst]);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function avatar(c: RosterClient, size: StorySize) {
  return (
    <Avatar
      userId={c.id}
      name={c.name}
      hasPhoto={c.avatar}
      rev={c.avatarRev ?? 0}
      size={STORY_FACE_PX[size]}
    />
  );
}

function liveMinutes(s: LiveSession, now: number): number {
  return Math.max(0, Math.floor((now - s.startedAt) / 60_000));
}

/** One status line per client, from what the roster and live feed know. */
function status(v: ClientVM, now: number, t: Strings): { text: string; tone?: 'ok' | 'danger' } {
  if (v.live) {
    const gym = v.live.gymName ? ` · ${v.live.gymName}` : '';
    return {
      text: `${t.todayClientLive} · ${liveMinutes(v.live, now)} ${t.minShort}${gym}`,
      tone: 'ok',
    };
  }
  const at = v.c.lastSessionAt;
  if (at === null) return { text: t.todayClientNever };
  const days = Math.floor((now - at) / DAY);
  if (v.c.dormantDays !== null) return { text: t.todayClientAgo(days), tone: 'danger' };
  // The roster counts the last 7 rolling days, not the calendar week.
  const week = v.c.weekSessions ? ` · ${t.todayClientsIn7d(v.c.weekSessions)}` : '';
  return { text: `${days === 0 ? t.todayClientToday : t.todayClientAgo(days)}${week}` };
}

function bubble(v: ClientVM, size: StorySize, onOpen: (id: string) => void) {
  return (
    <StoryBubble
      key={v.c.id}
      size={size}
      ring={v.ring}
      media={avatar(v.c, size)}
      badge={v.ring === 'alert' ? '!' : undefined}
      label={firstName(v.c.name)}
      onClick={() => onOpen(v.c.id)}
      aria-label={v.c.name}
    />
  );
}

/** A: one strip — Atlas, hairline, clients, "+N more". */
function Together(p: AtlasClientsProps & { roster: RosterClient[] }) {
  const { t } = useT();
  const a = useAtlasToday();
  const now = useNow(30_000);
  const clients = useClients(p.roster, p.opts, now);
  const shown = clients.slice(0, MAX_STRIP);
  const rest = clients.length - shown.length;
  return (
    <div className="tac-band">
      <StoryRow className="tac-strip">
        <StoryBubble
          size="lg"
          ring={a.on ? 'atlas' : 'default'}
          media={face(a.temper, 'lg')}
          badge={a.unread}
          label={t.atlasName}
          onClick={p.onOpenCoach}
          aria-label={!a.on ? t.atlasInvite : a.unread ? t.atlasStoryUnread(a.unread) : t.atlasName}
        />
        <StoryDivider />
        {shown.map((v) => bubble(v, 'lg', p.onOpenClient))}
        {rest > 0 && <StoryBubble more={rest} label={t.todayMore} onClick={p.onAllClients} />}
      </StoryRow>
    </div>
  );
}

/** Main-column width ≥ 720px (measured, not the window). */
function useWide(ref: RefObject<HTMLElement | null>): boolean {
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const host = (el.closest('.pane-main') as HTMLElement | null) ?? el;
    const measure = () => setWide(host.clientWidth >= WIDE_PX);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [ref]);
  return wide;
}

/** B: Atlas block and Clients block, stacked (phone) or side by side (wide). */
function Split(p: AtlasClientsProps & { roster: RosterClient[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const wide = useWide(ref);
  const a = useAtlasToday();
  const atlas = <AtlasCard view={p.opts.atlasView} a={a} onOpen={p.onOpenCoach} wide={wide} />;
  const clients = <Clients {...p} wide={wide} />;
  const clientsFirst = p.opts.order === 'clients';
  return (
    <div
      ref={ref}
      className={`tac-split${wide ? ' is-wide' : ''}${clientsFirst ? ' is-clients-first' : ''}`}
    >
      {clientsFirst ? (
        <>
          {clients}
          {atlas}
        </>
      ) : (
        <>
          {atlas}
          {clients}
        </>
      )}
    </div>
  );
}

function Clients(p: AtlasClientsProps & { roster: RosterClient[]; wide: boolean }) {
  const { t } = useT();
  const now = useNow(30_000);
  const clients = useClients(p.roster, p.opts, now);
  const total = p.roster.length;
  const list = p.opts.clientsView === 'list' && !p.wide;
  // "Live now" cards lead the stories / grid; the phone list leads with live rows.
  const liveCards = p.opts.liveFirst && !list ? clients.filter((v) => v.live) : [];
  const rest = liveCards.length ? clients.filter((v) => !v.live) : clients;
  const liveN = clients.filter((v) => v.live).length;
  const alertN = clients.filter((v) => v.ring === 'alert').length;

  const all = (label: string) => (
    <Button variant="link" iconTrailing="caret-right" onClick={p.onAllClients}>
      {label}
    </Button>
  );

  let body: ReactNode;
  if (p.wide) {
    const tiles = rest.slice(0, MAX_GRID);
    const more = rest.length - tiles.length;
    body = (
      <div className="tac-grid">
        {tiles.map((v) => {
          const st = status(v, now, t);
          return (
            <Card
              as="button"
              pad="none"
              key={v.c.id}
              className={`tac-tile${v.ring === 'alert' ? ' is-alert' : ''}`}
              onClick={() => (v.live ? p.onWatch(v.live) : p.onOpenClient(v.c.id))}
            >
              <StoryBubble
                size="sm"
                ring={v.ring}
                media={avatar(v.c, 'sm')}
                badge={v.ring === 'alert' ? '!' : undefined}
              />
              <span className="tac-tile-text">
                <span className="tac-tile-name">{v.c.name}</span>
                <span className="tac-tile-sub">
                  {st.tone ? <ToneText tone={st.tone}>{st.text}</ToneText> : st.text}
                </span>
              </span>
            </Card>
          );
        })}
        {more > 0 && (
          <Button variant="secondary" size="sm" iconTrailing="caret-right" onClick={p.onAllClients}>
            {t.todayMoreN(more)}
          </Button>
        )}
      </div>
    );
  } else if (list) {
    body = (
      <GroupedList label={t.todayClientsHead(total)}>
        {rest.map((v) => {
          const st = status(v, now, t);
          const lead = (
            <StoryBubble
              size="sm"
              ring={v.ring}
              media={avatar(v.c, 'sm')}
              badge={v.ring === 'alert' ? '!' : undefined}
            />
          );
          const sub = st.tone ? <ToneText tone={st.tone}>{st.text}</ToneText> : st.text;
          return v.live ? (
            <ListRow
              key={v.c.id}
              className="tac-row is-live"
              icon={lead}
              label={v.c.name}
              sub={sub}
              trailing={
                <Button variant="primary" size="sm" onClick={() => p.onWatch(v.live!)}>
                  {t.todayWatch}
                </Button>
              }
            />
          ) : (
            <ListRow
              key={v.c.id}
              className="tac-row"
              icon={lead}
              label={v.c.name}
              sub={sub}
              chevron
              onClick={() => p.onOpenClient(v.c.id)}
              aria-label={v.c.name}
            />
          );
        })}
      </GroupedList>
    );
  } else {
    const shown = rest.slice(0, MAX_SPLIT_STORIES);
    const more = rest.length - shown.length;
    body = (
      <StoryRow className="tac-stories">
        {shown.map((v) => bubble(v, 'md', p.onOpenClient))}
        {more > 0 && (
          <StoryBubble size="md" more={more} label={t.todayMore} onClick={p.onAllClients} />
        )}
      </StoryRow>
    );
  }

  return (
    <section className="tac-clients" aria-label={t.todayClientsHead(clients.length)}>
      <div className="tac-sec-head">
        {/* the count follows what's shown (hide-inactive can drop some) */}
        <span>{t.todayClientsHead(clients.length)}</span>
        {list ? (
          <span className="tac-sec-stats">
            {liveN > 0 && <span className="is-live">● {t.todayClientsLiveN(liveN)}</span>}
            {alertN > 0 && <span className="is-alert">● {t.todayClientsAlertsN(alertN)}</span>}
          </span>
        ) : (
          all(p.wide ? t.todayClientsAllClients : t.todayClientsAll)
        )}
      </div>
      {liveCards.map((v) => (
        <LiveCard key={v.c.id} v={v} now={now} onWatch={p.onWatch} />
      ))}
      {rest.length > 0 && body}
      {list && (
        <Button variant="secondary" fullWidth iconTrailing="caret-right" onClick={p.onAllClients}>
          {t.todayClientsAllN(total)}
        </Button>
      )}
    </section>
  );
}

/** "Live now": who, for how long, where — Watch opens their session. */
function LiveCard({
  v,
  now,
  onWatch,
}: {
  v: ClientVM;
  now: number;
  onWatch: (s: LiveSession) => void;
}) {
  const { t } = useT();
  const s = v.live!;
  const sub = [
    `${liveMinutes(s, now)} ${t.minShort}`,
    s.exerciseCount ? t.trLiveExercisesIn(s.exerciseCount) : null,
    s.gymName ?? null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="tac-live">
      <StoryBubble size="sm" ring="live" media={avatar(v.c, 'sm')} />
      <div className="tac-live-main">
        <div className="tac-live-kick">
          <i aria-hidden />
          {t.todayLiveNow}
        </div>
        <div className="tac-live-name">{v.c.name}</div>
        <div className="tac-live-sub">{sub}</div>
      </div>
      <Button variant="primary" size="sm" onClick={() => onWatch(s)}>
        {t.todayWatch}
      </Button>
    </div>
  );
}
