/**
 * Shared UI primitives from the design system (S-49/S-50 kit + dialogs/sheets).
 * Every surface here mirrors the boards; keep visual changes in styles.css.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FLAGS, LOCALE_IDS, LOCALES, setLocale, useT } from './i18n';

export function Icon({ name, className }: { name: string; className?: string }) {
  return <i className={`ph-bold ph-${name}${className ? ` ${className}` : ''}`} aria-hidden />;
}

export function Spinner({ size = 14, onAccent = false }: { size?: number; onAccent?: boolean }) {
  return (
    <span
      className={`sp${onAccent ? ' on-accent' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

export function Dialog(props: {
  title: ReactNode;
  danger?: boolean;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="dialog-scrim" onClick={props.onClose}>
      <div className="dialog" role="alertdialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">
          {props.danger && <Icon name="trash" />}
          {props.title}
        </h2>
        <p className="dialog-body">{props.children}</p>
        <div className="dialog-actions">{props.actions}</div>
      </div>
    </div>
  );
}

export function Sheet(props: { children: ReactNode; onClose: () => void; padded?: boolean }) {
  return (
    <>
      <div className="scrim" onClick={props.onClose} />
      <div
        className="sheet"
        role="dialog"
        style={props.padded === false ? { padding: '14px 12px 26px', gap: 2 } : undefined}
      >
        <div className="grabber" />
        {props.children}
      </div>
    </>
  );
}

export interface SnackState {
  id?: number;
  text: string;
  onUndo: () => void;
}

/** Undo snackbar: 5 s countdown, then commits (design S-22/S-26). */
export function Snackbar({ snack, onDone }: { snack: SnackState; onDone: () => void }) {
  const { t } = useT();
  const [left, setLeft] = useState(5);
  useEffect(() => {
    const iv = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);
  return (
    <div className="snackbar">
      <Icon name="trash" />
      <span className="snack-text">{snack.text}</span>
      <button
        className="snack-undo"
        onClick={() => {
          snack.onUndo();
          onDone();
        }}
      >
        {t.undo}
      </button>
      <span className="snack-count">{Math.max(left, 0)}s</span>
    </div>
  );
}

export interface ToastState {
  kind: 'ok' | 'danger';
  icon: string;
  text: string;
}

/** One toast at a time, 3.2 s, above the tab bar (S-49 rules). */
export function Toast({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  useEffect(() => {
    const to = setTimeout(onDone, 3200);
    return () => clearTimeout(to);
  }, [toast, onDone]);
  return (
    <div className={`toast ${toast.kind}`}>
      <Icon name={toast.icon} />
      <span>{toast.text}</span>
    </div>
  );
}

export function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <span className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={onToggle}>
      <span className="knob" />
    </span>
  );
}

/**
 * Compact language selector — flag chip on every screen (documented addition
 * on top of the boards; see docs/DESIGN.md). Opens a popover with all locales.
 */
export function LanguageSelector() {
  const { locale } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div className="lang" ref={ref}>
      <button
        className="lang-chip"
        aria-label={LOCALES[locale].language}
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
      >
        <span aria-hidden>{FLAGS[locale]}</span>
      </button>
      {open && (
        <div className="lang-pop" role="menu">
          {LOCALE_IDS.map((id) => (
            <button
              key={id}
              role="menuitemradio"
              aria-checked={id === locale}
              className={`lang-item${id === locale ? ' active' : ''}`}
              onClick={() => {
                setLocale(id);
                setOpen(false);
              }}
            >
              <span aria-hidden>{FLAGS[id]}</span>
              <span>{LOCALES[id].locale}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyState(props: {
  icon: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={props.icon} />
      <div className="t">{props.title}</div>
      <div className="s">{props.body}</div>
      {props.children}
    </div>
  );
}
