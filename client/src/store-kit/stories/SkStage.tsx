/** Storybook stage for the store kit: the same content in light and dark, inside `.sk-root` (tokens, base type). */
import type { ReactNode } from 'react';
import '../tokens.css';
import '../base.css';
import './stage.css';

export function SkStage({
  children,
  themes = ['light', 'dark'],
  width,
}: {
  children: ReactNode;
  themes?: Array<'light' | 'dark'>;
  /** Fixed phone width (token class sk-stage-w-phone / sk-stage-w-wide). */
  width?: 'phone' | 'wide';
}) {
  return (
    <div className="sk-stage">
      {themes.map((t) => (
        <div
          key={t}
          className={`sk-root ${t === 'dark' ? 'sk-dark' : 'sk-light'} sk-stage-pane${width ? ` sk-stage-w-${width}` : ''}`}
          data-theme-pane={t}
        >
          <span className="sk-t-e">{t}</span>
          <div className="sk-stage-body">{children}</div>
        </div>
      ))}
    </div>
  );
}

/** A labelled row of variants inside a stage. */
export function SkStageRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="sk-col sk-g8">
      {label && <span className="sk-t-c">{label}</span>}
      <div className="sk-rowf sk-g12 sk-wrap">{children}</div>
    </div>
  );
}
