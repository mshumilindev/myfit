/** Coach data layer: the only thing screens import (plus `../domain`). Components never call Firebase or callables. */
export * from './port';
export * from './bookOps';
export * from './deriveWorld';
export * from './worldStore';
export * from './useCoachWorld';
export * from './useCoachUnread';
export * from './unreadStore';
export * from './config';
export { sealDecision, openDecision, sealSignalState, openSignalState } from './decisionDocs';
