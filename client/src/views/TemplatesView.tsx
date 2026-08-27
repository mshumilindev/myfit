/**
 * Deprecated. "Templates" became the Playbook (learned routines) — see
 * PlaybookView. This thin alias remains only so any lingering deep import keeps
 * resolving; nothing in the app imports it anymore. Safe to delete once the repo
 * can (the sandbox mount can't unlink it here).
 */
export { PlaybookView as TemplatesView } from './PlaybookView';
