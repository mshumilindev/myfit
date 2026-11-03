import type { ReactNode } from 'react';
import { Avatar } from './Avatar';
import { EmptyState } from './EmptyState';
import './Call.css';

export interface CallStateProps {
  /** The other person: their avatar sits above the message, so the state reads as about them. */
  name?: string;
  photo?: string | null;
  icon: string;
  title: ReactNode;
  body?: ReactNode;
  /** A line under the text, e.g. the per-platform "how to allow the microphone" steps. */
  children?: ReactNode;
}

/**
 * What the stage of a `CallScreen` shows when there is no picture to show (kit group `Call`): the call ended, was
 * declined, nobody answered, the other side is unavailable, a permission is missing. It is the kit `EmptyState`, centred
 * in the stage, so every end-of-call and permission state reads the same.
 */
export function CallState({ name, photo, icon, title, body, children }: CallStateProps) {
  return (
    <div className="uicall-end">
      {name && <Avatar name={name} src={photo} size={96} />}
      <EmptyState icon={icon} title={title} body={body} centered titleAs="h2">
        {children}
      </EmptyState>
    </div>
  );
}
