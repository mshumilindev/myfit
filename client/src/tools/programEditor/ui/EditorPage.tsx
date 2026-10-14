import { useId, type ReactNode } from 'react';
import { ActionMenu } from '../../../components/ui/ActionMenu';
import { Avatar } from '../../../components/ui/Avatar';
import { BackButton } from '../../../components/ui/BackButton';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { StickyActionBar } from '../../../components/ui/StickyActionBar';
import { Tag } from '../../../components/ui/Tag';
import { COACH_BREAKPOINT, useMinWidth } from '../../../components/ui/breakpoints';
import type { Tone } from '../../../components/ui/tones';
import { ProgramEditor, type ProgramEditorProps } from './ProgramEditor';
import './EditorPage.css';

/**
 * The page of the program editor: ONE layout for every host. A host never draws page chrome; it fills FIXED SLOTS:
 *
 *   back pill                                                              (`back`)
 *   title + subtitle (avatar, text)   |  state text, buttons, menu          (`title`, `subject`, `state`, `actions`, `menu`)
 *   notices                                                                (`notices`)
 *   info band: label + status tag, rows, one note                          (`band`)
 *   toolbar (undo / redo, summary), training days, day card, inspector     (the editor)
 *   footer                                                                 (`footer`)
 *   phone: the same buttons in a sticky bar
 *
 * Only the CONTENT of a slot differs between hosts, and it is built of the same kit elements and the `Band*` pieces below.
 */
export interface PageButton {
  id: string;
  label: string;
  /** The label on a phone bar, when the full one is long. */
  shortLabel?: string;
  icon?: string;
  iconTrailing?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  /** Looks and reads as unavailable but stays focusable (the band note explains why: set `describedBy` to its id). */
  ariaDisabled?: boolean;
  describedBy?: string;
  onClick: () => void;
}

export interface PageMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface PageBandNote {
  /** Referenced by the buttons it explains (`describedBy`). */
  id: string;
  tone: Tone;
  icon: string;
  text: string;
  /** What has to be fixed, one link per issue (each jumps to it). Shown under the sentence. */
  items?: readonly { id: string; label: string; onClick: () => void }[];
}

export interface PageBand {
  /** The band's caps label ("Program", "Assignment"). */
  label: string;
  status?: { label: string; tone: Tone };
  note?: PageBandNote;
  children: ReactNode;
}

export interface PageChrome {
  back: { label: string; text: string; onClick: () => void };
  title: string;
  /** Under the title: an avatar and one line. */
  subject?: { name?: string; text: string };
  /** A live status text beside the buttons ("Draft saved"). */
  state?: string;
  /** Left to right in the cluster; on a phone they move into the sticky bar. The last one is the main action. */
  actions?: readonly PageButton[];
  menu?: { label: string; items: readonly PageMenuItem[] };
  /** Strips under the header (errors, conflicts, "sent"). */
  notices?: ReactNode;
  /** Under the page (a quiet note). */
  footer?: ReactNode;
}

function ActionButton({ b, size }: { b: PageButton; size: 'sm' | 'md' }) {
  return (
    <Button
      variant={b.variant ?? 'secondary'}
      size={size}
      icon={b.icon}
      iconTrailing={b.iconTrailing}
      aria-disabled={b.ariaDisabled || undefined}
      aria-describedby={b.describedBy}
      disabled={b.disabled}
      onClick={b.onClick}
    >
      {size === 'md' ? (b.shortLabel ?? b.label) : b.label}
    </Button>
  );
}

/** Back, title, subject, state, buttons, menu, notices, the phone bar. Used by the editor page and by the check page. */
export function PageFrame({
  chrome,
  bar,
  children,
}: {
  chrome: PageChrome;
  /** The note above the phone bar's buttons. */
  bar?: ReactNode;
  children: ReactNode;
}) {
  const wide = useMinWidth(COACH_BREAKPOINT);
  const c = chrome;
  const actions = c.actions ?? [];
  const titleId = useId();
  return (
    <div className="pe-page">
      <div className="pe-page-back">
        <BackButton label={c.back.label} text={c.back.text} onClick={c.back.onClick} />
      </div>
      <div className="pe-page-head">
        <div className="pe-page-title">
          <h1 id={titleId} className="pe-page-h1">
            {c.title}
          </h1>
          {c.subject && (
            <p className="pe-page-sub">
              {c.subject.name && <Avatar name={c.subject.name} size={22} />}
              <span>{c.subject.text}</span>
            </p>
          )}
        </div>
        <div className="pe-page-cluster" role="group" aria-labelledby={titleId}>
          <span className="pe-page-state" role="status">
            {c.state}
          </span>
          {wide && actions.map((a) => <ActionButton key={a.id} b={a} size="sm" />)}
          {c.menu && c.menu.items.length > 0 && (
            <ActionMenu label={c.menu.label} items={c.menu.items} />
          )}
        </div>
      </div>
      {c.notices}
      {children}
      {c.footer && <div className="pe-page-foot">{c.footer}</div>}
      {!wide && actions.length > 0 && (
        <StickyActionBar className="pe-page-bar" note={bar}>
          {actions.map((a) => (
            <ActionButton key={a.id} b={a} size="md" />
          ))}
        </StickyActionBar>
      )}
    </div>
  );
}

/** The info band: label and status, the host's rows, one note. */
export function InfoBand({ band }: { band: PageBand }) {
  return (
    <Card pad="none" className="pe-band">
      <div className="pe-band-head">
        <SectionLabel>{band.label}</SectionLabel>
        {band.status && <Tag tone={band.status.tone}>{band.status.label}</Tag>}
      </div>
      <div className="pe-band-body">{band.children}</div>
      {band.note && (
        <div className="pe-band-note">
          <Notice id={band.note.id} tone={band.note.tone} icon={band.note.icon}>
            {band.note.text}
          </Notice>
          {band.note.items && band.note.items.length > 0 && (
            <ul className="pe-band-issues" aria-label={band.note.text}>
              {band.note.items.map((it) => (
                <li key={it.id}>
                  <Button variant="link" size="sm" onClick={it.onClick}>
                    {it.label}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

/** A row of the band: an optional icon, text, trailing buttons; `stack` puts the content under the heading line. */
export function BandRow({
  icon,
  title,
  sub,
  trailing,
  layout = 'inline',
  children,
}: {
  icon?: string;
  title?: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  layout?: 'inline' | 'stack';
  children?: ReactNode;
}) {
  const hasHead = title != null || sub != null || trailing != null || !!icon;
  return (
    <div className={`pe-band-row pe-band-row--${layout}`}>
      {hasHead && (
        <div className="pe-band-line">
          {icon && <IconTile icon={icon} tone="accent" size={36} />}
          {(title != null || sub != null) && (
            <span className="pe-band-text">
              {title != null && <b>{title}</b>}
              {sub != null && <small>{sub}</small>}
            </span>
          )}
          {layout === 'inline' && children != null && <p className="pe-band-grow">{children}</p>}
          {trailing != null && <span className="pe-band-trail">{trailing}</span>}
        </div>
      )}
      {(layout === 'stack' || !hasHead) && children}
    </div>
  );
}

/** A grid of labelled fields (name, length...). */
export function BandFields({ children }: { children: ReactNode }) {
  return <div className="pe-band-fields">{children}</div>;
}

export function BandField({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div className="pe-band-field">
      {label != null && <SectionLabel>{label}</SectionLabel>}
      {children}
    </div>
  );
}

/** A quiet line of text in the band. */
export function BandText({ children }: { children: ReactNode }) {
  return <p className="pe-band-p">{children}</p>;
}

export interface EditorPageProps extends Omit<ProgramEditorProps, 'className'> {
  chrome: PageChrome;
  band?: PageBand;
}

/**
 * The whole page: chrome slots, the info band and the editor (toolbar, training days, day card, inspector). Both apps
 * render exactly this; the colour comes from the accent ramp of the app (`.app-coach` or the athlete default).
 */
export function EditorPage({ chrome, band, ...editor }: EditorPageProps) {
  return (
    <PageFrame chrome={chrome} bar={band?.note ? <span>{band.note.text}</span> : chrome.state}>
      {band && <InfoBand band={band} />}
      <ProgramEditor {...editor} />
    </PageFrame>
  );
}
