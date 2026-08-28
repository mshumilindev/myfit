/**
 * Nudge stack — the day's advisory cards (recovery/deload, training-check,
 * program suggestion) collapsed into one deck instead of a wall of banners.
 *
 * Collapsed: a card deck with the front card in focus and the rest peeking
 * behind. The queue auto-advances on a slow timer (>= 30s) so a different card
 * surfaces over time, with a soft shuffle. Tapping the front card lifts it over
 * the content (a light non-modal overlay, closable), where the full body and
 * actions live. Auto-advance pauses while a card is open or just after a tap.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../ui';

export interface Nudge {
  id: string;
  tone: 'recovery' | 'analysis' | 'suggest';
  icon: string;
  kicker: string;
  title: ReactNode;
  body: ReactNode;
  /** Expanded-view actions; `close` collapses the overlay. */
  actions?: (close: () => void) => ReactNode;
}

const ROTATE_MS = 30000; // never flip faster than every 30s
const RESUME_MS = 15000; // settle time after a manual interaction
const MAX_PEEK = 3; // cards drawn in the deck (front + 2 behind)
const EXIT_MS = 220;

const rotate = <T,>(arr: T[], n: number): T[] => {
  if (arr.length === 0) return arr;
  const k = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
};

export function NudgeStack({ nudges }: { nudges: Nudge[] }) {
  const [rotation, setRotation] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  // A recent tap pauses the shuffle for a beat, then lifts on its own.
  const [paused, setPaused] = useState(false);

  const count = nudges.length;

  // Slow auto-advance: shuffle the front card to the back. Paused while a card
  // is open or just after a tap.
  useEffect(() => {
    if (count < 2 || expanded || paused) return;
    const iv = window.setInterval(() => setRotation((r) => r + 1), ROTATE_MS);
    return () => window.clearInterval(iv);
  }, [count, expanded, paused]);

  useEffect(() => {
    if (!paused) return;
    const t = window.setTimeout(() => setPaused(false), RESUME_MS);
    return () => window.clearTimeout(t);
  }, [paused]);

  if (count === 0) return null;

  const openCard = (id: string) => {
    setPaused(true);
    setClosing(false);
    setExpanded(id);
  };
  const close = () => {
    setPaused(true);
    setClosing(true);
    window.setTimeout(() => {
      setExpanded(null);
      setClosing(false);
    }, EXIT_MS);
  };
  const jumpTo = (id: string) => {
    setPaused(true);
    setExpanded(id);
  };

  const order = rotate(nudges, rotation);
  const exp = expanded ? nudges.find((n) => n.id === expanded) : null;

  return (
    <div className="nudge-wrap">
      <div className="nudge-deck">
        {order.map((n, i) => {
          if (i >= MAX_PEEK) return null;
          const front = i === 0;
          return (
            <button
              key={n.id}
              type="button"
              className={`nudge-mini tone-${n.tone}`}
              style={{
                zIndex: order.length - i,
                transform: `translateY(${i * 7}px) scale(${1 - i * 0.035})`,
                opacity: i === 0 ? 1 : i === 1 ? 0.72 : 0.42,
                pointerEvents: front ? 'auto' : 'none',
              }}
              onClick={() => front && openCard(n.id)}
              aria-hidden={!front}
              tabIndex={front ? 0 : -1}
            >
              <span className="nudge-ic">
                <Icon name={n.icon} weight="fill" />
              </span>
              <span className="nudge-mini-text">
                <span className="nudge-kicker">{n.kicker}</span>
                <span className="nudge-title">{n.title}</span>
              </span>
              {count > 1 && front && (
                <span className="nudge-dots" aria-hidden>
                  {order.map((d, di) => (
                    <span key={d.id} className={di === 0 ? 'on' : ''} />
                  ))}
                </span>
              )}
              {front && <Icon name="caret-right" className="nudge-chev" />}
            </button>
          );
        })}
      </div>

      {exp && (
        <div className={`nudge-overlay${closing ? ' closing' : ''}`}>
          <div className="nudge-scrim" onClick={close} />
          <div className={`nudge-card tone-${exp.tone}`} role="dialog">
            <button type="button" className="nudge-close" onClick={close} aria-label="Close">
              <Icon name="x-circle" weight="fill" />
            </button>
            <div className="nudge-card-head">
              <span className="nudge-ic lg">
                <Icon name={exp.icon} weight="fill" />
              </span>
              <span className="nudge-kicker">{exp.kicker}</span>
            </div>
            <div className="nudge-card-title">{exp.title}</div>
            <div className="nudge-card-body">{exp.body}</div>
            {exp.actions && <div className="nudge-card-acts">{exp.actions(close)}</div>}
            {count > 1 && (
              <div className="nudge-card-foot">
                {nudges
                  .filter((n) => n.id !== exp.id)
                  .map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={`nudge-foot-chip tone-${n.tone}`}
                      onClick={() => jumpTo(n.id)}
                    >
                      <Icon name={n.icon} weight="fill" />
                      {n.kicker}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
