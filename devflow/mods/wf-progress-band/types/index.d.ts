declare module 'claude-code' {
  interface PluginState {
    'wf-progress-band': { snap: Snap | null };
  }
}
export type Block = {
  id: string;
  text: string;
  status: string;
  why: string;
};
export type Snap = {
  task: string;
  pct: number;
  done: number;
  total: number;
  doing: number;
  blocked: number;
  skipped: number;
  todo: number;
  current: string | null;
  blocks: Block[];
  error: string | null;
};
