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
  /** Higher = more urgent. Orders the overlay (fixed) and the deck. */
  priority: number;
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
  // The card being dealt from the top of the deck to the back stays mounted and
  // flies over the deck (peel up → tuck behind), so an advance reads as a real
  // shuffle instead of a cross-fade. `flyKey` restarts the animation each deal.
  const [flying, setFlying] = useState<Nudge | null>(null);
  const [flyKey, setFlyKey] = useState(0);

  // While the sheet is open, lock the background so it can't scroll behind the
  // scrim. Padding for the removed scrollbar keeps the page from jumping — and
  // keeps the fixed overlay symmetric, since the scrollbar no longer eats into
  // its right edge.
  useEffect(() => {
    if (!open) return;
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (sbw > 0) body.style.paddingRight = `${sbw}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [open]);

  // Most-urgent first — the fixed order for the overlay and the deck's base.
  const items = [...nudges].sort((a, b) => b.priority - a.priority);
  const count = items.length;
  // The progress fill drives the advance: it runs while the deck is collapsed,
  // pauses while the overlay is open, and when it completes it flips to the next
  // card. One clock, so the fill and the shuffle can never drift apart.
  const running = count > 1 && !open;

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

  const order = rotate(items, rotation);
  const front = order[0];

  // Deal the current top card to the back: it becomes the flyer (peels up and
  // tucks behind) while the deck rotates the next card up to the front.
  const advance = () => {
    setFlying(front);
    setFlyKey((k) => k + 1);
    setRotation((r) => r + 1);
  };

  return (
    <div className="nudge-wrap">
      <button
        type="button"
        className="nudge-deck"
        onClick={openStack}
        aria-label={typeof front.title === 'string' ? front.title : front.kicker}
      >
        {order.map((n, i) => {
          // The dealt card is drawn by the flyer, not the deck, until it lands.
          if (i >= MAX_PEEK || n.id === flying?.id) return null;
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
        {flying && (
          <span
            key={flyKey}
            className={`nudge-mini fly tone-${flying.tone}`}
            style={{ zIndex: order.length + 5 }}
            onAnimationEnd={() => setFlying(null)}
          >
            <span className="nudge-ic">
              <Icon name={flying.icon} weight="fill" />
            </span>
            <span className="nudge-mini-text">
              <span className="nudge-kicker">{flying.kicker}</span>
              <span className="nudge-title">{flying.title}</span>
            </span>
          </span>
        )}
      </button>

      {count > 1 && (
        <div className="nudge-rail" aria-hidden>
          {/* Segments keep their fixed positions; the active fill moves to the
              currently-shown card as the deck advances (Instagram-stories style). */}
          {items.map((n) => {
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
                    onAnimationEnd={advance}
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
                {/* Fixed importance order in the overlay — independent of the
                    deck's current rotation. */}
                {items.map((n, i) => (
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
