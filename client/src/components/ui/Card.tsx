import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { toneClass, type Tone } from './tones';
import './Card.css';

/** `neutral` is the plain surface; every other value is a colour family from
 * tones.ts (danger · ok · rest · accent · active · illness · injury · sleep ·
 * sport · kcal · apex · learn · atlas). */
export type CardTone = 'neutral' | Tone;
export type CardPad = 'none' | 'sm' | 'md' | 'lg';
/**
 * How much the card weighs on the screen (design rule 0b, KIT_RULES.md):
 *  - `hero`  — THE focal block of a screen, exactly one per screen (brass glass,
 *              glow, big numbers). Graphite: the accent glass look.
 *  - `glass` — one or two supporting blocks (brass-tinted glass).
 *  - `card`  — ordinary content (default).
 *  - `quiet` — no chrome at all: plain rows / a strip the app keeps compact.
 */
export type CardEmphasis = 'hero' | 'glass' | 'card' | 'quiet';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Render as a <button> (a tappable card) or a <section>; default <div>. */
  as?: 'div' | 'button' | 'section';
  tone?: CardTone;
  /** Two or three families flowing into each other on a diagonal (equal shares);
   *  the first sets the tone. Activity families only. */
  blend?: Array<'sport' | 'conditioning' | 'rest'>;
  pad?: CardPad;
  emphasis?: CardEmphasis;
  /** Solid surface instead of glass — for cards that stack over each other (decks). */
  opaque?: boolean;
  /** Only meaningful with `as="button"`. */
  disabled?: boolean;
  /** Optional bold header rendered above the children. */
  header?: ReactNode;
  children?: ReactNode;
}

/** Diagonal gradient across the families' tints (equal shares, flowing). */
function blendStyle(mix: string[]): CSSProperties {
  return {
    backgroundImage: `linear-gradient(135deg, ${mix.map((m) => `var(--color-${m}-tint)`).join(', ')})`,
  };
}

/**
 * The canonical surface container. Compose content inside it instead of
 * hand-rolling `.card`/`.rx .card` look-alikes. Tones map to token families;
 * `emphasis` is the only way a screen states its hierarchy — never local CSS.
 * Passes through div props (onClick, style for layout, etc.).
 */
export function Card({
  as: Tag = 'div',
  tone = 'neutral',
  blend,
  pad = 'md',
  emphasis = 'card',
  opaque = false,
  header,
  children,
  className,
  style,
  ...rest
}: CardProps) {
  const mix = blend && blend.length > 1 ? blend.slice(0, 3) : null;
  if (blend?.length) tone = blend[0];
  const cls = [
    'uicard',
    `uicard--${tone}`,
    tone !== 'neutral' ? toneClass(tone) : '',
    `uicard--pad-${pad}`,
    emphasis !== 'card' ? `uicard--e-${emphasis}` : '',
    opaque ? 'uicard--opaque' : '',
    mix ? 'uicard--blend' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag
      className={cls}
      type={Tag === 'button' ? 'button' : undefined}
      style={mix ? { ...blendStyle(mix), ...style } : style}
      {...rest}
    >
      {header != null && <div className="uicard-header">{header}</div>}
      {children}
    </Tag>
  );
}
