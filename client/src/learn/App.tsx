/**
 * Learn — how-to videos inside the Spotter suite. Graphite + rubellite (gem).
 * Reuses the shared sub-app chrome (AppRail, .app-brand header, .apex-nav) like
 * the other apps; only the accent differs.
 *
 * - Role-gated: trainers/admins see their extra lessons; members never do.
 * - One global "cut" (phone/web) drives BOTH the player and every thumbnail's
 *   orientation. It defaults to the current view (mobile → portrait 9:16,
 *   desktop → landscape 16:9) and the Phone/Web switch flips it everywhere.
 * - Videos aren't shot yet → every lesson shows a "coming soon" state.
 * - Gym-style search + filter (wrapped, not a scroll strip); long lists are
 *   revealed progressively (lightweight virtualization).
 * - Localised UI via useLearnT.
 */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../ui';
import { AppRail } from '../components/AppRail';
import { NotificationsView } from '../views/NotificationsView';
import type { Notif, NotifState } from '../notifications';
import { useLearnT } from './i18n';
import {
  catalogForRole,
  lessonsForRole,
  lessonById,
  topicById,
  topicTitle,
  type Lesson,
  type Topic,
  type ViewerRole,
} from './catalog';

type Tab = 'home' | 'topics' | 'saved' | 'feed';
type Cut = 'phone' | 'web';

const SAVED_KEY = 'spotter.learn.saved';
const CUT_KEY = 'spotter.learn.cut';

function readSaved(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Global cut: defaults to the current view (desktop → web, phone → web-off). */
function useCut(): [Cut, (c: Cut) => void] {
  const [cut, setCut] = useState<Cut>(() => {
    try {
      const s = localStorage.getItem(CUT_KEY);
      if (s === 'phone' || s === 'web') return s;
    } catch {
      /* ignore */
    }
    const desktop =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(min-width: 720px)').matches;
    return desktop ? 'web' : 'phone';
  });
  useEffect(() => {
    try {
      localStorage.setItem(CUT_KEY, cut);
    } catch {
      /* ignore */
    }
  }, [cut]);
  return [cut, setCut];
}

/** Reveal items progressively as a sentinel scrolls into view (virtualization). */
function useReveal(total: number, step = 12): [number, (el: HTMLDivElement | null) => void] {
  const [n, setN] = useState(Math.min(step, total));
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!node || n >= total) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setN((x) => Math.min(total, x + step));
    });
    io.observe(node);
    return () => io.disconnect();
  }, [node, n, total, step]);
  return [n, setNode];
}

/** Thumbnail — real still when shot, else a placeholder; orientation = cut. */
function Thumb({ cut, variant }: { cut: Cut; variant: 'tile' | 'row' | 'lead' }) {
  const { L } = useLearnT();
  return (
    <div className={`ln-thumb ${variant} cut-${cut === 'phone' ? 'p' : 'w'}`}>
      <div className="ln-thumb-ph">
        <Icon name="graduation-cap" weight="fill" />
      </div>
      <div className="ln-thumb-scrim" />
      <span className="ln-soon-chip">
        <Icon name="clock" /> {L.soon}
      </span>
    </div>
  );
}

function Tile({ lesson, cut, onPlay }: { lesson: Lesson; cut: Cut; onPlay: (l: Lesson) => void }) {
  return (
    <button className="ln-card" onClick={() => onPlay(lesson)}>
      <Thumb cut={cut} variant="tile" />
      <div className="ln-card-title">{lesson.title}</div>
    </button>
  );
}

/** A virtualized grid of lesson tiles. */
function LessonGrid({
  lessons,
  cut,
  onPlay,
}: {
  lessons: Lesson[];
  cut: Cut;
  onPlay: (l: Lesson) => void;
}) {
  const [n, sentinel] = useReveal(lessons.length, 12);
  return (
    <>
      <div className="ln-grid">
        {lessons.slice(0, n).map((l) => (
          <Tile key={l.id} lesson={l} cut={cut} onPlay={onPlay} />
        ))}
      </div>
      {n < lessons.length && <div ref={sentinel} className="ln-sentinel" aria-hidden />}
    </>
  );
}

/** Search + filter toolbar (gym-style: search field + filter button + wrapped chips). */
function Toolbar({
  q,
  onQ,
  topics,
  active,
  onToggle,
  onClear,
}: {
  q: string;
  onQ: (v: string) => void;
  topics: Topic[];
  active: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const { L } = useLearnT();
  const [open, setOpen] = useState(false);
  const count = active.size;
  return (
    <div className="ln-toolbar">
      <div className="ln-toolrow">
        <label className="ln-search">
          <Icon name="magnifying-glass" />
          <input value={q} placeholder={L.search} onChange={(e) => onQ(e.target.value)} />
        </label>
        <button
          className={`ln-filter-btn${open || count ? ' on' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-label={L.filters}
        >
          <Icon name="funnel-simple" weight={count ? 'fill' : undefined} />
          {count > 0 && <span className="ln-filter-count">{count}</span>}
        </button>
      </div>
      {open && (
        <div className="ln-filters">
          <div className="ln-filter-head">
            <span>{L.filters}</span>
            {count > 0 && (
              <button className="ln-filter-clear" onClick={onClear}>
                {L.clear}
              </button>
            )}
          </div>
          <div className="ln-filter-chips">
            {topics.map((t) => (
              <button
                key={t.id}
                className={`ln-chip${active.has(t.id) ? ' on' : ''}`}
                onClick={() => onToggle(t.id)}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeScreen({
  topics,
  lessons,
  cut,
  onPlay,
}: {
  topics: Topic[];
  lessons: Lesson[];
  cut: Cut;
  onPlay: (l: Lesson) => void;
}) {
  const { L } = useLearnT();
  const [q, setQ] = useState('');
  const [active, setActive] = useState<Set<string>>(new Set());
  const first = lessons[0];

  const query = q.trim().toLowerCase();
  const filtering = query.length > 0 || active.size > 0;
  const results = useMemo(
    () =>
      lessons.filter(
        (l) =>
          (active.size === 0 || active.has(l.topic)) &&
          (query.length === 0 ||
            l.title.toLowerCase().includes(query) ||
            l.blurb.toLowerCase().includes(query)),
      ),
    [lessons, active, query],
  );

  const toggle = (id: string) =>
    setActive((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="ln-screen">
      <div className="ln-head">
        <h1>{L.howTo}</h1>
        <span className="ln-count">
          <span className="acc">0</span> / {lessons.length}
        </span>
      </div>

      <Toolbar
        q={q}
        onQ={setQ}
        topics={topics}
        active={active}
        onToggle={toggle}
        onClear={() => setActive(new Set())}
      />

      {filtering ? (
        <div className="ln-topic-block">
          <div className="ln-kicker">
            {L.results} · {results.length}
          </div>
          {results.length === 0 ? (
            <div className="ln-noresults">{L.noResults}</div>
          ) : (
            <LessonGrid lessons={results} cut={cut} onPlay={onPlay} />
          )}
        </div>
      ) : (
        <>
          {first && (
            <>
              <div className="ln-kicker">{L.continueLabel}</div>
              <button className="ln-continue" onClick={() => onPlay(first)}>
                <Thumb cut={cut} variant="lead" />
                <div className="ln-continue-main">
                  <div className="ln-lesson-tag">{topicTitle(first.topic)}</div>
                  <div className="ln-continue-title">{first.title}</div>
                  <div className="ln-continue-sub">
                    <Icon name="clock" /> {L.videoComingSoon}
                  </div>
                </div>
              </button>
            </>
          )}
          {topics.map((t) => (
            <div key={t.id} className="ln-topic-block">
              <div className="ln-kicker">
                {t.title} · {L.lessons(t.lessons.length)}
              </div>
              <LessonGrid lessons={t.lessons} cut={cut} onPlay={onPlay} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function TopicsScreen({
  topics,
  onOpenTopic,
}: {
  topics: Topic[];
  onOpenTopic: (t: Topic) => void;
}) {
  const { L } = useLearnT();
  return (
    <div className="ln-screen">
      <div className="ln-head">
        <h1>{L.topics}</h1>
      </div>
      <div className="ln-topics">
        {topics.map((t) => (
          <button key={t.id} className="ln-topic-row" onClick={() => onOpenTopic(t)}>
            <span className="ln-topic-ic">
              <Icon name={t.icon} weight="fill" />
            </span>
            <span className="ln-topic-text">
              <span className="ln-topic-name">{t.title}</span>
              <span className="ln-topic-desc">{t.blurb}</span>
              <span className="ln-topic-bar">
                <span style={{ width: '0%' }} />
              </span>
            </span>
            <span className="ln-topic-count">0/{t.lessons.length}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TopicDetail({
  topic,
  cut,
  onBack,
  onPlay,
}: {
  topic: Topic;
  cut: Cut;
  onBack: () => void;
  onPlay: (l: Lesson) => void;
}) {
  const { L } = useLearnT();
  return (
    <div className="ln-screen">
      <button className="ln-back" onClick={onBack}>
        <Icon name="caret-left" /> {L.topics}
      </button>
      <div className="ln-head">
        <h1>{topic.title}</h1>
        <span className="ln-count">{L.lessons(topic.lessons.length)}</span>
      </div>
      <LessonGrid lessons={topic.lessons} cut={cut} onPlay={onPlay} />
    </div>
  );
}

function SavedScreen({
  saved,
  lessons,
  cut,
  onPlay,
  onBrowse,
}: {
  saved: string[];
  lessons: Lesson[];
  cut: Cut;
  onPlay: (l: Lesson) => void;
  onBrowse: () => void;
}) {
  const { L } = useLearnT();
  const visibleIds = new Set(lessons.map((l) => l.id));
  const items = saved.map(lessonById).filter((l): l is Lesson => !!l && visibleIds.has(l.id));
  return (
    <div className="ln-screen">
      <div className="ln-head">
        <h1>{L.saved}</h1>
        {items.length > 0 && <span className="ln-count">{L.videos(items.length)}</span>}
      </div>
      {items.length === 0 ? (
        <div className="ln-empty">
          <span className="ln-empty-ic">
            <Icon name="bookmark-simple" />
          </span>
          <div className="ln-empty-title">{L.nothingSaved}</div>
          <div className="ln-empty-sub">{L.savedHint}</div>
          <button className="ln-pill" onClick={onBrowse}>
            <Icon name="compass" /> {L.browse}
          </button>
        </div>
      ) : (
        <div className="ln-saved-list">
          {items.map((l) => (
            <button key={l.id} className="ln-saved-row" onClick={() => onPlay(l)}>
              <Thumb cut={cut} variant="row" />
              <span className="ln-saved-text">
                <span className="ln-saved-title">{l.title}</span>
                <span className="ln-saved-meta">
                  {topicTitle(l.topic)} · {L.videoComingSoon.toLowerCase()}
                </span>
              </span>
              <Icon name="bookmark-simple" weight="fill" className="ln-saved-mark" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Player({
  lesson,
  lessons,
  cut,
  setCut,
  saved,
  onToggleSave,
  onBack,
  onPlay,
}: {
  lesson: Lesson;
  lessons: Lesson[];
  cut: Cut;
  setCut: (c: Cut) => void;
  saved: boolean;
  onToggleSave: () => void;
  onBack: () => void;
  onPlay: (l: Lesson) => void;
}) {
  const { L } = useLearnT();
  const topic = topicById(lesson.topic)!;
  const upNext = lessons.filter((l) => l.topic === lesson.topic && l.id !== lesson.id).slice(0, 3);

  return (
    <div className="ln-player">
      <button className="ln-back" onClick={onBack}>
        <Icon name="caret-left" /> {topic.title}
      </button>

      <div className={`ln-stage cut-${cut === 'phone' ? 'p' : 'w'}`}>
        <div className="ln-stage-inner">
          <span className="ln-stage-ic">
            <Icon name="graduation-cap" weight="fill" />
          </span>
          <div className="ln-stage-title">{L.comingSoonTitle}</div>
          <div className="ln-stage-sub">{L.comingSoonBody}</div>
        </div>
      </div>

      <div className="ln-meta">
        <div className="ln-lesson-tag">{topic.title}</div>
        <div className="ln-meta-title">{lesson.title}</div>
        <div className="ln-meta-desc">{lesson.blurb}</div>

        <div className="ln-cutrow">
          <div className="ln-switch">
            <button
              className={`ln-switch-opt${cut === 'phone' ? ' on' : ''}`}
              onClick={() => setCut('phone')}
            >
              <Icon name="device-mobile" weight={cut === 'phone' ? 'fill' : undefined} /> {L.phone}
            </button>
            <button
              className={`ln-switch-opt${cut === 'web' ? ' on' : ''}`}
              onClick={() => setCut('web')}
            >
              <Icon name="monitor" weight={cut === 'web' ? 'fill' : undefined} /> {L.web}
            </button>
          </div>
          <button className={`ln-pill sm${saved ? ' on' : ''}`} onClick={onToggleSave}>
            <Icon name="bookmark-simple" weight={saved ? 'fill' : undefined} />
            {saved ? L.savedDone : L.save}
          </button>
        </div>

        {upNext.length > 0 && (
          <>
            <div className="ln-kicker up">{L.upNext}</div>
            <div className="ln-saved-list">
              {upNext.map((l) => (
                <button key={l.id} className="ln-saved-row" onClick={() => onPlay(l)}>
                  <Thumb cut={cut} variant="row" />
                  <span className="ln-saved-text">
                    <span className="ln-saved-title">{l.title}</span>
                    <span className="ln-saved-meta">{L.videoComingSoon.toLowerCase()}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function LearnRoot({
  now,
  role,
  onOpenShell,
  onOpenProfile,
  notifs,
  notifState,
  notifUnread,
  onNotifSeen,
  onNotifMarkAll,
}: {
  now: number;
  role: ViewerRole;
  onOpenShell: () => void;
  onOpenProfile: () => void;
  notifs: Notif[];
  notifState: NotifState;
  notifUnread: number;
  onNotifSeen: (ids: string[]) => void;
  onNotifMarkAll: () => void;
}) {
  const { L } = useLearnT();
  const [tab, setTab] = useState<Tab>('home');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [playing, setPlaying] = useState<Lesson | null>(null);
  const [saved, setSaved] = useState<string[]>(() => readSaved());
  const [cut, setCut] = useCut();

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  }, [saved]);

  // Role-visible catalog — trainer/admin lessons never leak to members.
  const topics = useMemo(() => catalogForRole(role), [role]);
  const lessons = useMemo(() => lessonsForRole(role), [role]);

  const toggleSave = (id: string) =>
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [id, ...s]));

  const openPlayer = (l: Lesson) => setPlaying(l);

  const nav = useMemo(
    () => [
      { id: 'home', icon: 'play-circle', label: L.home },
      { id: 'topics', icon: 'stack', label: L.topics },
      { id: 'saved', icon: 'bookmark-simple', label: L.saved },
    ],
    [L],
  );

  function goTab(id: Tab) {
    setPlaying(null);
    setTopic(null);
    setTab(id);
  }

  return (
    <div className="app-learn apex-app">
      <AppRail
        nav={nav}
        activeId={playing || tab === 'feed' ? null : tab}
        onNav={(id) => goTab(id as Tab)}
        onOpenShell={onOpenShell}
        onOpenNotifications={() => {
          setPlaying(null);
          setTab('feed');
        }}
        onOpenProfile={onOpenProfile}
        notifUnread={notifUnread}
      />
      <div className="apex-col">
        <header className="app-brand apex-head">
          <div className="app-brand-lead">
            <span className="app-brand-word">spotter</span>
            <button className="app-brand-app" onClick={onOpenShell} aria-label={L.apps}>
              {L.app}
            </button>
          </div>
          <div className="app-brand-actions">
            <button
              className="app-bell"
              onClick={() => {
                setPlaying(null);
                setTab('feed');
              }}
              aria-label={L.notifications}
            >
              <Icon
                name="bell"
                weight={tab === 'feed' ? 'fill' : undefined}
                className="app-brand-icon"
              />
              {notifUnread > 0 && tab !== 'feed' && (
                <span className="app-bell-badge">{notifUnread > 9 ? '9+' : notifUnread}</span>
              )}
            </button>
          </div>
        </header>

        <div className="apex-body">
          {playing ? (
            <div className="apex-scroll">
              <Player
                lesson={playing}
                lessons={lessons}
                cut={cut}
                setCut={setCut}
                saved={saved.includes(playing.id)}
                onToggleSave={() => toggleSave(playing.id)}
                onBack={() => setPlaying(null)}
                onPlay={openPlayer}
              />
            </div>
          ) : tab === 'feed' ? (
            <NotificationsView
              embedded
              title={L.notifications}
              notifs={notifs}
              now={now}
              state={notifState}
              onSeen={onNotifSeen}
              onMarkAll={onNotifMarkAll}
              onClose={() => setTab('home')}
            />
          ) : (
            <div className="apex-scroll">
              {tab === 'home' && (
                <HomeScreen topics={topics} lessons={lessons} cut={cut} onPlay={openPlayer} />
              )}
              {tab === 'topics' &&
                (topic ? (
                  <TopicDetail
                    topic={topic}
                    cut={cut}
                    onBack={() => setTopic(null)}
                    onPlay={openPlayer}
                  />
                ) : (
                  <TopicsScreen topics={topics} onOpenTopic={setTopic} />
                ))}
              {tab === 'saved' && (
                <SavedScreen
                  saved={saved}
                  lessons={lessons}
                  cut={cut}
                  onPlay={openPlayer}
                  onBrowse={() => goTab('home')}
                />
              )}
            </div>
          )}
        </div>

        <nav className="apex-nav" role="tablist">
          {nav.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={!playing && tab === x.id}
              className={!playing && tab === x.id ? 'active' : ''}
              onClick={() => goTab(x.id as Tab)}
            >
              <Icon name={x.icon} weight={!playing && tab === x.id ? 'fill' : undefined} />
              <span>{x.label}</span>
            </button>
          ))}
          <button className="apex-nav-apps" onClick={onOpenShell} aria-label={L.apps}>
            <Icon name="squares-four" />
            <span>{L.apps}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
