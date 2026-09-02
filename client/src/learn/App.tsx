/**
 * Learn — the how-to video app inside the Spotter suite. Graphite + rubellite
 * ("gem") accent. Reuses the shared sub-app chrome (AppRail desktop rail,
 * .app-brand header, .apex-nav bottom nav) exactly like Apex / People /
 * Nutrition, so it stays consistent; only the accent ramp differs.
 *
 * Videos are not shot yet, so every lesson shows a "video coming soon" state:
 * thumbnails carry a Soon badge, the player shows a coming-soon panel, and the
 * Phone/Web switch is inert. The catalog (learn/catalog.ts) drives everything.
 */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../ui';
import { AppRail } from '../components/AppRail';
import { NotificationsView } from '../views/NotificationsView';
import type { Notif, NotifState } from '../notifications';
import {
  CATALOG,
  ALL_LESSONS,
  LESSON_COUNT,
  lessonById,
  topicById,
  topicTitle,
  type Lesson,
  type Topic,
} from './catalog';

type Tab = 'home' | 'topics' | 'saved' | 'feed';

const SAVED_KEY = 'spotter.learn.saved';

function readSaved(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function writeSaved(ids: string[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
}

/** A thumbnail tile — real still when shot, otherwise a graphite placeholder.
 *  Always carries the "Soon" marker until the lesson is recorded. */
function Thumb({ lesson, ratio }: { lesson: Lesson; ratio: '9/16' | '16/9' }) {
  return (
    <div className={`ln-thumb r-${ratio === '9/16' ? 'p' : 'w'}`}>
      {lesson.thumb ? (
        <img src={lesson.thumb} alt="" loading="lazy" />
      ) : (
        <div className="ln-thumb-ph">
          <Icon name="graduation-cap" weight="fill" />
        </div>
      )}
      <div className="ln-thumb-scrim" />
      <span className="ln-soon-chip">
        <Icon name="clock" /> Soon
      </span>
    </div>
  );
}

/** Home — "How to Spotter": continue card, topic chips, per-topic grids. */
function HomeScreen({ onPlay }: { onPlay: (l: Lesson) => void }) {
  const first = ALL_LESSONS[0];
  const [chip, setChip] = useState<'all' | Topic['id']>('all');
  const shownTopics = chip === 'all' ? CATALOG : CATALOG.filter((t) => t.id === chip);

  return (
    <div className="ln-screen">
      <div className="ln-head">
        <h1>How to Spotter</h1>
        <span className="ln-count">
          <span className="acc">0</span> / {LESSON_COUNT}
        </span>
      </div>

      <div className="ln-kicker">Continue</div>
      <button className="ln-continue" onClick={() => onPlay(first)}>
        <Thumb lesson={first} ratio="9/16" />
        <div className="ln-continue-main">
          <div className="ln-lesson-tag">{topicTitle(first.topic)}</div>
          <div className="ln-continue-title">{first.title}</div>
          <div className="ln-continue-sub">
            <Icon name="clock" /> Video coming soon
          </div>
        </div>
      </button>

      <div className="ln-chips">
        <button
          className={`ln-chip${chip === 'all' ? ' on' : ''}`}
          onClick={() => setChip('all')}
        >
          All
        </button>
        {CATALOG.map((t) => (
          <button
            key={t.id}
            className={`ln-chip${chip === t.id ? ' on' : ''}`}
            onClick={() => setChip(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>

      {shownTopics.map((t) => (
        <div key={t.id} className="ln-topic-block">
          <div className="ln-kicker">
            {t.title} · {t.lessons.length} lessons
          </div>
          <div className="ln-grid">
            {t.lessons.map((l) => (
              <button key={l.id} className="ln-card" onClick={() => onPlay(l)}>
                <Thumb lesson={l} ratio="9/16" />
                <div className="ln-card-title">{l.title}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Topics — one row per topic with lesson count. */
function TopicsScreen({ onOpenTopic }: { onOpenTopic: (t: Topic) => void }) {
  return (
    <div className="ln-screen">
      <div className="ln-head">
        <h1>Topics</h1>
      </div>
      <div className="ln-topics">
        {CATALOG.map((t) => (
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

/** A topic's lessons (opened from Topics). */
function TopicDetail({
  topic,
  onBack,
  onPlay,
}: {
  topic: Topic;
  onBack: () => void;
  onPlay: (l: Lesson) => void;
}) {
  return (
    <div className="ln-screen">
      <button className="ln-back" onClick={onBack}>
        <Icon name="caret-left" /> Topics
      </button>
      <div className="ln-head">
        <h1>{topic.title}</h1>
        <span className="ln-count">{topic.lessons.length} lessons</span>
      </div>
      <div className="ln-grid">
        {topic.lessons.map((l) => (
          <button key={l.id} className="ln-card" onClick={() => onPlay(l)}>
            <Thumb lesson={l} ratio="9/16" />
            <div className="ln-card-title">{l.title}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Saved — bookmarked lessons, or the empty state. */
function SavedScreen({
  saved,
  onPlay,
  onBrowse,
}: {
  saved: string[];
  onPlay: (l: Lesson) => void;
  onBrowse: () => void;
}) {
  const lessons = saved.map(lessonById).filter((l): l is Lesson => !!l);
  return (
    <div className="ln-screen">
      <div className="ln-head">
        <h1>Saved</h1>
        {lessons.length > 0 && <span className="ln-count">{lessons.length} videos</span>}
      </div>
      {lessons.length === 0 ? (
        <div className="ln-empty">
          <span className="ln-empty-ic">
            <Icon name="bookmark-simple" />
          </span>
          <div className="ln-empty-title">Nothing saved yet</div>
          <div className="ln-empty-sub">
            Tap the bookmark on any lesson to keep it here for later.
          </div>
          <button className="ln-pill" onClick={onBrowse}>
            <Icon name="compass" /> Browse lessons
          </button>
        </div>
      ) : (
        <div className="ln-saved-list">
          {lessons.map((l) => (
            <button key={l.id} className="ln-saved-row" onClick={() => onPlay(l)}>
              <Thumb lesson={l} ratio="16/9" />
              <span className="ln-saved-text">
                <span className="ln-saved-title">{l.title}</span>
                <span className="ln-saved-meta">{topicTitle(l.topic)} · coming soon</span>
              </span>
              <Icon name="bookmark-simple" weight="fill" className="ln-saved-mark" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Player — video coming soon panel + lesson meta + inert Phone/Web switch. */
function Player({
  lesson,
  saved,
  onToggleSave,
  onBack,
  onPlay,
}: {
  lesson: Lesson;
  saved: boolean;
  onToggleSave: () => void;
  onBack: () => void;
  onPlay: (l: Lesson) => void;
}) {
  const [cut, setCut] = useState<'phone' | 'web'>('web');
  const topic = topicById(lesson.topic)!;
  const idx = topic.lessons.findIndex((l) => l.id === lesson.id);
  const upNext = topic.lessons.filter((l) => l.id !== lesson.id).slice(0, 3);

  return (
    <div className="ln-player">
      <button className="ln-back" onClick={onBack}>
        <Icon name="caret-left" /> {topic.title}
      </button>

      <div className="ln-stage">
        <div className="ln-stage-inner">
          <span className="ln-stage-ic">
            <Icon name="graduation-cap" weight="fill" />
          </span>
          <div className="ln-stage-title">This lesson is coming soon</div>
          <div className="ln-stage-sub">
            We’re recording it in two cuts — phone and web. Save it and we’ll notify you.
          </div>
        </div>
      </div>

      <div className="ln-meta">
        <div className="ln-lesson-tag">
          {topic.title} · {idx + 1} of {LESSON_COUNT}
        </div>
        <div className="ln-meta-title">{lesson.title}</div>
        <div className="ln-meta-desc">{lesson.blurb}</div>

        <div className="ln-cutrow">
          <span className="ln-cutlabel">
            Two cuts planned — <b>phone</b> &amp; <b>web</b>
          </span>
          <div className="ln-switch" aria-disabled>
            <button
              className={`ln-switch-opt${cut === 'phone' ? ' on' : ''}`}
              onClick={() => setCut('phone')}
            >
              <Icon name="device-mobile" weight={cut === 'phone' ? 'fill' : undefined} /> Phone
            </button>
            <button
              className={`ln-switch-opt${cut === 'web' ? ' on' : ''}`}
              onClick={() => setCut('web')}
            >
              <Icon name="monitor" weight={cut === 'web' ? 'fill' : undefined} /> Web
            </button>
          </div>
        </div>

        <div className="ln-actions">
          <button className={`ln-pill${saved ? ' on' : ''}`} onClick={onToggleSave}>
            <Icon name="bookmark-simple" weight={saved ? 'fill' : undefined} />
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>

        {upNext.length > 0 && (
          <>
            <div className="ln-kicker up">Up next</div>
            <div className="ln-upnext">
              {upNext.map((l) => (
                <button key={l.id} className="ln-up-row" onClick={() => onPlay(l)}>
                  <Thumb lesson={l} ratio="16/9" />
                  <span className="ln-up-text">
                    <span className="ln-up-title">{l.title}</span>
                    <span className="ln-up-meta">coming soon</span>
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
  onOpenShell,
  onOpenProfile,
  notifs,
  notifState,
  notifUnread,
  onNotifSeen,
  onNotifMarkAll,
}: {
  now: number;
  onOpenShell: () => void;
  onOpenProfile: () => void;
  notifs: Notif[];
  notifState: NotifState;
  notifUnread: number;
  onNotifSeen: (ids: string[]) => void;
  onNotifMarkAll: () => void;
}) {
  const [tab, setTab] = useState<Tab>('home');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [playing, setPlaying] = useState<Lesson | null>(null);
  const [saved, setSaved] = useState<string[]>(() => readSaved());

  useEffect(() => {
    writeSaved(saved);
  }, [saved]);

  const toggleSave = (id: string) =>
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [id, ...s]));

  const openPlayer = (l: Lesson) => {
    setPlaying(l);
    window.scrollTo?.(0, 0);
  };

  const nav = useMemo(
    () => [
      { id: 'home', icon: 'play-circle', label: 'Home' },
      { id: 'topics', icon: 'stack', label: 'Topics' },
      { id: 'saved', icon: 'bookmark-simple', label: 'Saved' },
    ],
    [],
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
        activeId={playing ? null : tab === 'feed' ? null : tab}
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
            <button className="app-brand-app" onClick={onOpenShell} aria-label="Apps">
              Learn
            </button>
          </div>
          <div className="app-brand-actions">
            <button className="app-bell" aria-label="Search">
              <Icon name="magnifying-glass" className="app-brand-icon" />
            </button>
            <button
              className="app-bell"
              onClick={() => {
                setPlaying(null);
                setTab('feed');
              }}
              aria-label="Notifications"
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
                saved={saved.includes(playing.id)}
                onToggleSave={() => toggleSave(playing.id)}
                onBack={() => setPlaying(null)}
                onPlay={openPlayer}
              />
            </div>
          ) : tab === 'feed' ? (
            <NotificationsView
              embedded
              title="Notifications"
              notifs={notifs}
              now={now}
              state={notifState}
              onSeen={onNotifSeen}
              onMarkAll={onNotifMarkAll}
              onClose={() => setTab('home')}
            />
          ) : (
            <div className="apex-scroll">
              {tab === 'home' && <HomeScreen onPlay={openPlayer} />}
              {tab === 'topics' &&
                (topic ? (
                  <TopicDetail
                    topic={topic}
                    onBack={() => setTopic(null)}
                    onPlay={openPlayer}
                  />
                ) : (
                  <TopicsScreen onOpenTopic={setTopic} />
                ))}
              {tab === 'saved' && (
                <SavedScreen saved={saved} onPlay={openPlayer} onBrowse={() => goTab('home')} />
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
          <button className="apex-nav-apps" onClick={onOpenShell} aria-label="Apps">
            <Icon name="squares-four" />
            <span>Apps</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
