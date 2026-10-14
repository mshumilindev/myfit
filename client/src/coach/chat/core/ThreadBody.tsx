import type { ReactNode, Ref } from 'react';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FailedState } from '../../../components/ui/FailedState';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { Snackbar } from '../../../components/ui/Snackbar';
import { UndoToast } from '../../../components/ui/UndoToast';
import { UNDO_MS } from '../types';
import type { ChatState } from '../chatStore';
import type { ChatWords } from './useThreadCore';

export interface ThreadBodyProps {
  ch: ChatWords;
  scroller: Ref<HTMLDivElement>;
  status: string;
  messageCount: number;
  online: boolean;
  onRetryLoad: () => void;
  empty: boolean;
  cleared: boolean;
  first: string;
  /** older page: absent = no paging */
  paging?: { hasMore: boolean; loadingMore: boolean; onEarlier: () => void };
  /** draw the role=log list */
  showLog: boolean;
  logLabel: string;
  rows: ReactNode;
  /** the pending delete / clear Undo of this conversation */
  toast: ChatState['pending'] | null;
  flash: string | null;
  onUndo: () => void;
}

/** Scroller + dock of a thread: loading / failed / empty states, the "earlier" button, the log, Undo and the copy flash. */
export function ThreadBody({
  ch,
  scroller,
  status,
  messageCount,
  online,
  onRetryLoad,
  empty,
  cleared,
  first,
  paging,
  showLog,
  logLabel,
  rows,
  toast,
  flash,
  onUndo,
}: ThreadBodyProps) {
  return (
    <div className="ch-body">
      <div className={toast || flash ? 'ch-scroll has-dock' : 'ch-scroll'} ref={scroller}>
        {status === 'loading' && messageCount === 0 && (
          <SkeletonRows rows={4} label={ch.chMessagesLabel} />
        )}
        {status === 'error' && messageCount === 0 && (
          <FailedState
            title={ch.chLoadFailed}
            icon={online ? 'warning-circle' : 'cloud-slash'}
            retryLabel={ch.chRetry}
            onRetry={onRetryLoad}
          />
        )}
        {empty && (
          <EmptyState
            titleAs="h2"
            centered
            icon="envelope"
            title={cleared ? ch.chClearedH : ch.chEmptyThreadH}
            body={cleared ? ch.chClearedB(first) : ch.chEmptyThreadB(first)}
          />
        )}
        {paging && messageCount > 0 && paging.hasMore && (
          <div className="ch-earlier">
            <Button
              variant="secondary"
              size="sm"
              icon={paging.loadingMore ? 'circle-notch' : 'arrow-up'}
              disabled={paging.loadingMore}
              onClick={paging.onEarlier}
            >
              {paging.loadingMore ? ch.chEarlierLoading : ch.chEarlier}
            </Button>
          </div>
        )}
        {showLog && (
          <div role="log" aria-label={logLabel}>
            <ol className="ch-list-m">{rows}</ol>
          </div>
        )}
      </div>
      {(toast || flash) && (
        <div className="ch-dock">
          {toast ? (
            <UndoToast
              key={`${toast.kind}-${toast.id ?? ''}-${toast.until}`}
              text={toast.kind === 'chat' ? ch.chCleared : ch.chMsgDeleted}
              icon={toast.kind === 'chat' ? 'envelope' : 'trash'}
              undoLabel={ch.chUndo}
              countdownLabel={ch.chUndoCountdown}
              durationMs={UNDO_MS}
              onUndo={onUndo}
            />
          ) : (
            <Snackbar position="inline" text={flash} icon="check-circle" />
          )}
        </div>
      )}
    </div>
  );
}
