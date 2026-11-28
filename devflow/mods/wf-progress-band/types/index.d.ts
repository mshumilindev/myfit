declare module 'claude-code' {
  interface PluginState {
    'wf-progress-band': { snap: Snap | null };
  }
}
export type Snap = {
  task: string;
  pct: number;
  done: number;
  total: number;
  doing: number;
  blocked: number;
  todo: number;
  current: string | null;
};
