import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../ui';
import { IconButton } from './Button';
import { Textarea } from './Textarea';
import './ChatComposer.css';

export interface ChatComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  /** Placeholder and spoken name of the field ("Write to Oleh"). */
  placeholder: string;
  sendLabel: string;
  /** Characters allowed; longer text disables Send and shows `tooLongText`. */
  maxLength?: number;
  tooLongText?: string;
  /** Why Send is disabled when it is not just "empty" (offline queue full, vault locked...). */
  blockedReason?: string;
  /** Spoken reason for the empty state ("Write a message to send it"). */
  emptyReason: string;
  /** Left of the field: Share (M5), Private note... Buttons only. */
  lead?: ReactNode;
  /** Chip row above the field (Private note, Request reschedule). */
  chips?: ReactNode;
  /** Quiet line under the field (encryption note). */
  footnote?: ReactNode;
  /** Send is allowed with an empty field (a pending share card carries the message). */
  allowEmpty?: boolean;
  disabled?: boolean;
}

const MAX_ROWS_PX = 128;

/**
 * Chat composer (kit group `Coach/Chat composer`): grows to five lines, Send is an icon button that is disabled
 * (with a spoken reason) while there is nothing to send. Enter always inserts a new line: there are no hotkeys.
 * Always rendered, also when the thread is empty or offline (the message queues).
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder,
  sendLabel,
  maxLength,
  tooLongText,
  blockedReason,
  emptyReason,
  lead,
  chips,
  footnote,
  allowEmpty,
  disabled,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  }, [value]);
  const trimmed = value.trim();
  const tooLong = maxLength != null && value.length > maxLength;
  const reason = disabled
    ? undefined
    : tooLong
      ? tooLongText
      : trimmed === '' && !allowEmpty
        ? undefined
        : blockedReason;
  const blocked = !!disabled || tooLong || (trimmed === '' && !allowEmpty) || !!blockedReason;
  const describe = reason ?? (trimmed === '' && !allowEmpty ? emptyReason : undefined);
  return (
    <div className="uicomp">
      {chips && <div className="uicomp-chips">{chips}</div>}
      <div className="uicomp-row">
        {lead && <div className="uicomp-lead">{lead}</div>}
        <Textarea
          ref={ref}
          className="uicomp-field"
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby={describe ? 'uicomp-why' : undefined}
          aria-invalid={tooLong || undefined}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <IconButton
          icon="arrow-up"
          label={sendLabel}
          variant="primary"
          shape="round"
          disabled={blocked}
          aria-describedby={describe ? 'uicomp-why' : undefined}
          onClick={onSend}
        />
      </div>
      {describe && (
        <p id="uicomp-why" className={reason ? 'uicomp-why' : 'visually-hidden'}>
          {describe}
        </p>
      )}
      {footnote && (
        <p className="uicomp-foot">
          <Icon name="lock-simple" />
          {footnote}
        </p>
      )}
    </div>
  );
}
