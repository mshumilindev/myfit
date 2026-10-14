import { Component, type ErrorInfo, type ReactNode } from 'react';
import { FailedState } from './FailedState';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Calm title of the failure card. */
  title: ReactNode;
  body?: ReactNode;
  retryLabel?: ReactNode;
  icon?: string;
  /**
   * Changing this value clears a caught error (a route change). The boundary itself never remembers a failure
   * across screens: the next screen gets a clean start.
   */
  resetKey?: string | number;
  /** Runs before the retry re-renders the children (reset a cached lazy chunk, drop a bad cache entry). */
  onRetry?: () => void;
  /** For logging; never put user data in the message. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
  /** The resetKey the error was caught under. */
  at: string | number | undefined;
}

/**
 * Keeps a failing screen from blanking its shell: a render error, a hook that throws, or a lazy chunk that did not
 * load, caught here, becomes the kit `FailedState` with a Retry. Put it INSIDE the shell (around the routed screen),
 * with `resetKey` set to the route, so navigation always works.
 */
class Boundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null, at: undefined };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: State): Partial<State> | null {
    // A new route clears the error. `at` is stamped by componentDidCatch with the key in force.
    if (state.error && state.at !== undefined && state.at !== props.resetKey)
      return { error: null, at: undefined };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ at: this.props.resetKey });
    this.props.onError?.(error, info);
  }

  private retry = () => {
    this.props.onRetry?.();
    this.setState({ error: null, at: undefined });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const { title, body, retryLabel, icon } = this.props;
    return (
      <FailedState
        icon={icon ?? 'warning-circle'}
        title={title}
        body={body}
        retryLabel={retryLabel}
        onRetry={retryLabel != null ? this.retry : undefined}
      />
    );
  }
}

/** Keeps a failing screen from blanking its shell. See `Boundary` for the mechanics; `resetKey` is the route. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <Boundary {...props} />;
}
