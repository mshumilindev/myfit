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
export type TaskSnap = {
  active: boolean;
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
  eta: string | null;
};
export type Snap = {
  tasks: TaskSnap[];
  note: string | null;
};
