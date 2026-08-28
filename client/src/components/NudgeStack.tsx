/**
 * Nudge stack — every advisory card on Today (readiness, recovery, training
 * check, program plan, weigh-in, gym visit, …) collapsed into one deck instead
 * of a wall of banners.
 *
 * Collapsed: a card deck, the front card in focus and the rest peeking behind,
 * with an Instagram-stories progress rail beneath — the active segment is a
 * wide pill that fills over the auto-advance interval (>= 30s), then hands off
 * to the next. Tapping lifts the WHOLE stack over the content as a light
 * overlay (each card in full, staggered in), closable. Auto-advance pauses
 * while the stack is open or just after a tap.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../ui';

export interface Nudge {
  id: string;
  tone: 'readiness' | 'recovery' | 'analysis' | 'suggest' | 'plan' | 'body';
  icon: string;
  kicker: string;
  title: ReactNode;
  body: ReactNode;
  /** Expanded-view actions; `close` collapses the overlay. */
  actions?: (close: () => void) => ReactNode;
}

const ROTATE_MS = 15000; // advance the deck every 15s
const MAX_PEEK = 3; // cards drawn in the collapsed deck (front + 2 behind)
const EXIT_MS = 240;

const rotate = <T,>(arr: T[], n: number): T[] => {
  if (arr.length === 0) return arr;
  const k = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
};

export function NudgeStack({ nudges }: { nudges: Nudge[] }) {
  const [rotation, setRotation] = useState(0);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const count = nudges.length;
  // The deck advances only while collapsed; opening the stack pauses it, and it
  // resumes the moment the overlay closes.
  const running = count > 1 && !open;

  useEffect(() => {
    if (!running) return;
    const iv = window.setInterval(() => setRotation((r) => r + 1), ROTATE_MS);
    return () => window.clearInterval(iv);
  }, [running]);

  if (count === 0) return null;

  const openStack = () => {
    setClosing(false);
    setOpen(true);
  };
  const close = () => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, EXIT_MS);
  };

  const order = rotate(nudges, rotation);
  const front = order[0];

  return (
    <div className="nudge-wrap">
      <button
        type="button"
        className="nudge-deck"
        onClick={openStack}
        aria-label={typeof front.title === 'string' ? front.title : front.kicker}
      >
        {order.map((n, i) => {
          if (i >= MAX_PEEK) return null;
          return (
            <span
              key={n.id}
              className={`nudge-mini tone-${n.tone}`}
              style={{
                zIndex: order.length - i,
                transform: `translateY(${i * 8}px) scale(${1 - i * 0.04})`,
                opacity: i === 0 ? 1 : i === 1 ? 0.7 : 0.4,
              }}
            >
              <span className="nudge-ic">
                <Icon name={n.icon} weight="fill" />
              </span>
              <span className="nudge-mini-text">
                <span className="nudge-kicker">{n.kicker}</span>
                <span className="nudge-title">{n.title}</span>
              </span>
              {i === 0 && <Icon name="caret-right" className="nudge-chev" />}
            </span>
          );
        })}
      </button>

      {count > 1 && (
        <div className="nudge-rail" aria-hidden>
          {/* Segments keep their fixed positions; the active fill moves to the
              currently-shown card as the deck advances (Instagram-stories style). */}
          {nudges.map((n) => {
            const active = n.id === front.id;
            return (
              <span key={n.id} className={`nudge-seg${active ? ' on' : ''}`}>
                {active && (
                  <span
                    key={rotation}
                    className="nudge-seg-fill"
                    style={{
                      animationDuration: `${ROTATE_MS}ms`,
                      animationPlayState: running ? 'running' : 'paused',
                    }}
                  />
                )}
              </span>
            );
          })}
        </div>
      )}

      {open &&
        createPortal(
          <div className={`nudge-overlay${closing ? ' closing' : ''}`}>
            <div className="nudge-scrim" onClick={close} />
            <div className="nudge-sheet" role="dialog">
              <div className="nudge-sheet-head">
                <button type="button" className="nudge-close" onClick={close} aria-label="Close">
                  <Icon name="x-circle" weight="fill" />
                </button>
              </div>
              <div className="nudge-sheet-scroll">
                {order.map((n, i) => (
                  <div
                    key={n.id}
                    className={`nudge-full tone-${n.tone}`}
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    <div className="nudge-card-head">
                      <span className="nudge-ic lg">
                        <Icon name={n.icon} weight="fill" />
                      </span>
                      <span className="nudge-kicker">{n.kicker}</span>
                    </div>
                    <div className="nudge-card-title">{n.title}</div>
                    {n.body && <div className="nudge-card-body">{n.body}</div>}
                    {n.actions && <div className="nudge-card-acts">{n.actions(close)}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
